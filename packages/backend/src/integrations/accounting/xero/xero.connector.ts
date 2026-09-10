import {
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
import { AccountingConnector } from '../core/AccountingConnector';
import { IXeroClient } from './xero.client';
import { XeroMockClient } from './xero.mock-client';
import { XeroTestClient } from './xero.test-client';
import { XeroProductionClient } from './xero.production-client';
import { XeroInvoiceFlow } from './xero.invoice-flow';
import { XeroRequestMapper } from './xero.request-mapper';
import { XeroResponseMapper } from './xero.response-mapper';
import { XeroConnection } from './xero.types';
import { XERO_CAPABILITIES } from './xero.capabilities';
import { AccountingCapabilities } from '../core/AccountingTypes';

export class XeroConnector extends AccountingConnector {
  public readonly provider = 'XERO';
  public readonly capabilities: AccountingCapabilities = XERO_CAPABILITIES;
  private readonly client: IXeroClient;

  constructor(
    public readonly credentials: Record<string, any> = {},
    public readonly environment: AccountingEnvironment = 'MOCK',
  ) {
    super();
    switch (environment) {
      case 'TEST':
        this.client = new XeroTestClient(credentials);
        break;
      case 'PRODUCTION':
        this.client = new XeroProductionClient(credentials);
        break;
      case 'MOCK':
      default:
        this.client = new XeroMockClient(credentials);
        break;
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const result = await this.client.testConnection();
    return {
      success: result.success,
      message: result.message,
      companyName: result.companyName,
      companyId: result.companyId,
      environment: this.environment,
    };
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    // Idempotency check: return existing invoice if referenceCode was already processed
    const existing = await this.findInvoiceByReference(request.referenceCode);
    if (existing) {
      return existing;
    }

    const accountCode = this.credentials.accountCode || '200';
    const invoice = await XeroInvoiceFlow.executeCreateAndAuthorize(
      request,
      this.client,
      accountCode,
    );

    return XeroResponseMapper.toInvoiceResult(invoice);
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const payload = XeroRequestMapper.toXeroContact(request);
    const created = await this.client.createOrUpdateContact(payload);
    return XeroResponseMapper.toContactResult(created);
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    const bankAccountCode = this.credentials.bankAccountCode || '090';
    const payload = XeroRequestMapper.toXeroPayment(request, bankAccountCode);
    const created = await this.client.createPayment(payload);
    return XeroResponseMapper.toPaymentResult(created);
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    const accountCode = this.credentials.accountCode || '200';
    const payload = XeroRequestMapper.toXeroItem(request, accountCode);
    const created = await this.client.createOrUpdateItem(payload);
    return XeroResponseMapper.toProductResult(created);
  }

  async findInvoiceByReference(
    referenceCode: string,
  ): Promise<AccountingInvoiceResult | null> {
    const found = await this.client.findInvoiceByReference(referenceCode);
    if (!found) {
      return null;
    }
    return XeroResponseMapper.toInvoiceResult(found);
  }

  async getConnections(): Promise<XeroConnection[]> {
    return this.client.getConnections();
  }

  async listConnections(): Promise<XeroConnection[]> {
    return this.getConnections();
  }

  async listBusinesses(): Promise<Array<{ id: string; name: string }>> {
    const connections = await this.getConnections();
    return connections.map((c) => ({
      id: c.tenantId,
      name: c.tenantName,
    }));
  }

  buildAuthorizationUrl(params: { state: string; redirectUri: string }): string {
    const clientId = this.credentials.clientId || '';
    const clientSecret = this.credentials.clientSecret || '';
    const oauth = new (require('./xero.oauth').XeroOAuth)({
      clientId,
      clientSecret,
      redirectUri: params.redirectUri,
    });
    return oauth.getAuthorizationUrl(params.state);
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    redirectUri: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (this.environment === 'MOCK') {
      return {
        accessToken: `mock-xero-access-token-${Date.now()}`,
        refreshToken: `mock-xero-refresh-token-${Date.now()}`,
        expiresIn: 1800,
      };
    }
    const clientId = this.credentials.clientId || '';
    const clientSecret = this.credentials.clientSecret || '';
    const oauth = new (require('./xero.oauth').XeroOAuth)({
      clientId,
      clientSecret,
      redirectUri: params.redirectUri,
    });
    const tokens = await oauth.exchangeCodeForTokens(params.code);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    };
  }
}
