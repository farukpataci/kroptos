import { LexwareInvoiceStatus } from './lexware.types';

export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

export class LexwareStatusMapper {
  /**
   * Maps Lexware voucher status to standardized KroptOS status (§7).
   * Unknown status strictly maps to 'pending', never 'sent' or 'cancelled'.
   */
  static toKroptosStatus(lexwareStatus?: LexwareInvoiceStatus | string | null): KroptosDocumentStatus {
    if (!lexwareStatus) return 'pending';

    const normalized = String(lexwareStatus).toLowerCase().trim();
    switch (normalized) {
      case 'draft':
        return 'pending';
      case 'open':
      case 'paid':
        return 'sent';
      case 'voided':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}
