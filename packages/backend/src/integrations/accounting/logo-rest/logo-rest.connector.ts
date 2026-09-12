import { AccountingConnector } from '../core/AccountingConnector';
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
} from '../core/AccountingTypes';
import { LOGO_REST_CAPABILITIES } from './logo-rest.capabilities';
import { ILogoRestClient } from './logo-rest.client';
import { LogoRestMockClient } from './logo-rest.mock-client';
import { LogoRestUnverifiedClient } from './logo-rest.unverified-client';

export class LogoRestConnector extends AccountingConnector {
  readonly provider = 'LOGO-REST';
  readonly capabilities: AccountingCapabilities = LOGO_REST_CAPABILITIES;
  readonly environment: AccountingEnvironment;
  private readonly client: ILogoRestClient;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    clientOverride?: ILogoRestClient,
  ) {
    super();
    this.environment = environment;
    this.client =
      clientOverride ??
      (environment === 'MOCK' ? new LogoRestMockClient(credentials) : new LogoRestUnverifiedClient(environment));
  }

  testConnection(): Promise<AccountingTestConnectionResult> {
    return this.client.testConnection();
  }
  createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    return this.client.createInvoice(request);
  }
  recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    return this.client.recordPayment(request);
  }
  syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    return this.client.syncContact(request);
  }
  mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    return this.client.mapProduct(request);
  }
  findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return this.client.findInvoiceByReference(referenceCode);
  }
}
