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

export interface IParasutClient {
  testConnection(): Promise<AccountingTestConnectionResult>;
  createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult>;
  recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult>;
  syncContact(request: AccountingContactRequest): Promise<AccountingContactResult>;
  mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult>;
  findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null>;
}
