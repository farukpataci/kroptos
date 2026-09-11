import { AccountingDocumentStatus } from '../core/AccountingTypes';
import { FortnoxInvoice } from './fortnox.types';

export class FortnoxStatusMapper {
  /**
   * Map Fortnox invoice status to standard KroptOS AccountingDocumentStatus (§6).
   * Conservative policy:
   * - Booked = true -> 'created'
   * - Cancelled = true -> 'cancelled'
   * - Unbooked / pending / unknown -> 'pending' (NEVER blindly 'created' or 'cancelled')
   */
  static toAccountingDocumentStatus(
    invoice?: Partial<FortnoxInvoice> | null,
  ): AccountingDocumentStatus {
    if (!invoice) return 'pending';

    if (invoice.Cancelled) {
      return 'cancelled';
    }

    if (invoice.Booked) {
      return 'created';
    }

    // Default conservative: unbooked invoices are 'pending'
    return 'pending';
  }

  /**
   * Determine whether an invoice can be cancelled directly or requires a credit note (§5.5).
   * Under Swedish Bokföringslagen:
   * - Unbooked invoices (Booked = false) can be cancelled via PUT /3/invoices/{id}/cancel.
   * - Booked invoices (Booked = true) are immutable; they MUST be corrected via credit note (Kreditfaktura).
   */
  static determineCancellationPath(
    invoice?: Partial<FortnoxInvoice> | null,
  ): 'cancel' | 'credit_note' {
    if (invoice && invoice.Booked) {
      return 'credit_note';
    }
    return 'cancel';
  }

  /**
   * Check if direct modification is allowed (§5.5)
   * Once booked, modifications are forbidden.
   */
  static isImmutable(invoice?: Partial<FortnoxInvoice> | null): boolean {
    return Boolean(invoice && invoice.Booked);
  }
}
