import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { CegidRequestMapper, CegidMappingContext } from './cegid.request-mapper';
import { CegidResponseMapper } from './cegid.response-mapper';
import { CegidSalesInvoice } from './cegid.types';

export interface ICegidClient {
  createInvoice(dto: CegidSalesInvoice): Promise<CegidSalesInvoice>;
  getInvoice(referenceNbr: string): Promise<CegidSalesInvoice>;
  releaseInvoice(referenceNbr: string): Promise<void>;
  findInvoiceByReference?(referenceNbr: string): Promise<CegidSalesInvoice | null>;
}

export interface CegidReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  cegidTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}

export class CegidInvoiceFlow {
  /**
   * KroptOS sipariş toplamı ile Cegid XRP Flex sunucusunun hesapladığı tutarı mutabık kılar (§6.4).
   * Tolerans: 0.05 para birimi (kuruş yuvarlama).
   */
  static reconcile(
    kroptosTotal: number,
    cegidTotal: number,
    currency = 'EUR',
  ): CegidReconciliationResult {
    const diff = Math.abs(cegidTotal - kroptosTotal);
    const matched = diff <= 0.05;

    return {
      matched,
      kroptosTotal,
      cegidTotal,
      diff: Number(diff.toFixed(4)),
      currency,
      reason: matched
        ? undefined
        : `Cegid XRP Flex sunucu toplamı (${cegidTotal} ${currency}) KroptOS sipariş toplamıyla (${kroptosTotal} ${currency}) uyuşmuyor: fark ${diff.toFixed(
            2,
          )} ${currency}. Fatura taslak (Hold) durumunda bekletiliyor, kesinleştirilmedi (serbest bırakılmadı).`,
    };
  }

  /**
   * Fatura yaşam döngüsünü yürütür (§2.e, §6.4):
   * 1. Taslak olarak oluştur (Hold: true).
   * 2. Geri oku (sunucunun hesapladığı Amount ve TaxTotal'ı al).
   * 3. Mutabakat kontrolü yap:
   *    - Fark > 0.05 ise: KESİNLEŞTİRME! Taslak olarak bırak, mutabakat uyuşmazlığı raporla.
   *    - Fark <= 0.05 ise: ReleaseInvoice eylemini çağırarak faturayı kesinleştir (Open/Closed).
   */
  static async executeCreateInvoice(params: {
    client: ICegidClient;
    request: AccountingInvoiceRequest | any;
    context?: CegidMappingContext;
  }): Promise<AccountingInvoiceResult> {
    const { client, request, context } = params;

    // 1. DTO'yu Cegid SalesInvoice modeline çevir (Hold: true taslak olarak)
    const payload = CegidRequestMapper.toCegidSalesInvoice(request, context);

    // 2. Taslak faturayı oluştur
    const createdDoc = await client.createInvoice(payload);
    const refNbr =
      createdDoc.ReferenceNbr?.value || createdDoc.id;

    if (!refNbr) {
      throw new Error(
        '[Cegid] Oluşturulan faturadan referans numarası (ReferenceNbr) alınamadı.',
      );
    }

    // 3. Faturayı geri oku (sunucu tutarlarını almak için)
    const draftDoc = await client.getInvoice(refNbr);

    // 4. Mutabakat kontrolü
    const kroptosTotal =
      typeof request.grandTotal === 'number'
        ? request.grandTotal
        : typeof request.totalAmount === 'number'
        ? request.totalAmount
        : (request.items || request.lines || []).reduce(
            (sum: number, l: any) => sum + (l.unitPrice || 0) * (l.quantity || 1),
            0,
          );


    const cegidTotal = Number(draftDoc.Amount?.value ?? 0);
    const recon = this.reconcile(kroptosTotal, cegidTotal, request.currency || 'EUR');

    if (!recon.matched) {
      // Mutabakat tutmadı: Faturayı serbest bırakma, taslakta bırak
      return CegidResponseMapper.toInvoiceResult(draftDoc, {
        providerStatus: 'Hold',
        reconciliationMismatch: true,
        reconciliationDiff: recon.diff,
        reconciliationMessage: recon.reason,
        cegidTotal: recon.cegidTotal,
        kroptosTotal: recon.kroptosTotal,
      });
    }

    // 5. Mutabakat tuttu: ReleaseInvoice eylemini çağırarak faturayı kesinleştir (§6.4)
    await client.releaseInvoice(refNbr);

    // 6. Kesinleşmiş faturayı tekrar oku
    const postedDoc = await client.getInvoice(refNbr);
    const finalStatus = postedDoc.Status?.value || 'Open';

    return CegidResponseMapper.toInvoiceResult(postedDoc, {
      providerStatus: finalStatus,
      reconciliationMatched: true,
      cegidTotal: recon.cegidTotal,
      kroptosTotal: recon.kroptosTotal,
    });
  }
}
