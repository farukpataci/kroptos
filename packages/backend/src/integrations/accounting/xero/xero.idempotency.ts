import * as crypto from 'crypto';

export class XeroIdempotency {
  /**
   * Generates a deterministic UUID/key for Xero's Idempotency-Key header.
   * Xero accepts any string, but recommends UUIDs or unique strings.
   * Cached by Xero for 6 minutes.
   *
   * Note: This works in tandem with KroptOS's internal DB claim row
   * (@@unique([agencyId, storeId, type, referenceCode])) which provides
   * permanent multi-year idempotency.
   */
  static generateKey(companyId: string, referenceCode: string, action: string = 'create_invoice'): string {
    const raw = `xero:${companyId}:${referenceCode}:${action}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 36);
  }
}
