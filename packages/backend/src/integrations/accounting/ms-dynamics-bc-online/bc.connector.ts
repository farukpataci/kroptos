import { AccountingConnector } from '../core/AccountingConnector';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
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
import { BC_ONLINE_CAPABILITIES } from './bc.capabilities';
import { IBusinessCentralClient } from './bc.client';
import { BusinessCentralInvoiceFlow } from './bc.invoice-flow';
import { BusinessCentralMockClient } from './bc.mock-client';
import { BusinessCentralProductionClient } from './bc.production-client';
import { BusinessCentralRequestMapper } from './bc.request-mapper';
import { BusinessCentralResponseMapper } from './bc.response-mapper';
import { BusinessCentralTestClient } from './bc.test-client';
import { BusinessCentralCompany } from './bc.types';

export class BusinessCentralConnector extends AccountingConnector {
  readonly provider = 'MS_DYNAMICS_BC_ONLINE';
  readonly capabilities: AccountingCapabilities = BC_ONLINE_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly client: IBusinessCentralClient;

  constructor(
    private readonly credentials: Record<string, any> = {},
    environment: AccountingEnvironment = 'MOCK',
    mockClientOverride?: IBusinessCentralClient,
  ) {
    super();
    this.environment = environment;

    if (mockClientOverride) {
      this.client = mockClientOverride;
    } else {
      switch (environment) {
        case 'MOCK':
          this.client = new BusinessCentralMockClient(credentials);
          break;
        case 'TEST':
          this.client = new BusinessCentralTestClient(credentials);
          break;
        case 'PRODUCTION':
          this.client = new BusinessCentralProductionClient(credentials);
          break;
        default:
          this.client = new BusinessCentralMockClient(credentials);
      }
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const res = await this.client.testConnection();
    return {
      success: res.success,
      message: res.message,
      companyName: res.companyName,
      companyId: res.companyId,
      environment: this.environment,
    };
  }

  /**
   * Execute §4.2 Draft -> Lines -> Reconciliation -> Post lifecycle
   */
  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    return BusinessCentralInvoiceFlow.executeCreateInvoice(this.client, request);
  }

  /**
   * §4.7 Payment capability is DOCUMENTATION_REQUIRED until live lifecycle is verified.
   */
  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    throw new IntegrationNotVerifiedError(this.provider, this.environment);
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const payload = BusinessCentralRequestMapper.toCustomer(request);
    const customer = await this.client.syncCustomer(payload);
    return BusinessCentralResponseMapper.toContactResult(customer);
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    const payload = BusinessCentralRequestMapper.toItem(request);
    const item = await this.client.mapItem(payload);
    return BusinessCentralResponseMapper.toProductResult(item);
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    const invoice = await this.client.findInvoiceByReference(referenceCode);
    return invoice ? BusinessCentralResponseMapper.toInvoiceResult(invoice) : null;
  }

  /**
   * §4.4 Cancel invoice: deletes Draft or creates credit memo for Posted
   */
  async cancelInvoice(
    externalId: string,
  ): Promise<{ cancellationType: 'deleted' | 'credit_memo'; message: string }> {
    return BusinessCentralInvoiceFlow.executeCancelInvoice(this.client, externalId);
  }

  async getCompanies(): Promise<BusinessCentralCompany[]> {
    return this.client.getCompanies();
  }

  async listBusinesses(): Promise<Array<{ id: string; name: string; country?: string }>> {
    const companies = await this.getCompanies();
    return companies.map((c) => ({
      id: c.id,
      name: c.displayName || c.name,
      country: 'TR',
    }));
  }
}
