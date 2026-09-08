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
import { PARASUT_CAPABILITIES } from './parasut.capabilities';
import { IParasutClient } from './parasut.client';
import { ParasutMockClient } from './parasut.mock-client';
import { ParasutProductionClient } from './parasut.production-client';
import { ParasutTestClient } from './parasut.test-client';

export class ParasutConnector extends AccountingConnector {
  readonly provider = 'PARASUT';
  readonly capabilities: AccountingCapabilities = PARASUT_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly client: IParasutClient;

  constructor(
    private readonly credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    mockClientOverride?: IParasutClient,
  ) {
    super();
    this.environment = environment;

    if (mockClientOverride) {
      this.client = mockClientOverride;
    } else {
      switch (environment) {
        case 'MOCK':
          this.client = new ParasutMockClient(credentials);
          break;
        case 'TEST':
          this.client = new ParasutTestClient(credentials);
          break;
        case 'PRODUCTION':
          this.client = new ParasutProductionClient(credentials);
          break;
        default:
          this.client = new ParasutMockClient(credentials);
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
