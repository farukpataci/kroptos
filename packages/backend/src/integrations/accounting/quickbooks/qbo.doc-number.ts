import * as crypto from 'crypto';

/**
 * §4.5 DocNumber: 21 character limit & deterministic truncation.
 *
 * QuickBooks Online strictly enforces a maximum length of 21 characters on DocNumber.
 * This helper deterministically shortens references that exceed 21 characters,
 * ensuring no two distinct references produce colliding DocNumbers.
 */
export class QBODocNumber {
  public static readonly MAX_LENGTH = 21;

  static format(referenceCode: string): string {
    const trimmed = (referenceCode || '').trim();
    if (!trimmed) {
      return 'INV-1';
    }

    if (trimmed.length <= QBODocNumber.MAX_LENGTH) {
      return trimmed;
    }

    // Reference exceeds 21 chars:
    // Format: prefix(12 chars) + '-' + hash(8 chars) = 21 chars total
    const hash = crypto.createHash('sha256').update(trimmed).digest('hex').substring(0, 8);
    const prefix = trimmed.substring(0, 12);
    return `${prefix}-${hash}`;
  }
}
