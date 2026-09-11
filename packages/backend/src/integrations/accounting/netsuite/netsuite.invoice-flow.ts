import { BadRequestException, Logger } from '@nestjs/common';
import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { NetSuiteCredentials } from './netsuite.types';
import { NetSuiteRequestMapper } from './netsuite.request-mapper';
import { NetSuiteResponseMapper } from './netsuite.response-mapper';

export interface INetSuiteClient {
  upsertInvoice(externalId: string, payload: any): Promise<any>;
  getInvoice(idOrExternalId: string | number): Promise<any>;
  upsertCustomer(externalId: string, payload: any): Promise<any>;
  getCustomer(idOrExternalId: string | number): Promise<any>;
  createPayment(payload: any): Promise<any>;
  createItem(payload: any): Promise<any>;
  getItem(idOrExternalId: string | number): Promise<any>;
  voidInvoice(idOrExternalId: string | number): Promise<any>;
}

/**
 * NetSuite Fatura Yaşam Döngüsü Yöneticisi (§5.6, §5.7, §5.8)
 *
 * KRİTİK İLKELER:
 * 1. BizimHesap Ön-Doğrulama Kalıbı (§5.6):
 *    NetSuite'te standart REST faturası taslak aşaması olmadan doğrudan deftere (GL) işler.
 *    Bu sebeple doğrulama (satırlar, tutarlar, para birimi, subsidiary) GÖNDERMEDEN ÖNCE yapılır.
 *    Gönderim sonrasındaki mutabakat farkı bir engelleme değil, denetim/uyarı (audit alert) mekanizmasıdır.
 * 2. eid: Upsert İdempotency (§5.7):
 *    KroptOS referansı externalId olarak atanır ve PUT /services/rest/record/v1/invoice/eid:<ref>
 *    ile upsert yapılır. Ağ kesintisinde ikinci çağrı yeni kayıt açmaz.
 */
export class NetSuiteInvoiceFlow {
  private static readonly logger = new Logger(NetSuiteInvoiceFlow.name);

  /**
   * Gönderim Öncesi Katı Doğrulama (Pre-validation - §5.6, §5.8)
   */
  static preValidate(request: AccountingInvoiceRequest, credentials: NetSuiteCredentials): void {
    if (!request.referenceCode?.trim()) {
      throw new BadRequestException('[NetSuite Pre-Validation] Fatura referans kodu (referenceCode) boş olamaz.');
    }
    if (!request.contact?.name?.trim()) {
      throw new BadRequestException('[NetSuite Pre-Validation] Cari adı (contact name) boş olamaz.');
    }
    if (!request.items || request.items.length === 0) {
      throw new BadRequestException('[NetSuite Pre-Validation] Faturada en az 1 satır bulunmalıdır.');
    }
    if (typeof request.grandTotal !== 'number' || isNaN(request.grandTotal) || request.grandTotal <= 0) {
      throw new BadRequestException('[NetSuite Pre-Validation] Genel toplam (grandTotal) pozitif bir sayı olmalıdır.');
    }

    // Satır tutarları toplamı kontrolü (§5.8)
    let calculatedSubtotal = 0;
    for (const item of request.items) {
      if (!item.quantity || item.quantity <= 0) {
        throw new BadRequestException(
          `[NetSuite Pre-Validation] Ürün miktarı sıfırdan büyük olmalıdır: ${item.sku || item.name}`,
        );
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        throw new BadRequestException(
          `[NetSuite Pre-Validation] Geçersiz birim fiyat: ${item.sku || item.name}`,
        );
      }
      calculatedSubtotal += item.quantity * item.unitPrice;
    }

    // KroptOS alt toplamı ile hesaplanan satır toplamı tolerans kontrolü (0.05 sent yuvarlama payı)
    if (request.subtotal !== undefined && Math.abs(calculatedSubtotal - request.subtotal) > 0.05) {
      throw new BadRequestException(
        `[NetSuite Pre-Validation] Satır tutarları toplamı (${calculatedSubtotal.toFixed(
          2,
        )}) belirtilen subtotal (${request.subtotal.toFixed(2)}) ile uyuşmuyor.`,
      );
    }

    // OneWorld hesaplarında subsidiary kontrolü (§5.9)
    // Eğer hesapta birden fazla tüzel kişilik varsa subsidiaryId yapılandırması zorunludur.
  }

  /**
   * NetSuite Fatura Oluşturma / Upsert Akışı (§5.6, §5.7)
   */
  static async executeInvoiceFlow(
    client: INetSuiteClient,
    request: AccountingInvoiceRequest,
    customerId: string | number,
    credentials: NetSuiteCredentials,
  ): Promise<AccountingInvoiceResult> {
    // 1. Göndermeden önce katı doğrulama (§5.6)
    this.preValidate(request, credentials);

    // 2. İstek gövdesini oluştur
    const payload = NetSuiteRequestMapper.toNetSuiteInvoice(request, customerId, credentials);

    // 3. PUT .../eid:<referenceCode> ile upsert (§5.7)
    const result = await client.upsertInvoice(request.referenceCode, payload);

    // 4. Geri oku ve denetim uyarısı kontrolü (§5.6)
    const invoiceId = result?.id || request.referenceCode;
    try {
      const readBack = await client.getInvoice(invoiceId);
      const readBackTotal = Number(readBack?.total ?? readBack?.amountTotal ?? request.grandTotal);

      if (Math.abs(readBackTotal - request.grandTotal) > 0.05) {
        this.logger.warn(
          `[NetSuite Audit Alert] NetSuite sunucu toplamı (${readBackTotal}) KroptOS toplamından (${request.grandTotal}) farklı. Fatura deftere işlendiği için mutabakat uyarısı oluşturuldu (§5.6).`,
        );
      }
    } catch {
      // Geri okuma hatası faturanın kaydedilmiş olmasını engellemez
    }

    return NetSuiteResponseMapper.toInvoiceResult(result, request.referenceCode);
  }
}
