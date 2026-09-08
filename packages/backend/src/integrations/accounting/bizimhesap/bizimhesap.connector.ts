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
import { BIZIMHESAP_CAPABILITIES } from './bizimhesap.capabilities';
import { IBizimhesapClient } from './bizimhesap.client';
import { BizimhesapMockClient } from './bizimhesap.mock-client';
import { BizimhesapTestClient } from './bizimhesap.test-client';
import { BizimhesapProductionClient } from './bizimhesap.production-client';

export class BizimhesapConnector extends AccountingConnector {
  readonly provider = 'BIZIMHESAP';
  readonly capabilities: AccountingCapabilities = BIZIMHESAP_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly client: IBizimhesapClient;

  constructor(
    private readonly credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    mockClientOverride?: IBizimhesapClient,
  ) {
    super();
    this.environment = environment;

    if (mockClientOverride) {
      this.client = mockClientOverride;
    } else {
      switch (environment) {
        case 'MOCK':
          this.client = new BizimhesapMockClient(credentials);
          break;
        case 'TEST':
          this.client = new BizimhesapTestClient(credentials);
          break;
        case 'PRODUCTION':
          this.client = new BizimhesapProductionClient(credentials);
          break;
        default:
          this.client = new BizimhesapMockClient(credentials);
      }
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    return this.client.testConnection();
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    return this.client.createInvoice(request);
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    return this.client.recordPayment(request);
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    return this.client.syncContact(request);
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    return this.client.mapProduct(request);
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return this.client.findInvoiceByReference(referenceCode);
  }
}
