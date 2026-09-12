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
import { LOGO_REST_CAPABILITIES } from '../logo-rest/logo-rest.capabilities';
import { ILogoRestClient } from '../logo-rest/logo-rest.client';
import { LogoRestMockClient } from '../logo-rest/logo-rest.mock-client';
import { LogoRestUnverifiedClient } from '../logo-rest/logo-rest.unverified-client';

/**
 * Netsis'te iki protokol vardır (NetOpenX COM + NOX REST); ikisi de müşteri LAN'ında çalışır
 * → rota AGENT+API, internete açılmaz (docs/logo.agent.md §1.3–1.4). Agent gelene kadar yalnızca MOCK.
 * NetOpenX Runtime lisansı istemci sayısına göre satılır: eşzamanlılık tavanı bir lisans sınırıdır (§4.3.3).
 */
export class NetsisConnector extends AccountingConnector {
  readonly provider = 'NETSIS';
  readonly capabilities: AccountingCapabilities = LOGO_REST_CAPABILITIES;
  readonly environment: AccountingEnvironment;
  private readonly client: ILogoRestClient;

  constructor(credentials: Record<string, any>, environment: AccountingEnvironment = 'MOCK', clientOverride?: ILogoRestClient) {
    super();
    this.environment = environment;
    this.client =
      clientOverride ??
      (environment === 'MOCK'
        ? new LogoRestMockClient(credentials, 'NETSIS')
        : new LogoRestUnverifiedClient(environment, 'NETSIS'));
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
