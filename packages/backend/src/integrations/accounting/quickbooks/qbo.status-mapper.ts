import { QBOInvoice } from './qbo.types';

export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

export class QBOStatusMapper {
  /**
   * §4.7 & §5 Conservative status derivation for QuickBooks Online Invoice:
   * QBO has NO explicit Status field. Status is derived strictly from TotalAmt and Balance:
   * - Voided / deleted -> 'cancelled'
   * - Balance === TotalAmt && TotalAmt > 0 -> 'sent' (open / unpaid)
   * - Balance === 0 && TotalAmt > 0 -> 'sent' (fully paid)
   * - Partially paid: 0 < Balance < TotalAmt -> 'sent'
   * - Unknown / indeterminate -> strictly 'pending' (NEVER sent or cancelled)
   */
  static deriveStatus(invoice: QBOInvoice, isVoidedOrDeleted: boolean = false): KroptosDocumentStatus {
    if (isVoidedOrDeleted) {
      return 'cancelled';
    }

    const totalAmt = invoice.TotalAmt;
    const balance = invoice.Balance;

    if (totalAmt === undefined || balance === undefined) {
      return 'pending';
    }

    // If totalAmt is 0 and balance is 0 and note indicates void
    const note = (invoice.PrivateNote || '').toLowerCase();
    if (totalAmt === 0 && balance === 0 && note.includes('void')) {
      return 'cancelled';
    }

    // Created invoice with positive amount and known balance
    if (totalAmt > 0 && balance >= 0 && balance <= totalAmt) {
      return 'sent';
    }

    // Fallback strictly to 'pending'
    return 'pending';
  }
}
