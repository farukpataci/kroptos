import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure, non-predictable public ID with a specified prefix.
 * Example outputs: tn_3a8b2c9d1f, ord_ef72b6a9d1
 */
export function generatePublicId(prefix: string, length = 10): string {
  const byteLength = Math.ceil(length / 2);
  const buffer = crypto.randomBytes(byteLength);
  const randomStr = buffer.toString('hex').slice(0, length);
  return `${prefix}_${randomStr}`;
}
