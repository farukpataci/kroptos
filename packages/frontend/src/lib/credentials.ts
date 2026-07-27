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

/** Form fields that hold secrets; empty means "keep the stored value". */
export const SECRET_CREDENTIAL_KEYS = [
  'password',
  'apiSecret',
  'awsSecretKey',
  'token',
  'apiKey',
  'awsAccessKey',
  'refreshToken',
  'accessToken',
] as const;

const SECRET_KEY_SET: ReadonlySet<string> = new Set(SECRET_CREDENTIAL_KEYS);

const MASK_ONLY_PATTERN = /^[•‣∙·●○⚫*✱▪\s]+$/;

export function isSecretCredentialKey(key: string): boolean {
  return SECRET_KEY_SET.has(key);
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
