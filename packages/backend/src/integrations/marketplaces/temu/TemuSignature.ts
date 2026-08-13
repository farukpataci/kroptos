import { createHash } from 'crypto';

/**
 * Temu Open Platform request signing.
 *
 * The algorithm: sort every request parameter by key, concatenate each key
 * immediately followed by its value into one string, wrap that string with the
 * app secret on *both* sides, MD5 it, and upper-case the hex digest.
 *
 *     MD5(secret + k1v1k2v2…knvn + secret).toUpperCase()
 *
 * Nested values are JSON-serialised first, because the parameters that carry
 * them are sent as JSON strings in the POST body.
 *
 * The `sign` parameter itself is never part of its own input, and empty values
 * are dropped — a key sent with no value is not part of the signed payload.
 *
 * DOĞRULANAMADI: the algorithm is described consistently across Temu
 * integration write-ups but has not been checked against a live gateway
 * response. A signing mistake surfaces as a blanket authentication failure, so
 * this is the first thing to re-test once real credentials exist.
 */
export function signTemuRequest(
  params: Record<string, unknown>,
  appSecret: string,
): string {
  if (!appSecret) {
    throw new Error('Temu imzası için app secret gerekli.');
  }

  const serialise = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    // Objects and arrays travel as JSON strings, so they are signed as JSON.
    return JSON.stringify(value);
  };

  const concatenated = Object.keys(params)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => ({ key, value: serialise(params[key]) }))
    .filter(({ value }) => value !== '')
    .map(({ key, value }) => `${key}${value}`)
    .join('');

  return createHash('md5')
    .update(`${appSecret}${concatenated}${appSecret}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

/**
 * Builds the full parameter set for one call: the common envelope every Temu
 * request carries, plus the operation's own parameters, plus the signature
 * computed over both.
 *
 * Empty parameters are removed from the payload entirely, and that is a
 * correctness fix rather than tidiness. `signTemuRequest` drops empty values
 * from the string it hashes; the payload used to keep them, so a single blank
 * parameter meant the signature covered a DIFFERENT set of fields than the body
 * carried. Temu signs what it receives, so the two would not match and every
 * call would come back as an authentication failure — the hardest kind to
 * diagnose, because nothing about the credentials is actually wrong. Neither
 * reference implementation of this protocol sends empty parameters at all.
 *
 * Dropping them here keeps one invariant true: what is signed is exactly what
 * is sent.
 */
export function buildTemuPayload(options: {
  method: string;
  appKey: string;
  appSecret: string;
  accessToken: string;
  params?: Record<string, unknown>;
  /** Injectable so tests do not depend on the clock. */
  timestamp?: number;
}): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    type: options.method,
    app_key: options.appKey,
    access_token: options.accessToken,
    // Temu expects seconds, not milliseconds.
    timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
    data_type: 'JSON',
    ...(options.params ?? {}),
  };

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(merged)) {
    // Matches what signTemuRequest excludes, so the signed set and the sent set
    // cannot drift apart.
    if (value === null || value === undefined || value === '') continue;
    payload[key] = value;
  }

  payload.sign = signTemuRequest(payload, options.appSecret);
  return payload;
}
