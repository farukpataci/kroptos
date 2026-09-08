import { Injectable, NotImplementedException } from '@nestjs/common';
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
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { IBizimhesapClient } from './bizimhesap.client';
import { BizimhesapRequestMapper } from './bizimhesap.request-mapper';
import { BizimhesapResponseMapper } from './bizimhesap.response-mapper';
import { BizimhesapErrorMapper } from './bizimhesap.error-mapper';
import { BizimhesapApiResponse } from './bizimhesap.types';

@Injectable()
export class BizimhesapMockClient implements IBizimhesapClient {
  private static readonly invoiceStore: Map<string, AccountingInvoiceResult> = new Map();

  constructor(private readonly credentials: Record<string, any> = {}) {}

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const key = this.credentials.key || '';
    const token = this.credentials.token || '';
    const firmId = this.credentials.firmId || '';

    if (
      key.includes('TRIGGER_AUTH_FAIL') ||
      token.includes('TRIGGER_AUTH_FAIL') ||
      firmId.includes('TRIGGER_AUTH_FAIL')
    ) {
      throw new AccountingAuthError('BIZIMHESAP', 'Geçersiz API Anahtarı, Token veya Firma ID');
    }

    if (key.includes('TRIGGER_RATE_LIMIT')) {
      throw new AccountingRateLimitError('BIZIMHESAP', 30);
    }

    if (key.includes('TRIGGER_NETWORK_FAIL')) {
      throw new AccountingNetworkError('BIZIMHESAP', 'BizimHesap sunucusuna erişilemedi');
    }

    return {
      success: true,
      message: 'BizimHesap bağlantısı başarılı (MOCK)',
      companyName: 'BizimHesap Mock Firma',
      companyId: firmId || 'mock-firm-id',
      environment: 'MOCK',
    };
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    const ref = request.referenceCode || '';

    // Trigger checks
    if (ref.includes('TRIGGER_AUTH_FAIL')) {
      throw new AccountingAuthError('BIZIMHESAP', 'Yetkilendirme hatası');
    }
    if (ref.includes('TRIGGER_RATE_LIMIT')) {
      throw new AccountingRateLimitError('BIZIMHESAP', 60);
    }
    if (ref.includes('TRIGGER_NETWORK_FAIL') || ref.includes('TRIGGER_TIMEOUT')) {
      throw new AccountingNetworkError('BIZIMHESAP', 'İstek zaman aşımına uğradı (timeout)');
    }

    // Trigger HTTP 200 with populated error string
    if (ref.includes('TRIGGER_200_FAILURE')) {
      BizimhesapErrorMapper.checkApiResponse({
        error: 'BizimHesap iş mantığı hatası (HTTP 200 OK)',
        guid: '',
        url: '',
      });
    }

    // Trigger corrupted response (both error and guid are empty)
    if (ref.includes('TRIGGER_CORRUPTED_RESPONSE')) {
      BizimhesapErrorMapper.checkApiResponse({
        error: '',
        guid: '',
        url: '',
      });
    }

    // Validate payload (customer title/address, currency, Decimal calculations)
    const firmId = this.credentials.firmId || request.companyId;
    const payload = BizimhesapRequestMapper.toInvoicePayload(request, firmId);

    // Mock response simulation
    const mockGuid = `bh-guid-${Math.floor(100000 + Math.random() * 900000)}`;
    const mockUrl = `https://bizimhesap.com/invoice/view/${mockGuid}`;

    const apiResponse: BizimhesapApiResponse = {
      error: '',
      guid: mockGuid,
      url: mockUrl,
    };

    BizimhesapErrorMapper.checkApiResponse(apiResponse);

    const result = BizimhesapResponseMapper.toInvoiceResult(apiResponse, payload.invoiceNo);
    BizimhesapMockClient.invoiceStore.set(ref, result);
    return result;
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    throw new NotImplementedException(
      'BizimHesap B2B API üzerinde tahsilat / ödeme kaydı ucu bulunmamaktadır (NOT_SUPPORTED).',
    );
  }

  async syncContact(_request: AccountingContactRequest): Promise<AccountingContactResult> {
    throw new NotImplementedException(
      'BizimHesap B2B API üzerinde bağımsız cari oluşturma ucu bulunmamaktadır. Cari, fatura oluşturulduğunda otomatik oluşturulur (NOT_SUPPORTED).',
    );
  }

  async mapProduct(_request: AccountingProductRequest): Promise<AccountingProductResult> {
    throw new NotImplementedException(
      'BizimHesap B2B API üzerinde ürün oluşturma ucu bulunmamaktadır (NOT_SUPPORTED).',
    );
  }

  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    throw new NotImplementedException(
      'BizimHesap B2B API üzerinde fatura referans sorgulama ucu bulunmamaktadır (NOT_SUPPORTED).',
    );
  }

  static resetStore(): void {
    this.invoiceStore.clear();
  }
}
