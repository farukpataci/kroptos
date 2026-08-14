import { createHash, createHmac } from 'crypto';

/**
 * AliExpress Open Platform request signing.
 *
 * WHAT IS VERIFIED: parameters are sorted by name in ASCII order and
 * concatenated as key immediately followed by value; the digest is hex,
 * upper-cased; `sign` is never part of its own input; the request carries
 * `sign_method` naming the algorithm.
 *
 * WHAT IS NOT VERIFIED: how the secret enters the hash. Two schemes exist
 * across the Alibaba API families and public write-ups disagree about which one
 * the `api-sg.aliexpress.com/sync` gateway uses:
 *
 *   A. HMAC, with the app secret as the key over the concatenated string.
 *   B. A plain digest over `secret + concatenated + secret`.
 *
 * Both are implemented and tested below rather than one being guessed, because
 * a signing mistake surfaces as a blanket authentication failure that says
 * nothing about which part was wrong. Switching is one line: change
 * ACTIVE_VARIANT. Whichever proves correct, the sorting and encoding around it
 * are already right.
 *
 * DOĞRULANAMADI: which variant applies, and whether the API path is prepended
 * to the signed string on this gateway.
 */

export type SignatureVariant = 'hmac' | 'wrapped';

/** Variant A: HMAC over the concatenation, secret as key. */
export function signHmac(concatenated: string, appSecret: string, algorithm: string): string {
  return createHmac(algorithm, appSecret).update(concatenated, 'utf8').digest('hex').toUpperCase();
}

/** Variant B: plain digest over secret + concatenation + secret. */
export function signWrapped(concatenated: string, appSecret: string, algorithm: string): string {
  return createHash(algorithm)
    .update(`${appSecret}${concatenated}${appSecret}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

/**
 * The variant used until the correct one is confirmed against a live gateway.
 * HMAC is the one most consistently reported for this gateway; it is a
 * selection, not a verified fact.
 */
export const ACTIVE_VARIANT: SignatureVariant = 'hmac';

/**
 * Sorted, concatenated parameter string — the part that is the same under both
 * variants. Empty values are dropped and `sign` is excluded.
 */
export function buildSignatureBase(params: Record<string, unknown>): string {
  const serialise = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  };

  return Object.keys(params)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => ({ key, value: serialise(params[key]) }))
    .filter(({ value }) => value !== '')
    .map(({ key, value }) => `${key}${value}`)
    .join('');
}

export function signAliExpressRequest(
  params: Record<string, unknown>,
  appSecret: string,
  options: { variant?: SignatureVariant; algorithm?: string } = {},
): string {
  if (!appSecret) {
    throw new Error('AliExpress imzası için app secret gerekli.');
  }

  const base = buildSignatureBase(params);
  const algorithm = options.algorithm ?? 'sha256';
  const variant = options.variant ?? ACTIVE_VARIANT;

  return variant === 'hmac'
    ? signHmac(base, appSecret, algorithm)
    : signWrapped(base, appSecret, algorithm);
}

/**
 * Full parameter set for one call: the system envelope every AliExpress request
 * carries, the operation's own parameters, and the signature over both.
 */
export function buildAliExpressPayload(options: {
  method: string;
  appKey: string;
  appSecret: string;
  /** The access token; AliExpress names this parameter `session`. */
  session: string;
  params?: Record<string, unknown>;
  /** Injectable so tests do not depend on the clock. */
  timestamp?: number;
  variant?: SignatureVariant;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    app_key: options.appKey,
    method: options.method,
    session: options.session,
    // DOĞRULANAMADI: whether this gateway wants epoch milliseconds or the
    // legacy "yyyy-MM-dd HH:mm:ss" string the older TOP gateway used.
    timestamp: options.timestamp ?? Date.now(),
    format: 'json',
    v: '2.0',
    sign_method: 'sha256',
    ...(options.params ?? {}),
  };

  payload.sign = signAliExpressRequest(payload, options.appSecret, { variant: options.variant });
  return payload;
}
