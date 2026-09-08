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
import { IKolaybiClient } from './kolaybi.client';

export class KolaybiProductionClient implements IKolaybiClient {
  constructor(private readonly credentials: Record<string, any> = {}) {}

  async testConnection(): Promise<AccountingTestConnectionResult> {
    throw new IntegrationNotVerifiedError(
      'KOLAYBI',
      "KolayBi' PRODUCTION ortamı henüz doğrulanmamıştır. Yalnızca MOCK ortamı desteklenmektedir.",
    );
  }

  async createInvoice(
    _request: AccountingInvoiceRequest,
    _defaultRetailContactId?: string | null,
  ): Promise<AccountingInvoiceResult> {
    throw new IntegrationNotVerifiedError(
      'KOLAYBI',
      "KolayBi' PRODUCTION ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.",
    );
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    throw new IntegrationNotVerifiedError(
      'KOLAYBI',
      "KolayBi' PRODUCTION ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.",
    );
  }

  async syncContact(_request: AccountingContactRequest): Promise<AccountingContactResult> {
    throw new IntegrationNotVerifiedError(
      'KOLAYBI',
      "KolayBi' PRODUCTION ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.",
    );
  }

  async mapProduct(_request: AccountingProductRequest): Promise<AccountingProductResult> {
    throw new IntegrationNotVerifiedError(
      'KOLAYBI',
      "KolayBi' PRODUCTION ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.",
    );
  }

  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    throw new IntegrationNotVerifiedError(
      'KOLAYBI',
      "KolayBi' PRODUCTION ortamı henüz doğrulanmamıştır. Gerçek ağ isteği yapılamaz.",
    );
  }
}
