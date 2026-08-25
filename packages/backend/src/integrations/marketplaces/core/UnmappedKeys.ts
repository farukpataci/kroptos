/**
 * Makes a silent field loss loud.
 *
 * The same bug has landed three times: a marketplace starts sending a field,
 * the narrow function that turns the raw body into our own type never learns
 * about it, and nothing anywhere says so. The payload has it, the database
 * does not, and the first person to notice is a seller asking where their
 * tracking number went.
 *
 * Rather than a hand-written list of "keys we know about" — which drifts the
 * moment someone adds a mapping and forgets to update it — the narrow function
 * is run over a recording proxy. Whatever it never touched is, by definition,
 * what it does not map. No list to maintain, and it cannot go stale.
 *
 * KVKK: key names only, never values. The raw shipment package carries the
 * recipient's name, phone and address; a "here is what we dropped" log that
 * printed values would be a bigger leak than the bug it reports.
 */

/**
 * How deep the walk goes on both sides. Deep enough for `lines[].discountDetails[]`
 * — the deepest thing any measured marketplace body has — and shallow enough
 * that a pathological payload cannot turn one order into thousands of paths.
 *
 * ponytail: fixed depth, arrays sampled at element 0. A key that only ever
 * appears on the second element of an array is invisible here; raise the cap
 * or sample every element if a provider turns out to need it.
 */
const MAX_DEPTH = 4;

/**
 * Caps one finding's key list. A body with more unread paths than this has a
 * bigger problem than the tail of the list can say.
 */
const MAX_KEYS_PER_FINDING = 300;

export interface UnmappedKeyFinding {
  provider: string;
  /** Which read produced the body: 'orders', 'products', … */
  endpoint: string;
  /** Dotted paths the narrow function never read. Names only. */
  keys: string[];
}

/** Every data path in a payload, in the same notation the reader records. */
function dataKeyPaths(value: unknown, prefix: string, depth: number, out: Set<string>): void {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    // One element stands for the whole array — see the depth note above.
    if (value.length > 0) dataKeyPaths(value[0], `${prefix}[]`, depth + 1, out);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.add(path);
    dataKeyPaths(child, path, depth + 1, out);
  }
}

/**
 * A view of `target` that records every data key read through it.
 *
 * Array housekeeping — `length`, `map`, iterator symbols — is deliberately not
 * recorded: those are not fields the marketplace sent. Index reads all collapse
 * onto one `[]` path so a hundred order lines do not become a hundred paths.
 */
function watch<T extends object>(target: T, prefix: string, read: Set<string>, depth: number): T {
  if (depth > MAX_DEPTH) return target;

  const proxied = new Map<string, unknown>();

  return new Proxy(target, {
    get(object, property) {
      // Not `Reflect.get(object, property, receiver)`: forwarding the proxy as
      // the receiver would re-enter this trap through any getter on the way.
      const value = Reflect.get(object, property);
      if (typeof property === 'symbol') return value;

      const array = Array.isArray(object);
      const index = array && /^\d+$/.test(property);
      if (array && !index) return value;

      const path = index ? `${prefix}[]` : prefix ? `${prefix}.${property}` : property;
      read.add(path);

      if (value === null || typeof value !== 'object') return value;

      // Cached so `raw.lines` twice is the same object twice — a narrow that
      // compares references would otherwise see two different things.
      const seen = proxied.get(property);
      if (seen) return seen;

      const wrapped = watch(value as object, path, read, depth + 1);
      proxied.set(property, wrapped);
      return wrapped;
    },
  });
}

/**
 * Collects, for one connector's lifetime, what its narrow functions threw away.
 *
 * Held rather than written because a connector has no database — same shape as
 * the rotated-credential handover: the caller that owns the tenant context
 * collects the findings and decides where they go.
 */
export class UnmappedKeyRecorder {
  /** endpoint -> every path any payload from it left unread, this round. */
  private readonly byEndpoint = new Map<string, Set<string>>();

  constructor(private readonly provider: string) {}

  /**
   * Runs `narrow` over a watched `raw` and records the difference.
   *
   * Accumulated as one set per endpoint, not one finding per distinct key set:
   * optional fields come and go between rows — `cargoTrackingLink` was on 13 of
   * 50 measured packages — so per-key-set reporting turned one round into
   * twenty near-identical rows saying the same thing. The union is what a
   * person needs, and it is one row.
   */
  observe<TRaw extends object, TOut>(
    endpoint: string,
    raw: TRaw,
    narrow: (watched: TRaw) => TOut,
  ): TOut {
    if (raw === null || typeof raw !== 'object') return narrow(raw);

    const read = new Set<string>();
    // The narrow functions in this codebase all build fresh object literals, so
    // nothing proxied escapes into the result. One that returned a sub-object
    // of `raw` by reference would hand a proxy downstream; rebuild the literal
    // instead of unwrapping it here.
    const result = narrow(watch(raw, '', read, 0));

    const all = new Set<string>();
    dataKeyPaths(raw, '', 0, all);

    let unread = this.byEndpoint.get(endpoint);
    if (!unread) {
      unread = new Set<string>();
      this.byEndpoint.set(endpoint, unread);
    }
    for (const path of all) {
      if (!read.has(path) && unread.size < MAX_KEYS_PER_FINDING) unread.add(path);
    }

    return result;
  }

  /** Clears on read, so a caller cannot write the same finding twice. */
  consume(): UnmappedKeyFinding[] {
    const findings: UnmappedKeyFinding[] = [];
    for (const [endpoint, keys] of this.byEndpoint) {
      if (keys.size > 0) {
        findings.push({ provider: this.provider, endpoint, keys: [...keys].sort() });
      }
    }
    this.byEndpoint.clear();
    return findings;
  }
}
