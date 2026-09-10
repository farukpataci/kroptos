export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

/**
 * Xero Status Mapper
 *
 * DRAFT, SUBMITTED         -> pending
 * AUTHORISED, PAID         -> sent
 * VOIDED, DELETED          -> cancelled
 * Bilinmeyen / Boş         -> pending (ASLA sent veya cancelled olamaz)
 */
export class XeroStatusMapper {
  static toKroptosStatus(status?: string | null): KroptosDocumentStatus {
    if (!status) {
      return 'pending';
    }

    const normalized = status.trim().toUpperCase();

    switch (normalized) {
      case 'DRAFT':
      case 'SUBMITTED':
        return 'pending';

      case 'AUTHORISED':
      case 'PAID':
        return 'sent';

      case 'VOIDED':
      case 'DELETED':
        return 'cancelled';

      default:
        // Rule: Fallback to pending for unknown statuses; NEVER sent or cancelled
        return 'pending';
    }
  }
}
