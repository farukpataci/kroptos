import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
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
import { IBizimhesapClient } from './bizimhesap.client';

export class BizimhesapTestClient implements IBizimhesapClient {
  constructor(private readonly credentials: Record<string, any> = {}) {}

  async testConnection(): Promise<AccountingTestConnectionResult> {
    throw new IntegrationNotVerifiedError(
      'BIZIMHESAP',
      'BizimHesap TEST ortamı henüz doğrulanmamıştır. Yalnızca MOCK ortamı desteklenmektedir.',
    );
  }

  async createInvoice(_request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    throw new IntegrationNotVerifiedError(
      'BIZIMHESAP',
      'BizimHesap TEST ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.',
    );
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    throw new IntegrationNotVerifiedError(
      'BIZIMHESAP',
      'BizimHesap TEST ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.',
    );
  }

  async syncContact(_request: AccountingContactRequest): Promise<AccountingContactResult> {
    throw new IntegrationNotVerifiedError(
      'BIZIMHESAP',
      'BizimHesap TEST ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.',
    );
  }

  async mapProduct(_request: AccountingProductRequest): Promise<AccountingProductResult> {
    throw new IntegrationNotVerifiedError(
      'BIZIMHESAP',
      'BizimHesap TEST ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.',
    );
  }

  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    throw new IntegrationNotVerifiedError(
      'BIZIMHESAP',
      'BizimHesap TEST ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.',
    );
  }
}
