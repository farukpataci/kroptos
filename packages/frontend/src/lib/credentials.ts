/**
 * Client-side counterpart of the backend credential mask helpers.
 *
 * The API returns stored secrets as `CREDENTIAL_MASK` rather than the real
 * value. That mask must never be used as a form *value* — only as a placeholder
 * — otherwise submitting an untouched form ships the bullets back and overwrites
 * the real secret. Secret inputs therefore start empty, and anything that still
 * looks like a mask is stripped here before the request goes out.
 */

export const CREDENTIAL_MASK = '••••••••••••';

/**
 * Credential fields that carry no secret: connection targets and account
 * identifiers. Mirrors PUBLIC_CREDENTIAL_KEYS in the backend's
 * credential-mask.util.ts, which is the authority — this copy only decides what
 * to send, never what to expose.
 *
 * Allowlist by design: every field outside this set is treated as a secret, so
 * a new connector's unfamiliar key is left alone when blank instead of being
 * shipped as an empty string that clears the stored value.
 */
export const PUBLIC_CREDENTIAL_KEYS = [
  'apiUrl',
  'firmNo',
  'merchantId',
  'periodNo',
  'sellerId',
  'shopDomain',
  'username',
  'warehouseNo',
] as const;

const PUBLIC_KEY_SET: ReadonlySet<string> = new Set(PUBLIC_CREDENTIAL_KEYS);

const MASK_ONLY_PATTERN = /^[•‣∙·●○⚫*✱▪\s]+$/;

/** Anything not explicitly public is treated as a secret. */
export function isSecretCredentialKey(key: string): boolean {
  return !PUBLIC_KEY_SET.has(key);
}

/** True when the value is only masking glyphs, i.e. carries no real secret. */
export function isMaskedValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return MASK_ONLY_PATTERN.test(trimmed);
}

/**
 * Removes secret fields the user left untouched (empty or still masked) so the
 * server falls back to the stored credential instead of overwriting it.
 */
export function stripMaskedCredentials<T extends Record<string, any>>(payload: T): Partial<T> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (isMaskedValue(value)) continue;
    if (isSecretCredentialKey(key) && typeof value === 'string' && value.trim() === '') continue;
    sanitized[key] = value;
  }

  return sanitized as Partial<T>;
}
