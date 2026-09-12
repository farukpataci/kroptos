import { AccountingInvoiceRequest, AccountingInvoiceResult } from '../core/AccountingTypes';
import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import { IFreeAgentClient } from './freeagent.client';
import { FreeAgentRequestMapper, FreeAgentRequestMapperOptions } from './freeagent.request-mapper';
import { FreeAgentResponseMapper } from './freeagent.response-mapper';
import { FreeAgentReconciliationResult } from './freeagent.types';

export class FreeAgentInvoiceFlow {
  /**
   * §5.3 Sunucu tarafından hesaplanan FreeAgent total_value ile KroptOS sipariş toplamını mutabakat eder.
   */
  static reconcile(
    kroptosTotal: number,
    freeagentTotal: number,
    currency = 'GBP',
  ): FreeAgentReconciliationResult {
    const diff = Math.abs(freeagentTotal - kroptosTotal);
    const matched = diff < 0.01; // Para birimi kuruş/sent yuvarlama toleransı

    return {
      matched,
      kroptosTotal,
      freeagentTotal,
      diff: Number(diff.toFixed(2)),
      currency,
      reason: matched
        ? undefined
        : `FreeAgent sunucu toplamı (${freeagentTotal.toFixed(2)} ${currency}) KroptOS sipariş toplamıyla (${kroptosTotal.toFixed(2)} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Fatura taslak (Draft) olarak FreeAgent'ta bekletildi; kesinleştirilmedi (§5.3).`,
    };
  }

  /**
   * §5.2 & §5.3 Zorunlu Fatura Yaşam Döngüsü:
   * 1. Faturayı Draft olarak oluştur (POST /invoices)
   * 2. Geri oku -> total_value (GET /invoices/:id)
   * 3. MUTABAKAT: total_value ≟ KroptOS sipariş toplamı
   *    - Tutmuyor -> YÜKSELTME. Taslak FreeAgent'ta kalır, AccountingAmountMismatchError fırlatılır.
   *    - Tutuyor  -> 4. adıma geç.
   * 4. PUT /invoices/:id/transitions/mark_as_sent
   *    - Yan etkisiz durum geçişidir; müşteriye e-posta GÖNDERMEZ (§5.2).
   *    - Asla POST /send_email veya mark_as_scheduled çağrılmaz.
   * 5. Kesinleşen faturayı tekrar oku ve sonuç nesnesini döndür.
   */
  static async executeCreateInvoice(
    client: IFreeAgentClient,
    request: AccountingInvoiceRequest,
    options: FreeAgentRequestMapperOptions,
  ): Promise<AccountingInvoiceResult> {
    // 1. Faturayı taslak olarak oluştur (Hesaplanan alanlar istekte yer almaz)
    const draftPayload = FreeAgentRequestMapper.toCreateInvoice(request, options);
    const draft = await client.createDraftInvoice(draftPayload);

    const invoiceId = draft.url || draft.id;
    if (!invoiceId) {
      throw new Error('[FreeAgent InvoiceFlow] Taslak fatura kimliği veya URL alınamadı.');
    }

    // 2. Geri oku -> Sunucunun hesapladığı tutarlar
    const readBackDraft = await client.getInvoice(invoiceId);
    const freeagentTotal = Number(readBackDraft.total_value ?? 0);
    const kroptosTotal = request.grandTotal;

    // 3. Mutabakat
    const recon = this.reconcile(kroptosTotal, freeagentTotal, request.currency || 'GBP');

    if (!recon.matched) {
      // MUTABAKAT TUTMADI: Yükseltme YAPMA (§5.3). Fatura Draft kalır.
      throw new AccountingAmountMismatchError(recon.reason!);
    }

    // 4. Mutabakat tuttu: PUT transitions/mark_as_sent çağrısı ile kesinleştir (§5.2)
    const sentInvoice = await client.transitionInvoice(invoiceId, 'mark_as_sent');

    const operatorNote =
      'Fatura FreeAgent üzerinde oluşturuldu, sunucu tutar mutabakatı doğrulandı ve başarıyla kesinleştirildi (mark_as_sent). Güvenlik kuralı gereği müşteriye e-posta gönderimi yapılmamıştır (§5.2).';

    return FreeAgentResponseMapper.toInvoiceResult(sentInvoice, {
      reconciled: true,
      operatorNote,
      transition: 'mark_as_sent',
    });
  }
}
