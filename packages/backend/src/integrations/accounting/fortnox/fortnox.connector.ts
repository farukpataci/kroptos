import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingConnector } from '../core/AccountingConnector';
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
import { FORTNOX_CAPABILITIES } from './fortnox.capabilities';
import { IFortnoxClient } from './fortnox.client';
import { FORTNOX_DESCRIPTOR } from './fortnox.descriptor';
import { FortnoxInvoiceFlow } from './fortnox.invoice-flow';
import { FortnoxMockClient } from './fortnox.mock-client';
import { FortnoxProductionClient } from './fortnox.production-client';
import { FortnoxRequestMapper } from './fortnox.request-mapper';
import { FortnoxResponseMapper } from './fortnox.response-mapper';
import { FortnoxStatusMapper } from './fortnox.status-mapper';
import { FortnoxTestClient } from './fortnox.test-client';
import { FortnoxConfig } from './fortnox.types';

export class FortnoxConnector extends AccountingConnector {
  readonly provider = 'FORTNOX';
  readonly capabilities = FORTNOX_CAPABILITIES;
  readonly descriptor = FORTNOX_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  private client: IFortnoxClient;
  private readonly config: Partial<FortnoxConfig>;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: IFortnoxClient,
  ) {
    super();
    this.environment = environment;

    this.config = {
      clientId: credentials?.clientId,
      clientSecret: credentials?.clientSecret,
      redirectUri: credentials?.redirectUri,
      defaultSalesAccount: credentials?.defaultSalesAccount
        ? Number(credentials.defaultSalesAccount)
        : 3001,
      defaultVATRate: credentials?.defaultVATRate
        ? Number(credentials.defaultVATRate)
        : 25,
    };

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new FortnoxMockClient();
    } else if (this.environment === 'TEST') {
      this.client = new FortnoxTestClient();
    } else {
      this.client = new FortnoxProductionClient();
    }
  }

  getClient(): IFortnoxClient {
    return this.client;
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    try {
      const info = await this.client.getCompanyInformation();
      return {
        success: true,
        message: `Fortnox bağlantı testi başarılı. Şirket: ${info.CompanyName}`,
        companyName: info.CompanyName,
        companyId: String(info.DatabaseNumber || '1234567'),
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Fortnox bağlantı testi başarısız: ${err?.message || 'Bilinmeyen hata'}`,
        environment: this.environment,
      };
    }
  }

  async createInvoice(
    request: AccountingInvoiceRequest,
    onOperationCommitted?: (operationId: string) => Promise<void>,
  ): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    if (onOperationCommitted) {
      await onOperationCommitted(`fortnox-claim-${request.referenceCode}`);
    }

    return FortnoxInvoiceFlow.executeCreateInvoice(
      this.client,
      request,
      this.config,
    );
  }

  async findInvoiceByReference(
    referenceCode: string,
  ): Promise<AccountingInvoiceResult | null> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    const matches = await this.client.searchInvoicesByOrderNumber(referenceCode);
    if (!matches || matches.length === 0) {
      return null;
    }

    return FortnoxResponseMapper.toInvoiceResult(matches[0]);
  }

  /**
   * Cancel invoice (§5.5, Conformance #18):
   * MUST check current state before selecting cancellation path.
   * - Unbooked invoices: PUT /cancel
   * - Booked invoices (immutable under Bokföringslagen): PUT /credit
   */
  async cancelInvoice(
    invoiceId: string,
  ): Promise<{ success: boolean; cancellationType: 'cancelled' | 'credit_note'; message: string }> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    // 1. Read current state first (§5.5)
    const currentInvoice = await this.client.getInvoice(invoiceId);

    const path = FortnoxStatusMapper.determineCancellationPath(currentInvoice);

    if (path === 'credit_note') {
      const creditInv = await this.client.creditInvoice(invoiceId);
      return {
        success: true,
        cancellationType: 'credit_note',
        message: `Kaydedilmiş fatura için alacak faturası oluşturuldu (#${creditInv.DocumentNumber}).`,
      };
    }

    await this.client.cancelInvoice(invoiceId);
    return {
      success: true,
      cancellationType: 'cancelled',
      message: `Taslak fatura iptal edildi (#${invoiceId}).`,
    };
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    const customer = FortnoxRequestMapper.toFortnoxCustomer(request);
    const created = await this.client.createCustomer(customer);
    return FortnoxResponseMapper.toContactResult(created);
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    const article = FortnoxRequestMapper.toFortnoxArticle(request, this.config);
    const created = await this.client.createArticle(article);
    return FortnoxResponseMapper.toProductResult(created);
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    if (this.capabilities.payment === 'DOCUMENTATION_REQUIRED') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('FORTNOX', this.environment);
    }

    const payment = FortnoxRequestMapper.toFortnoxPayment(request);
    const created = await this.client.createPayment(payment);
    return FortnoxResponseMapper.toPaymentResult(created);
  }
}
