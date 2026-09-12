import { SevdeskInvoiceStatus } from './sevdesk.types';

export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

export class SevdeskStatusMapper {
  /**
   * §6 & §8.11 sevDesk numerical status mapping to KroptOS document status:
   * 100  Draft        -> 'pending'
   * 200  Open         -> 'sent'
   * 1000 Paid         -> 'sent'
   * 50   Deactivated  -> 'pending'
   * unknown number    -> 'pending' (NEVER 'sent' or 'cancelled')
   */
  static toKroptosStatus(sevdeskStatus: number | undefined | null): KroptosDocumentStatus {
    switch (sevdeskStatus) {
      case 100:
        return 'pending';
      case 200:
        return 'sent';
      case 1000:
        return 'sent';
      case 50:
        return 'pending';
      default:
        // Fail closed to 'pending' on unknown status codes (§6, §8.11)
        return 'pending';
    }
  }

  /**
   * Determines cancellation/reset route based on current invoice status.
   */
  static getResetAction(status: SevdeskInvoiceStatus | number): 'resetToDraft' | 'resetToOpen' | 'notAllowed' {
    if (status === 200) {
      return 'resetToDraft';
    }
    if (status === 100) {
      return 'resetToDraft';
    }
    // Paid (1000) invoices cannot be simply reset to draft via API; require credit note
    return 'notAllowed';
  }
}
