import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import { IFortnoxClient } from './fortnox.client';
import { FortnoxFinancialYearService } from './fortnox.financial-year';
import { FortnoxRequestMapper } from './fortnox.request-mapper';
import { FortnoxResponseMapper } from './fortnox.response-mapper';
import { FortnoxConfig } from './fortnox.types';

export interface FortnoxReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  fortnoxTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}

export class FortnoxInvoiceFlow {
  /**
   * Reconciles Fortnox server-calculated total with KroptOS order grand total (§5.4).
   * Tolerance: 0.05 SEK (rounding differences in Swedish krona ore).
   */
  static reconcile(
    kroptosTotal: number,
    fortnoxTotal: number,
    currency = 'SEK',
  ): FortnoxReconciliationResult {
    const diff = Math.abs(fortnoxTotal - kroptosTotal);
    const matched = diff <= 0.05;

    return {
      matched,
      kroptosTotal,
      fortnoxTotal,
      diff: Number(diff.toFixed(2)),
      currency,
      reason: matched
        ? undefined
        : `Fortnox sunucu toplamı (${fortnoxTotal.toFixed(2)} ${currency}) KroptOS sipariş toplamıyla (${kroptosTotal.toFixed(2)} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Fatura kaydedilmemiş (unbooked) olarak Fortnox'ta bırakıldı, deftere kaydedilmedi.`,
    };
  }

  /**
   * §5.4 Mandatory Invoice Flow:
   * 1. Check financial year for invoice date (§5.6) -> fail early if no open year
   * 2. POST /3/invoices -> create draft invoice
   * 3. GET /3/invoices/{DocumentNumber} -> read back server-calculated totals
   * 4. MUTABAKAT (Reconciliation):
   *    - Matched: Proceed to bookkeep
   *    - Mismatched: ABORT bookkeep! Leave invoice unbooked in Fortnox, throw AccountingAmountMismatchError
   * 5. PUT /3/invoices/{DocumentNumber}/bookkeep -> finalize document
   * 6. GET /3/invoices/{DocumentNumber} -> read back finalized document
   */
  static async executeCreateInvoice(
    client: IFortnoxClient,
    request: AccountingInvoiceRequest,
    config?: Partial<FortnoxConfig>,
  ): Promise<AccountingInvoiceResult> {
    // 1. Financial Year Pre-validation (§5.6)
    await FortnoxFinancialYearService.validateFinancialYearForDate(
      client,
      request.issueDate,
    );

    // 2. Build draft payload
    const draftPayload = FortnoxRequestMapper.toFortnoxInvoice(request, config);

    // 3. Create draft invoice in Fortnox
    const created = await client.createInvoice(draftPayload);
    const documentNumber = created.DocumentNumber!;

    // 4. Read back server-calculated totals
    const readBack = await client.getInvoice(documentNumber);

    const fortnoxTotal = readBack.Total ?? 0;
    const kroptosTotal = request.grandTotal;
    const currency = readBack.Currency || request.currency || 'SEK';

    // 5. Reconcile
    const reconciliation = this.reconcile(kroptosTotal, fortnoxTotal, currency);

    if (!reconciliation.matched) {
      // DO NOT BOOKKEEP (§5.4). Leaves invoice unbooked, notifies operator.
      throw new AccountingAmountMismatchError(reconciliation.reason!);
    }

    // 6. Bookkeep (finalize) invoice
    const bookkept = await client.bookkeepInvoice(documentNumber);

    // 7. Map to standardized result
    return FortnoxResponseMapper.toInvoiceResult(bookkept);
  }
}
