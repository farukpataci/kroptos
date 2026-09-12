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
import { ILogoRestClient } from './logo-rest.client';

/**
 * Sıfır ağ. Logo alan adları burada bile geçmez — çekirdeğe sızmasın diye (§5.6).
 * Mock kimlikler açıkça "mock-" önekli; gerçek belge no üretilmez (§12).
 */
export class LogoRestMockClient implements ILogoRestClient {
  private static readonly invoiceStore = new Map<string, AccountingInvoiceResult>();
  private static readonly contactStore = new Map<string, string>();
  private static readonly productStore = new Map<string, string>();
  private static seq = 0;

  constructor(private readonly credentials: Record<string, any> = {}) {}

  private firmNo(): string {
    return String(this.credentials.companyId || '1');
  }

  private triggers(ref: string): void {
    if (ref.includes('TRIGGER_AUTH_FAIL')) throw new AccountingAuthError('LOGO-REST', 'Kimlik reddedildi');
    if (ref.includes('TRIGGER_RATE_LIMIT')) throw new AccountingRateLimitError('LOGO-REST', 30);
    if (ref.includes('TRIGGER_NETWORK_FAIL')) throw new AccountingNetworkError('LOGO-REST', 'REST servisine erişilemedi');
  }

  private id(prefix: string): string {
    return `mock-${prefix}-${this.firmNo()}-${++LogoRestMockClient.seq}`;
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    this.triggers(String(this.credentials.clientSecret || ''));
    return {
      success: true,
      message: `Logo REST Servis bağlantısı simüle edildi (firma ${this.firmNo()}, MOCK)`,
      companyName: `Logo Firma ${this.firmNo()}`,
      companyId: this.firmNo(),
      environment: 'MOCK',
    };
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    const ref = request.referenceCode || '';
    this.triggers(ref);
    if (!request.items?.length) throw new AccountingApiError('LOGO-REST', 400, 'Fatura satırı yok');

    const key = `${this.firmNo()}:${ref}`;
    const existing = LogoRestMockClient.invoiceStore.get(key);
    if (existing) return existing;

    const result: AccountingInvoiceResult = {
      externalId: this.id('inv'),
      rawResponse: { mock: true, firmno: this.firmNo(), referenceCode: ref },
    };
    LogoRestMockClient.invoiceStore.set(key, result);
    return result;
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    this.triggers(request.referenceCode || '');
    if (request.amount <= 0) throw new AccountingApiError('LOGO-REST', 400, 'Tahsilat tutarı pozitif olmalı');
    return { externalId: this.id('pay'), rawResponse: { mock: true, invoice: request.invoiceExternalId } };
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    this.triggers(request.kroptosKey || '');
    // Eşleştirme anahtarı VKN/TCKN, yoksa kroptosKey; isim asla anahtar değil (§7.4)
    const key = `${this.firmNo()}:${request.taxNumber || request.kroptosKey}`;
    let id = LogoRestMockClient.contactStore.get(key);
    if (!id) {
      id = this.id('arp');
      LogoRestMockClient.contactStore.set(key, id);
    }
    return { externalId: id, rawResponse: { mock: true } };
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    const key = `${this.firmNo()}:${request.sku}`;
    let id = LogoRestMockClient.productStore.get(key);
    if (!id) {
      id = this.id('item');
      LogoRestMockClient.productStore.set(key, id);
    }
    return { externalId: id, code: request.code || request.sku, rawResponse: { mock: true } };
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return LogoRestMockClient.invoiceStore.get(`${this.firmNo()}:${referenceCode}`) ?? null;
  }

  static resetStore(): void {
    this.invoiceStore.clear();
    this.contactStore.clear();
    this.productStore.clear();
    this.seq = 0;
  }
}
