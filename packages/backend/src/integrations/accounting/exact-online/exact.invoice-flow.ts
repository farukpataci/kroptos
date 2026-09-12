import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { ExactBudgetManager } from './exact.budget';
import { IExactClient } from './exact.client';
import { ExactRequestMapper } from './exact.request-mapper';
import { ExactResponseMapper } from './exact.response-mapper';
import { ExactReconciliationResult, ExactSalesInvoice } from './exact.types';

export class ExactInvoiceFlow {
  constructor(private readonly budgetManager: ExactBudgetManager) {}

  /**
   * §5.6 Sunucu toplamı ile KroptOS sipariş tutarını karşılaştırır (Reconciliation).
   */
  reconcile(
    kroptosTotal: number,
    exactTotal: number,
    currency: string = 'EUR',
    tolerance: number = 0.05,
  ): ExactReconciliationResult {
    const diff = Math.abs(exactTotal - kroptosTotal);
    const isMatch = diff <= tolerance;

    return {
      isMatch,
      diff,
      kroptosTotal,
      exactTotal,
      message: isMatch
        ? `Exact Online tutar mutabakatı başarılı (Fark: ${diff.toFixed(2)} ${currency}).`
        : `Exact Online sunucu toplamı (${exactTotal.toFixed(2)} ${currency}) KroptOS sipariş toplamıyla (${kroptosTotal.toFixed(2)} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}.`,
    };
  }

  /**
   * Exact Online 3 adımlı güvenli fatura akışı (§2.1, §5.2, §5.6):
   * 1. Bütçe ön denetimi (2 çağrı: POST oluşturma + GET mutabakat).
   * 2. Bölüm bazında Eşzamanlılık 1 (runSequential).
   * 3. POST /salesinvoice/SalesInvoices ile faturayı oluştur.
   * 4. GET ile oluşturulan faturayı geri oku (Exact Online tarafından hesaplanan AmountDC).
   * 5. Mutabakat kontrolü yap.
   */
  async executeCreateInvoice(
    client: IExactClient,
    division: number | string,
    request: AccountingInvoiceRequest,
    customerId: string,
  ): Promise<AccountingInvoiceResult> {
    // 1. Bütçe Ön Kontrolü: 2 çağrı ayrılmalıdır (oluştur + geri oku)
    const budgetCheck = this.budgetManager.canExecute(division, 2, 'WRITE');
    if (!budgetCheck.allowed) {
      throw new Error(
        budgetCheck.message ||
          `Exact Online çağrı bütçesi yetersiz (${budgetCheck.reason}). İş ertelenmelidir.`,
      );
    }

    // 2. Seri Çalıştırma (Bölüm başına eşzamanlılık 1)
    return this.budgetManager.runSequential(division, async () => {
      // 3. Faturayı POST ile oluştur
      const payload = ExactRequestMapper.toSalesInvoice(request, customerId);
      const createdDraft = await client.createSalesInvoice(division, payload);

      const invoiceId = createdDraft.InvoiceID;
      if (!invoiceId) {
        throw new Error('Exact Online fatura oluşturuldu ancak InvoiceID GUID değeri dönmedi.');
      }

      // 4. GET ile faturayı geri oku (sunucu hesaplama değerlerini mutabakat için al)
      const readBackInvoice: ExactSalesInvoice = await client.getSalesInvoice(
        division,
        invoiceId,
      );

      // 5. Tutar Mutabakatı (Reconciliation)
      const exactTotal = Number(readBackInvoice.AmountDC || 0);
      const kroptosTotal = Number(request.grandTotal || 0);
      const reconciliation = this.reconcile(
        kroptosTotal,
        exactTotal,
        request.currency || 'EUR',
      );

      if (!reconciliation.isMatch) {
        console.warn(`[ExactInvoiceFlow] ${reconciliation.message}`);
      }

      return ExactResponseMapper.toInvoiceResult(readBackInvoice, {
        reconciliation,
      });
    });
  }
}
