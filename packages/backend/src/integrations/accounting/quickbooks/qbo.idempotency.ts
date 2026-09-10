import * as crypto from 'crypto';

/**
 * §4.4 Native Idempotency Key (requestid query parameter)
 *
 * QuickBooks Online supports idempotency through a `requestid` query parameter
 * on mutative operations (e.g. POST .../invoice?requestid=...).
 * Maximum length is 50 characters.
 *
 * Note: This is the 2nd appearance of native provider-level idempotency in the suite
 * (Xero was 1st with Idempotency-Key header). Per KroptOS architecture rule:
 * "Two providers stay in their own package, third provider promotes to core/".
 * Candidate for promotion on 3rd appearance.
 */
export class QBOIdempotency {
  static generateRequestId(realmId: string, referenceCode: string, action: string = 'create_invoice'): string {
    const raw = `qbo:${realmId}:${referenceCode}:${action}`;
    // Generate a deterministic 36-character hex hash compliant with QBO's <= 50 chars constraint
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 36);
  }
}
