import {
  AccountingAmountMismatchError,
  AccountingInvoiceRequest,
} from '../core';
import { XeroRequestMapper } from './xero.request-mapper';
import { XeroInvoice } from './xero.types';

export interface IXeroInvoiceClientOps {
  createDraftInvoice(invoice: XeroInvoice): Promise<XeroInvoice>;
  authorizeInvoice(invoiceId: string): Promise<XeroInvoice>;
}

export class XeroInvoiceFlow {
  public static readonly RECONCILIATION_TOLERANCE = 0.05;

  /**
   * Executes the 3-step invoice creation & reconciliation flow:
   * 1. Create invoice in DRAFT status
   * 2. Reconcile KroptOS expected grandTotal & vatTotal with Xero's calculated Total & TotalTax (tolerance <= 0.05)
   * 3. Authorize invoice (change Status to AUTHORISED)
   */
  static async executeCreateAndAuthorize(
    req: AccountingInvoiceRequest,
    client: IXeroInvoiceClientOps,
    accountCode: string = '200',
  ): Promise<XeroInvoice> {
    // 1. Map to DRAFT
    const draftPayload = XeroRequestMapper.toXeroInvoice(req, accountCode, 'DRAFT');
    const createdDraft = await client.createDraftInvoice(draftPayload);

    // 2. Reconcile totals
    const xeroTotal =
      createdDraft.Total !== undefined
        ? createdDraft.Total
        : createdDraft.LineItems.reduce(
            (s, i) => s + (i.LineAmount || 0) + (i.TaxAmount || 0),
            0,
          );
    const xeroTax =
      createdDraft.TotalTax !== undefined
        ? createdDraft.TotalTax
        : createdDraft.LineItems.reduce((s, i) => s + (i.TaxAmount || 0), 0);

    const totalDiff = Math.abs(xeroTotal - req.grandTotal);
    const taxDiff = Math.abs(xeroTax - req.vatTotal);

    if (totalDiff > XeroInvoiceFlow.RECONCILIATION_TOLERANCE) {
      throw new AccountingAmountMismatchError(
        `Xero fatura toplamı (${xeroTotal}) ile sipariş toplamı (${req.grandTotal}) uyuşmuyor (Fark: ${totalDiff.toFixed(4)} > ${XeroInvoiceFlow.RECONCILIATION_TOLERANCE}). Fatura onaylanmadı.`,
      );
    }

    if (taxDiff > XeroInvoiceFlow.RECONCILIATION_TOLERANCE) {
      throw new AccountingAmountMismatchError(
        `Xero vergi toplamı (${xeroTax}) ile sipariş vergi toplamı (${req.vatTotal}) uyuşmuyor (Fark: ${taxDiff.toFixed(4)} > ${XeroInvoiceFlow.RECONCILIATION_TOLERANCE}). Fatura onaylanmadı.`,
      );
    }

    // 3. Authorize invoice
    if (!createdDraft.InvoiceID) {
      createdDraft.Status = 'AUTHORISED';
      return createdDraft;
    }

    return await client.authorizeInvoice(createdDraft.InvoiceID);
  }
}
