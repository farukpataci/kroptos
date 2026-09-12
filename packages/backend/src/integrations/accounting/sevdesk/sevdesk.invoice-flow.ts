import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import { ISevdeskClient } from './sevdesk.client';
import { SevdeskRequestMapper } from './sevdesk.request-mapper';
import { SevdeskResponseMapper } from './sevdesk.response-mapper';
import { SevdeskReconciliationResult } from './sevdesk.types';

export class SevdeskInvoiceFlow {
  /**
   * §5.1 Reconciles sevDesk server calculated total with KroptOS order total.
   */
  static reconcile(
    kroptosTotal: number,
    sevdeskTotal: number,
    currency = 'EUR',
  ): SevdeskReconciliationResult {
    const diff = Math.abs(sevdeskTotal - kroptosTotal);
    const matched = diff < 0.01; // Rounding tolerance for EUR cents

    return {
      matched,
      kroptosTotal,
      sevdeskTotal,
      diff: Number(diff.toFixed(2)),
      currency,
      reason: matched
        ? undefined
        : `sevDesk sunucu toplamı (${sevdeskTotal.toFixed(2)} ${currency}) KroptOS sipariş toplamıyla (${kroptosTotal.toFixed(2)} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Fatura taslak olarak sevDesk'te bekletildi, onaylanmadı.`,
    };
  }

  /**
   * §5.1 & §5.2 Mandatory Lifecycle Flow:
   * 1. Factory ile taslak oluştur (Invoice/Factory/saveInvoice, status 100)
   * 2. Geri oku -> sunucunun hesapladığı toplamlar (GET /Invoice/{id})
   * 3. MUTABAKAT: toplam ≟ KroptOS sipariş toplamı
   *    - Tutmuyor -> YÜKSELTME. Taslak sevDesk'te durur, AccountingAmountMismatchError fırlatılır.
   *    - Tutuyor  -> §5.2 kuralı uyarınca: sendViaEmail çağrılmaz (kesinlikle yasak).
   *                 Fatura güvenli şekilde Taslak (Draft 100) olarak kalır, KroptOS durumu 'pending'dir.
   * 4. Sonuç ve operatör notu döndürülür.
   */
  static async executeCreateInvoice(
    client: ISevdeskClient,
    request: AccountingInvoiceRequest,
  ): Promise<AccountingInvoiceResult> {
    const draftPayload = SevdeskRequestMapper.toCreateInvoice(request);

    // 1. Create Draft via Factory
    const draft = await client.createDraftInvoice(draftPayload);

    // 2. Read back server-calculated invoice
    const readBackDraft = await client.getInvoice(draft.id);

    const sevdeskTotal = Number(readBackDraft.sumGross || readBackDraft.sumGrossAccounting || 0);
    const kroptosTotal = request.grandTotal;

    // 3. Reconcile totals
    const reconciliation = this.reconcile(kroptosTotal, sevdeskTotal, request.currency || 'EUR');

    if (!reconciliation.matched) {
      // DO NOT ELEVATE. Stays draft in sevDesk (§5.1).
      throw new AccountingAmountMismatchError(reconciliation.reason!);
    }

    // 4. Safe Return: In accordance with §5.2, invoice stays in Draft status.
    const operatorNote =
      'Fatura sevDesk üzerinde başarıyla taslak (Draft) olarak oluşturuldu ve tutar mutabakatı sağlandı. Müşteriye izinsiz e-posta gönderimini önlemek amacıyla belge taslak olarak bırakılmıştır; resmi gönderim sevDesk paneli üzerinden yürütülmelidir.';

    return SevdeskResponseMapper.toInvoiceResult(readBackDraft, {
      reconciled: true,
      operatorNote,
    });
  }
}
