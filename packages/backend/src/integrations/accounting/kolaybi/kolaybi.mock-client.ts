import { Injectable } from '@nestjs/common';
import {
  AccountingContactRequest,
  AccountingContactResult,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingPaymentRequest,
  AccountingPaymentResult,
  AccountingProductRequest,
  AccountingProductResult,
  AccountingTestConnectionResult,
} from '../core/AccountingTypes';
import {
  AccountingApiError,
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { IKolaybiClient } from './kolaybi.client';
import { KolaybiRequestMapper } from './kolaybi.request-mapper';
import { KolaybiResponseMapper } from './kolaybi.response-mapper';
import { KolaybiErrorMapper } from './kolaybi.error-mapper';
import { KolaybiApiResponse, KolaybiInvoiceData } from './kolaybi.types';

@Injectable()
export class KolaybiMockClient implements IKolaybiClient {
  private static readonly invoiceStore: Map<string, AccountingInvoiceResult> = new Map();
  private static readonly contactStore: Map<string, string> = new Map();
  private static readonly productStore: Map<string, string> = new Map();

  constructor(private readonly credentials: Record<string, any> = {}) {}

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const apiKey = this.credentials.apiKey || '';
    if (apiKey.includes('TRIGGER_AUTH_FAIL') || apiKey === 'INVALID_KEY') {
      throw new AccountingAuthError('KOLAYBI', 'Geçersiz API Anahtarı');
    }

    if (apiKey.includes('TRIGGER_RATE_LIMIT')) {
      throw new AccountingRateLimitError('KOLAYBI', 30);
    }

    if (apiKey.includes('TRIGGER_NETWORK_FAIL')) {
      throw new AccountingNetworkError('KOLAYBI', 'KolayBi sunucusuna erişilemedi');
    }

    return {
      success: true,
      message: "KolayBi' bağlantısı başarılı (MOCK)",
      companyName: this.credentials.channel || 'KolayBi Test Firması',
      companyId: this.credentials.channel || 'test-channel',
      environment: 'MOCK',
    };
  }

  async createInvoice(
    request: AccountingInvoiceRequest,
    defaultRetailContactId?: string | null,
  ): Promise<AccountingInvoiceResult> {
    const ref = request.referenceCode || '';

    // Check trigger flags
    if (ref.includes('TRIGGER_AUTH_FAIL')) {
      throw new AccountingAuthError('KOLAYBI', 'Oturum süresi doldu veya yetkisiz erişim');
    }
    if (ref.includes('TRIGGER_RATE_LIMIT')) {
      throw new AccountingRateLimitError('KOLAYBI', 60);
    }
    if (ref.includes('TRIGGER_NETWORK_FAIL')) {
      throw new AccountingNetworkError('KOLAYBI', 'Bağlantı zaman aşımına uğradı');
    }
    if (ref.includes('TRIGGER_200_FAILURE')) {
      KolaybiErrorMapper.checkApiResponse({
        success: false,
        message: 'KolayBi iş mantığı hatası (HTTP 200 OK)',
      });
    }

    // Mapping and validations (vat_rate closed set, math verification, TCKN)
    const payload = KolaybiRequestMapper.toInvoicePayload(request, defaultRetailContactId);

    // Check idempotency in store
    const existing = KolaybiMockClient.invoiceStore.get(ref);
    if (existing) {
      return existing;
    }

    const mockId = `kb-inv-${Math.floor(100000 + Math.random() * 900000)}`;
    const mockNumber = `KBI-${ref}`;

    const apiResponse: KolaybiApiResponse<KolaybiInvoiceData> = {
      success: true,
      message: 'Fatura başarıyla oluşturuldu',
      data: {
        id: mockId,
        invoice_no: mockNumber,
        status: 'draft',
        total: request.grandTotal,
        currency: payload.currency,
        created_at: new Date().toISOString(),
      },
    };

    const result = KolaybiResponseMapper.toInvoiceResult(apiResponse);
    KolaybiMockClient.invoiceStore.set(ref, result);
    return result;
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    const ref = request.referenceCode || '';

    if (ref.includes('TRIGGER_PAYMENT_FAIL')) {
      throw new AccountingApiError('KOLAYBI', 400, 'Fatura bakiyesinden yüksek tahsilat tutarı');
    }
    if (ref.includes('TRIGGER_AUTH_FAIL')) {
      throw new AccountingAuthError('KOLAYBI', 'Yetkilendirme hatası');
    }

    KolaybiRequestMapper.toPaymentPayload(request);

    const mockId = `kb-pay-${Math.floor(100000 + Math.random() * 900000)}`;
    return KolaybiResponseMapper.toPaymentResult({
      success: true,
      message: 'Tahsilat kaydedildi',
      data: {
        id: mockId,
        invoice_id: request.invoiceExternalId,
        amount: request.amount,
      },
    });
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    if (request.kroptosKey.includes('TRIGGER_AUTH_FAIL')) {
      throw new AccountingAuthError('KOLAYBI', 'Yetkilendirme hatası');
    }

    KolaybiRequestMapper.toContactPayload(request);

    const existingId = KolaybiMockClient.contactStore.get(request.kroptosKey);
    if (existingId) {
      return {
        externalId: existingId,
        rawResponse: { success: true, message: 'Mevcut cari getirildi', data: { id: existingId } },
      };
    }

    const mockId = `kb-cont-${Math.floor(100000 + Math.random() * 900000)}`;
    KolaybiMockClient.contactStore.set(request.kroptosKey, mockId);

    return KolaybiResponseMapper.toContactResult({
      success: true,
      message: 'Cari başarıyla oluşturuldu',
      data: {
        id: mockId,
        name: request.name,
        identity_no: request.taxNumber || '11111111111',
      },
    });
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    KolaybiRequestMapper.toProductPayload(request);

    const existingId = KolaybiMockClient.productStore.get(request.sku);
    if (existingId) {
      return {
        externalId: existingId,
        code: request.sku,
        rawResponse: { success: true, data: { id: existingId, code: request.sku } },
      };
    }

    const mockId = `kb-prod-${Math.floor(100000 + Math.random() * 900000)}`;
    KolaybiMockClient.productStore.set(request.sku, mockId);

    return KolaybiResponseMapper.toProductResult({
      success: true,
      message: 'Ürün eşlendi',
      data: {
        id: mockId,
        code: request.sku,
        name: request.name,
        quantity: 0,
      },
    });
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return KolaybiMockClient.invoiceStore.get(referenceCode) || null;
  }

  static resetStore(): void {
    this.invoiceStore.clear();
    this.contactStore.clear();
    this.productStore.clear();
  }
}
