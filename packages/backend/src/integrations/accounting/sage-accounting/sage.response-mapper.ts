import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import {
  AccountingContactResult,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import { SageContact, SageSalesInvoice } from './sage.types';

export class SageResponseMapper {
  /**
   * §4.6 Reconciles Sage calculated total against KroptOS request grandTotal.
   * Tolerates up to 0.05 rounding difference (zero tolerance policy).
   */
  static reconcileTotals(
    sageInvoice: SageSalesInvoice,
    request: AccountingInvoiceRequest,
  ): void {
    const sageTotal = Number(sageInvoice.total_amount || 0);
    const expectedTotal = Number(request.grandTotal || 0);

    const diff = Math.abs(sageTotal - expectedTotal);
    if (diff > 0.05) {
      throw new AccountingAmountMismatchError(
        `[sage-accounting] Fatura tutar mutabakatı başarısız: KroptOS toplamı (${expectedTotal}) ile Sage tarafından hesaplanan toplam (${sageTotal}) uyuşmuyor (Fark: ${diff.toFixed(2)}).`,
      );
    }
  }

  static toInvoiceResult(sageInvoice: SageSalesInvoice): AccountingInvoiceResult {
    return {
      externalId: sageInvoice.id,
      externalNumber: sageInvoice.displayed_as || sageInvoice.invoice_number,
      rawResponse: sageInvoice,
    };
  }

  static toContactResult(sageContact: SageContact): AccountingContactResult {
    return {
      externalId: sageContact.id,
      rawResponse: sageContact,
    };
  }

  static toProductResult(sku: string, sageProduct?: any): AccountingProductResult {
    return {
      externalId: sageProduct?.id || `sage-prod-${sku}`,
      code: sku,
      rawResponse: sageProduct,
    };
  }
}
