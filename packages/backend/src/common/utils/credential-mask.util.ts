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

/**
 * Credential keys that are safe to hand back to the client: connection targets
 * and account identifiers, never anything that authenticates on its own.
 *
 * This is an allowlist by design. Enumerating secrets instead would make every
 * new connector a chance to leak — a provider added with a `clientSecret` or
 * `consumerSecret` field would sail through an unfamiliar key. Here an unknown
 * key is treated as a secret, so a new connector fails closed and the worst
 * case is a public field showing up masked.
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

export type PublicCredentialKey = (typeof PUBLIC_CREDENTIAL_KEYS)[number];

const PUBLIC_KEY_SET: ReadonlySet<string> = new Set(PUBLIC_CREDENTIAL_KEYS);

/**
 * Matches any value made up purely of masking glyphs. Deliberately wider than
 * the exact `CREDENTIAL_MASK` constant: clients render placeholders with
 * different bullet characters and lengths, and none of those are ever a real
 * secret.
 */
const MASK_ONLY_PATTERN = /^[•‣∙·●○⚫*✱▪\s]+$/;

/** Anything not explicitly published is a secret. */
export function isSecretCredentialKey(key: string): boolean {
  return !PUBLIC_KEY_SET.has(key);
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
 * Drops incoming credential entries that carry no secret: nulls, mask glyphs,
 * and blank secret fields.
 *
 * A blank secret means "leave the stored one alone" — the forms send an empty
 * input for a secret the user did not retype — so writing it through would
 * clear a live credential. It is dropped here rather than trusted to the client.
 *
 * `placeholders` lists the secret keys dropped that way. On an update they fall
 * through to the stored value; on a create there is nothing to fall back to, so
 * the caller should reject instead of persisting an empty secret.
 */
export function stripMaskedCredentials(credentials: Record<string, any> | undefined | null): {
  credentials: Record<string, any>;
  placeholders: string[];
} {
  const sanitized: Record<string, any> = {};
  const placeholders: string[] = [];

  for (const [key, value] of Object.entries(credentials ?? {})) {
    if (value === undefined || value === null) continue;
    if (isMaskedValue(value)) {
      placeholders.push(key);
      continue;
    }
    if (isSecretCredentialKey(key) && typeof value === 'string' && value.trim() === '') {
      placeholders.push(key);
      continue;
    }
    sanitized[key] = value;
  }

  return { credentials: sanitized, placeholders };
}
