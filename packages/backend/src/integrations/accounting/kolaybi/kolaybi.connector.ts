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
import { KOLAYBI_CAPABILITIES } from './kolaybi.capabilities';
import { IKolaybiClient } from './kolaybi.client';
import { KolaybiMockClient } from './kolaybi.mock-client';
import { KolaybiTestClient } from './kolaybi.test-client';
import { KolaybiProductionClient } from './kolaybi.production-client';

export class KolaybiConnector extends AccountingConnector {
  readonly provider = 'KOLAYBI';
  readonly capabilities: AccountingCapabilities = KOLAYBI_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly client: IKolaybiClient;

  constructor(
    private readonly credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    mockClientOverride?: IKolaybiClient,
  ) {
    super();
    this.environment = environment;

    if (mockClientOverride) {
      this.client = mockClientOverride;
    } else {
      switch (environment) {
        case 'MOCK':
          this.client = new KolaybiMockClient(credentials);
          break;
        case 'TEST':
          this.client = new KolaybiTestClient(credentials);
          break;
        case 'PRODUCTION':
          this.client = new KolaybiProductionClient(credentials);
          break;
        default:
          this.client = new KolaybiMockClient(credentials);
      }
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    return this.client.testConnection();
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    const defaultRetailContactId = this.credentials?.defaultRetailContactId;
    return this.client.createInvoice(request, defaultRetailContactId);
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
