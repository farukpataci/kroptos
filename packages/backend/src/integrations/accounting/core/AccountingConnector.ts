import {
  AccountingCapabilities,
  AccountingContactRequest,
  AccountingContactResult,
  AccountingEnvironment,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingPaymentRequest,
  AccountingPaymentResult,
  AccountingProductRequest,
  AccountingProductResult,
  AccountingTestConnectionResult,
} from './AccountingTypes';

export abstract class AccountingConnector {
  abstract readonly provider: string;
  abstract readonly capabilities: AccountingCapabilities;
  abstract readonly environment: AccountingEnvironment;

  abstract testConnection(): Promise<AccountingTestConnectionResult>;
  abstract createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult>;
  abstract recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult>;
  abstract syncContact(request: AccountingContactRequest): Promise<AccountingContactResult>;
  abstract mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult>;

  // Optional methods
  abstract findInvoiceByReference?(referenceCode: string): Promise<AccountingInvoiceResult | null>;
  buildAuthorizationUrl?(params: { state: string; redirectUri: string }): string;
  exchangeAuthorizationCode?(params: { code: string; redirectUri: string }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;
}
