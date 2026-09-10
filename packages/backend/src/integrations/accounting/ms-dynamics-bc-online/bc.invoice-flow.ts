/**
 * Business Central Sales Invoice Flow (§4.2, §4.4)
 *
 * Mandatory Flow:
 * 1. Claim row (existing idempotency pattern)
 * 2. POST salesInvoices -> Draft invoice created, externalDocumentNumber = KroptOS referenceCode
 * 3. POST salesInvoiceLines for each item
 * 4. GET salesInvoices({id})?$expand=salesInvoiceLines -> Read BC calculated totals
 * 5. RECONCILIATION: totalAmountIncludingTax == KroptOS grandTotal
 *    - MATCHES: Proceed to Step 6
 *    - MISMATCH: DO NOT POST. Stays Draft, mismatch diff stored in rawResponse & errorMessage.
 * 6. POST .../Microsoft.NAV.post -> Invoice posted to ledger.
 * 7. Read back posted invoice to capture final document number and externalId.
 */

import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { IBusinessCentralClient } from './bc.client';
import { BusinessCentralRequestMapper } from './bc.request-mapper';
import { BusinessCentralResponseMapper } from './bc.response-mapper';
import { BusinessCentralReconciliationResult } from './bc.types';

export class BusinessCentralInvoiceFlow {
  /**
   * Reconcile BC calculated total with KroptOS order total. Zero tolerance (§4.2).
   */
  static reconcile(
    kroptosTotal: number,
    bcTotal: number,
    currency: string,
  ): BusinessCentralReconciliationResult {
    const diff = Math.abs(bcTotal - kroptosTotal);
    const matched = diff < 0.001; // Strict rounding match (no tolerance)

    return {
      matched,
      kroptosTotal,
      bcTotal,
      diff: Number(diff.toFixed(4)),
      currency,
      reason: matched
        ? undefined
        : `BC toplamı (${bcTotal} ${currency}) sipariş toplamıyla (${kroptosTotal} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Taslak Business Central'da bekletiliyor.`,
    };
  }

  /**
   * Execute complete invoice creation flow (§4.2)
   */
  static async executeCreateInvoice(
    client: IBusinessCentralClient,
    request: AccountingInvoiceRequest,
  ): Promise<AccountingInvoiceResult> {
    // 1. Idempotency check via externalDocumentNumber if available
    const existing = await client.findInvoiceByReference(request.referenceCode);
    if (existing) {
      return BusinessCentralResponseMapper.toInvoiceResult(existing, {
        idempotentReplay: true,
      });
    }

    // 2. Create Draft salesInvoice header
    const headerPayload = BusinessCentralRequestMapper.toSalesInvoiceHeader(request);
    const draftHeader = await client.createDraftInvoice(headerPayload);
    const invoiceId = draftHeader.id;

    if (!invoiceId) {
      throw new Error('Business Central taslak fatura kimliği (id) alınamadı.');
    }

    // 3. Create salesInvoiceLines for each item
    const linePayloads = BusinessCentralRequestMapper.toSalesInvoiceLines(request, invoiceId);
    for (const line of linePayloads) {
      await client.createInvoiceLine(line);
    }

    // 4. GET salesInvoices({id})?$expand=salesInvoiceLines to read BC calculated totals
    const draftWithTotals = await client.getInvoice(invoiceId, true);
    const bcTotal = Number(draftWithTotals.totalAmountIncludingTax ?? 0);
    const kroptosTotal = Number(request.grandTotal);

    // 5. Reconciliation (§4.2)
    const recon = this.reconcile(kroptosTotal, bcTotal, request.currency);

    if (!recon.matched) {
      // STOP! DO NOT POST. Return Draft result with mismatch metadata
      return BusinessCentralResponseMapper.toInvoiceResult(draftWithTotals, {
        providerStatus: 'Draft',
        reconciliationMismatch: true,
        reconciliationDiff: recon.diff,
        reconciliationMessage: recon.reason,
        bcTotal: recon.bcTotal,
        kroptosTotal: recon.kroptosTotal,
      });
    }

    // 6. Totals MATCH! Post the sales invoice via Microsoft.NAV.post
    await client.postInvoice(invoiceId);

    // 7. Read back posted invoice to capture final readable document number and state
    const postedInvoice = await client.getInvoice(invoiceId, false);

    return BusinessCentralResponseMapper.toInvoiceResult(postedInvoice, {
      providerStatus: postedInvoice.status || 'Open',
      reconciliationMatched: true,
    });
  }

  /**
   * Cancel invoice flow (§4.4)
   * Draft -> DELETE (with ETag If-Match)
   * Posted (Open/Paid) -> Microsoft.NAV.cancel or makeCorrectiveCreditMemo
   */
  static async executeCancelInvoice(
    client: IBusinessCentralClient,
    invoiceId: string,
  ): Promise<{ cancellationType: 'deleted' | 'credit_memo'; message: string }> {
    const invoice = await client.getInvoice(invoiceId, false);
    const status = (invoice.status || '').trim();

    if (status === 'Draft' || status === 'In Review' || status === '') {
      // Draft -> DELETE
      await client.deleteDraftInvoice(invoiceId, invoice['@odata.etag']);
      return {
        cancellationType: 'deleted',
        message: 'Business Central üzerindeki taslak fatura silindi.',
      };
    }

    // Posted -> cancel bound action (generates corrective credit memo)
    await client.cancelInvoice(invoiceId);
    return {
      cancellationType: 'credit_memo',
      message: "BC'de düzeltici alacak dekontu oluşturuldu.",
    };
  }
}
