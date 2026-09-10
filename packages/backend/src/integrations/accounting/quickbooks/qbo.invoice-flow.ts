import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { QBORequestMapper } from './qbo.request-mapper';
import { QBOTaxConfiguration } from './qbo.tax';
import { QBOInvoice } from './qbo.types';
import { QBOSyncTokenManager } from './qbo.sync-token';

export interface IQBOInvoiceClientOps {
  createInvoice(invoice: QBOInvoice, requestId?: string): Promise<QBOInvoice>;
  getInvoice(id: string): Promise<QBOInvoice>;
  voidInvoice(id: string, syncToken: string): Promise<QBOInvoice>;
  deleteInvoice(id: string, syncToken: string): Promise<{ status: string }>;
}

export interface QBOInvoiceFlowResult {
  invoice: QBOInvoice;
  hasAmountMismatch: boolean;
  amountDifference: number;
}

export class QBOInvoiceFlow {
  public static readonly RECONCILIATION_TOLERANCE = 0.05;

  /**
   * §4.9 Multi-step Invoice Flow:
   * 1. Line pre-validation (via QBORequestMapper)
   * 2. Create invoice in QuickBooks Online
   * 3. Read back header TotalAmt and reconcile against KroptOS grandTotal
   * 4. If mismatch > 0.05: invoice remains 'sent', but flagged with hasAmountMismatch for UI warning.
   */
  static async executeCreateInvoice(
    req: AccountingInvoiceRequest,
    customerId: string,
    taxConfig: QBOTaxConfiguration,
    client: IQBOInvoiceClientOps,
    requestId?: string,
  ): Promise<QBOInvoiceFlowResult> {
    // 1. Map & pre-validate line amounts
    const payload = QBORequestMapper.toQBOInvoice(req, customerId, taxConfig);

    // 2. Create invoice via client
    const createdInvoice = await client.createInvoice(payload, requestId);

    // 3. Read-back reconciliation of header TotalAmt
    const qboTotal = createdInvoice.TotalAmt ?? 0;
    const expectedTotal = req.grandTotal;
    const diff = Math.abs(qboTotal - expectedTotal);
    const hasMismatch = diff > QBOInvoiceFlow.RECONCILIATION_TOLERANCE;

    if (hasMismatch) {
      console.warn(
        `[QBOInvoiceFlow] Fatura tutar uyuşmazlığı tespit edildi (QBO TotalAmt: ${qboTotal}, KroptOS Beklenen: ${expectedTotal}, Fark: ${diff.toFixed(2)}). Belge uyuşmazlık bayrağı ile kaydedildi.`,
      );
    }

    return {
      invoice: createdInvoice,
      hasAmountMismatch: hasMismatch,
      amountDifference: +diff.toFixed(2),
    };
  }

  /**
   * §2.4 & §4.2 Invoice cancellation flow:
   * 1. Read latest invoice status and SyncToken first (§2.4 universal rule)
   * 2. Choose path:
   *    - If already voided: throw error (already cancelled)
   *    - Void invoice using operation=void with current SyncToken (5010 optimistic lock retry handled)
   */
  static async executeCancelInvoice(
    invoiceId: string,
    client: IQBOInvoiceClientOps,
  ): Promise<{ cancellationType: 'voided' | 'deleted'; invoice: QBOInvoice }> {
    return await QBOSyncTokenManager.executeWithSyncToken(
      () => client.getInvoice(invoiceId),
      async (latestInvoice) => {
        // §2.4 Verification: Check current document status
        const note = (latestInvoice.PrivateNote || '').toLowerCase();
        if (latestInvoice.TotalAmt === 0 && latestInvoice.Balance === 0 && note.includes('void')) {
          throw new Error(`QuickBooks Online üzerindeki fatura (${invoiceId}) zaten iptal edilmiştir (Voided).`);
        }

        const voidedInvoice = await client.voidInvoice(invoiceId, latestInvoice.SyncToken || '0');
        return {
          cancellationType: 'voided',
          invoice: voidedInvoice,
        };
      },
    );
  }
}
