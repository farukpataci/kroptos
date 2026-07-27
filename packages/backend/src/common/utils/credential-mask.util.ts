/**
 * Credential masking helpers.
 *
 * The API never returns stored secrets; it replaces them with `CREDENTIAL_MASK`
 * so the UI can show "a value exists" without leaking it. Because that mask is
 * visible to the client, it can also come *back* on the next write (a form that
 * pre-fills the masked value and submits it untouched). Writing it through would
 * silently overwrite the real secret with a string of bullets, so every write
 * path must run incoming credentials through `stripMaskedCredentials` first.
 */

export const CREDENTIAL_MASK = '••••••••••••';

/** Credential keys whose values are secrets and must never leave the server. */
export const SECRET_CREDENTIAL_KEYS = [
  'password',
  'apiSecret',
  'awsSecretKey',
  'token',
  'apiKey',
  'awsAccessKey',
  'refreshToken',
] as const;

export type SecretCredentialKey = (typeof SECRET_CREDENTIAL_KEYS)[number];

const SECRET_KEY_SET: ReadonlySet<string> = new Set(SECRET_CREDENTIAL_KEYS);

/**
 * Matches any value made up purely of masking glyphs. Deliberately wider than
 * the exact `CREDENTIAL_MASK` constant: clients render placeholders with
 * different bullet characters and lengths, and none of those are ever a real
 * secret.
 */
const MASK_ONLY_PATTERN = /^[•‣∙·●○⚫*✱▪\s]+$/;

export function isSecretCredentialKey(key: string): boolean {
  return SECRET_KEY_SET.has(key);
}

/** True when `value` carries no information beyond "this field is hidden". */
export function isMaskedValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return MASK_ONLY_PATTERN.test(trimmed);
}

/** Replaces every secret value with `CREDENTIAL_MASK`, leaving other keys intact. */
export function maskCredentials(credentials: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(credentials ?? {})) {
    masked[key] = isSecretCredentialKey(key) ? CREDENTIAL_MASK : value;
  }
  return masked;
}

/**
 * Drops incoming credential entries that are empty or nothing but mask glyphs.
 *
 * `masked` lists the secret keys that were dropped because the client echoed the
 * mask back: on an update those must fall through to the stored value, and on a
 * create there is nothing to fall back to, so the caller should reject instead.
 */
export function stripMaskedCredentials(credentials: Record<string, any> | undefined | null): {
  credentials: Record<string, any>;
  masked: string[];
} {
  const sanitized: Record<string, any> = {};
  const masked: string[] = [];

  for (const [key, value] of Object.entries(credentials ?? {})) {
    if (value === undefined || value === null) continue;
    if (isMaskedValue(value)) {
      masked.push(key);
      continue;
    }
    sanitized[key] = value;
  }

  return { credentials: sanitized, masked };
}
