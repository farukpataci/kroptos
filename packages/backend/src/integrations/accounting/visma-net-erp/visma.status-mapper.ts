import { AccountingDocumentStatus } from '../core/AccountingTypes';
import { VismaInvoiceStatus } from './visma.types';

export class VismaStatusMapper {
  /**
   * Map Visma.net ERP invoice status to standard KroptOS AccountingDocumentStatus (§6).
   * Conservative policy: Unknown statuses ALWAYS map to 'pending'. Never blindly 'created' or 'cancelled'.
   */
  static toAccountingDocumentStatus(status?: VismaInvoiceStatus | string | null): AccountingDocumentStatus {
    if (!status) return 'pending';

    const normalized = String(status).trim().toLowerCase();

    switch (normalized) {
      case 'open':
      case 'closed':
        return 'created';
      case 'voided':
      case 'rejected':
        return 'cancelled';
      case 'hold':
      case 'balanced':
      case 'scheduled':
      case 'inprocess':
        return 'pending';
      default:
        return 'pending';
    }
  }

  /**
   * Universal Rule (§2.4, §5.5, Conformance #18):
   * For cancelable invoice documents, current state must be checked before selecting path.
   * - Balanced / Hold can be deleted/voided directly.
   * - Open / Closed requires formal voiding action or credit note.
   */
  static canDeleteDirectly(status?: VismaInvoiceStatus | string | null): boolean {
    if (!status) return false;
    const normalized = String(status).trim().toLowerCase();
    return normalized === 'hold' || normalized === 'balanced';
  }

  static determineCancellationPath(status?: VismaInvoiceStatus | string | null): 'void' | 'credit_note' {
    if (!status) return 'void';
    const normalized = String(status).trim().toLowerCase();
    if (normalized === 'closed') return 'credit_note';
    return 'void';
  }
}
