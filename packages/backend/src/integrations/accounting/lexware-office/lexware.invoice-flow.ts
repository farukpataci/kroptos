import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import { ILexwareClient } from './lexware.client';
import { LexwareRequestMapper } from './lexware.request-mapper';
import { LexwareResponseMapper } from './lexware.response-mapper';
import { LexwareReconciliationResult } from './lexware.types';
import { LexwareVersionLock } from './lexware.version-lock';

export class LexwareInvoiceFlow {
  /**
   * Reconciles Lexware server calculated total with KroptOS order total (§5.2).
   */
  static reconcile(
    kroptosTotal: number,
    lexwareTotal: number,
    currency = 'EUR',
  ): LexwareReconciliationResult {
    const diff = Math.abs(lexwareTotal - kroptosTotal);
    const matched = diff < 0.01; // Rounding tolerance for EUR cents

    return {
      matched,
      kroptosTotal,
      lexwareTotal,
      diff: Number(diff.toFixed(2)),
      currency,
      reason: matched
        ? undefined
        : `Lexware toplamı (${lexwareTotal.toFixed(2)} ${currency}) KroptOS sipariş toplamıyla (${kroptosTotal.toFixed(2)} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Fatura taslak olarak Lexware'de bekletildi, kesinleştirilmedi.`,
    };
  }

  /**
   * §5.2 Mandatory Lifecycle Flow:
   * 1. POST /v1/invoices -> DRAFT invoice (finalize=true is NEVER used)
   * 2. GET /v1/invoices/{id} -> Read back server calculated totals
   * 3. RECONCILIATION:
   *    - Matched: Proceed to finalize with optimistic version lock
   *    - Mismatched: ABORT finalization! Leave draft in Lexware, throw AccountingAmountMismatchError
   * 4. Finalize with current version
   * 5. Return result with official voucherNumber
   */
  static async executeCreateInvoice(
    client: ILexwareClient,
    request: AccountingInvoiceRequest,
  ): Promise<AccountingInvoiceResult> {
    const draftPayload = LexwareRequestMapper.toCreateInvoice(request);

    // 1. Create Draft
    const draft = await client.createDraftInvoice(draftPayload);

    // 2. Read back server-calculated invoice
    const readBackDraft = await client.getInvoice(draft.id);

    const lexwareTotal = readBackDraft.totalPrice?.totalGrossAmount ?? 0;
    const kroptosTotal = request.grandTotal;

    // 3. Reconcile totals
    const reconciliation = this.reconcile(kroptosTotal, lexwareTotal, request.currency || 'EUR');

    if (!reconciliation.matched) {
      // DO NOT FINALIZE. Stays draft in Lexware (§5.2).
      throw new AccountingAmountMismatchError(reconciliation.reason!);
    }

    // 4. Finalize with Optimistic Version Lock (§3.4, §5.8)
    const finalized = await LexwareVersionLock.executeWithVersion(
      () => client.getInvoice(draft.id),
      (current) => client.finalizeInvoice(current.id, current.version),
    );

    // 5. Response mapping
    return LexwareResponseMapper.toInvoiceResult(finalized, {
      reconciled: true,
      finalized: true,
    });
  }
}
