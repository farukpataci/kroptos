/**
 * TEMPORARY — live-verification instrumentation.
 *
 * Added to watch one real Allegro integration end to end. Remove once that
 * round is finished; it is deliberately self-contained so deleting this file
 * plus its call sites is the whole revert.
 *
 * Off unless `INTEGRATION_TRACE=1`, so it cannot start writing on a normal run.
 *
 * EVENTS ONLY, NEVER VALUES. Secrets must not reach a log line even during a
 * debugging round: a token pasted into a terminal transcript outlives the
 * round. Where a value matters, only its presence, length or key name is
 * recorded — never the value itself.
 */

const ENABLED = process.env.INTEGRATION_TRACE === '1';

/** Keys whose values must never be printed, whatever the caller passes. */
const FORBIDDEN = /token|secret|password|apikey|api_key|authorization|session|sign/i;

function scrub(details: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (FORBIDDEN.test(key)) {
      // Report shape, not content: enough to tell "present" from "missing"
      // without ever putting the value on a line.
      safe[key] =
        value === undefined || value === null
          ? '(yok)'
          : typeof value === 'boolean'
            ? value
            : `(var, ${String(value).length} karakter)`;
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export function trace(event: string, details: Record<string, unknown> = {}): void {
  if (!ENABLED) return;
  const parts = Object.entries(scrub(details)).map(([k, v]) => `${k}=${JSON.stringify(v)}`);
  console.log(`[TRACE] ${event}${parts.length ? ' ' + parts.join(' ') : ''}`);
}

/** Redacts credential-ish header values while keeping the header names. */
export function traceHeaders(event: string, headers: Record<string, string>): void {
  if (!ENABLED) return;
  const safe: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers)) {
    safe[name] = FORBIDDEN.test(name) ? `(var, ${value.length} karakter)` : value;
  }
  trace(event, safe);
}
