import { AccountingAmountMismatchError } from './AccountingErrors';
import { AccountingInvoiceRequest } from './AccountingTypes';

/**
 * Asserts that line items total minus discount equals grand total within 0.02 tolerance.
 * Provider-agnostic consistency check.
 */
export function assertTotalsMatch(request: AccountingInvoiceRequest): void {
  if (!request.items || request.items.length === 0) {
    throw new AccountingAmountMismatchError('Faturada en az bir kalem bulunmalıdır.');
  }

  const computedItemsTotal = request.items.reduce((sum, item) => sum + item.totalAmount, 0);
  const discount = request.discountTotal || 0;
  const computedGrandTotal = Number((computedItemsTotal - discount).toFixed(4));
  const declaredGrandTotal = Number(request.grandTotal.toFixed(4));

  if (Math.abs(computedGrandTotal - declaredGrandTotal) > 0.02) {
    throw new AccountingAmountMismatchError(
      `Fatura tutar uyumsuzluğu: Kalemler toplamı (${computedGrandTotal}) ile genel toplam (${declaredGrandTotal}) eşleşmiyor.`,
    );
  }
}
