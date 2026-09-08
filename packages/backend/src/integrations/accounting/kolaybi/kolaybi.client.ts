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

export interface IKolaybiClient {
  testConnection(): Promise<AccountingTestConnectionResult>;
  createInvoice(
    request: AccountingInvoiceRequest,
    defaultRetailContactId?: string | null,
  ): Promise<AccountingInvoiceResult>;
  recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult>;
  syncContact(request: AccountingContactRequest): Promise<AccountingContactResult>;
  mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult>;
  findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null>;
}
