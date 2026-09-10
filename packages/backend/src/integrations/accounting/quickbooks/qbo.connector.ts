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
  AccountingCapabilities,
} from '../core/AccountingTypes';
import { AccountingConnector } from '../core/AccountingConnector';
import { IQBOClient } from './qbo.client';
import { QBOMockClient } from './qbo.mock-client';
import { QBOTestClient } from './qbo.test-client';
import { QBOProductionClient } from './qbo.production-client';
import { QBOIdempotency } from './qbo.idempotency';
import { QBOInvoiceFlow } from './qbo.invoice-flow';
import { QBORequestMapper } from './qbo.request-mapper';
import { QBOResponseMapper } from './qbo.response-mapper';
import { QBOTaxConfiguration, QBOTaxManager } from './qbo.tax';
import { QBODocNumber } from './qbo.doc-number';
import { QBO_CAPABILITIES } from './qbo.capabilities';

export class QuickBooksConnector extends AccountingConnector {
  public readonly provider = 'QUICKBOOKS';
  public readonly capabilities: AccountingCapabilities = QBO_CAPABILITIES;
  private client: IQBOClient;
  private taxConfig?: QBOTaxConfiguration;

  constructor(
    public readonly credentials: Record<string, any> = {},
    public readonly environment: AccountingEnvironment = 'MOCK',
    customClient?: IQBOClient,
  ) {
    super();

    // §2.5: realmId is derived strictly from credentials, never from request payload
    const realmId = credentials?.realmId || 'mock-realm-1';

    if (customClient) {
      this.client = customClient;
    } else if (environment === 'MOCK') {
      this.client = new QBOMockClient(realmId);
    } else if (environment === 'TEST') {
      this.client = new QBOTestClient(realmId);
    } else {
      this.client = new QBOProductionClient(realmId);
    }
  }

  getClient(): IQBOClient {
    return this.client;
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const company = await this.client.getCompanyInfo();
    const prefs = await this.client.getPreferences();
    this.taxConfig = QBOTaxManager.determineTaxConfig(prefs, this.credentials?.taxCodeRef);

    const astLabel = this.taxConfig.automaticSalesTax ? 'Etkin (AST)' : 'Devre Dışı (Manuel)';
    return {
      success: true,
      message: `QuickBooks Online bağlantısı başarılı. Şirket: ${company.CompanyName || company.LegalName || this.client.realmId}, Otomatik Vergi: ${astLabel}`,
      companyName: company.CompanyName || company.LegalName,
      companyId: company.Id || this.client.realmId,
      environment: this.environment,
    };
  }

  private async ensureTaxConfig(): Promise<QBOTaxConfiguration> {
    if (this.taxConfig) {
      return this.taxConfig;
    }
    const prefs = await this.client.getPreferences();
    this.taxConfig = QBOTaxManager.determineTaxConfig(prefs, this.credentials?.taxCodeRef);
    return this.taxConfig;
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    const taxConfig = await this.ensureTaxConfig();

    // 1. Ensure customer exists
    let customerId = 'cust-default';
    if (request.contact) {
      const existing = await this.client.findCustomer(request.contact.name || request.contact.email || '');
      if (existing?.Id) {
        customerId = existing.Id;
      } else {
        const customerPayload = QBORequestMapper.toQBOCustomer(request.contact);
        const createdCustomer = await this.client.createCustomer(customerPayload);
        customerId = createdCustomer.Id || 'cust-default';
      }
    }

    // 2. Generate deterministic native idempotency requestid
    const requestId = QBOIdempotency.generateRequestId(this.client.realmId, request.referenceCode, 'create_invoice');

    // 3. Execute invoice flow with read-back reconciliation
    const flowResult = await QBOInvoiceFlow.executeCreateInvoice(
      request,
      customerId,
      taxConfig,
      this.client,
      requestId,
    );

    return QBOResponseMapper.toInvoiceResult(
      flowResult.invoice,
      flowResult.hasAmountMismatch,
      flowResult.amountDifference,
    );
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const existing = await this.client.findCustomer(request.name || '');
    if (existing) {
      return QBOResponseMapper.toContactResult(existing);
    }
    const payload = QBORequestMapper.toQBOCustomer(request);
    const created = await this.client.createCustomer(payload);
    return QBOResponseMapper.toContactResult(created);
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    const customerId = 'cust-default';

    const payload = QBORequestMapper.toQBOPayment(
      request,
      customerId,
      this.credentials?.depositAccountId,
    );

    const payment = await this.client.createPayment(payload);
    return QBOResponseMapper.toPaymentResult(payment);
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    const payload = QBORequestMapper.toQBOItem(request, this.credentials?.incomeAccountId);
    const item = await this.client.createItem(payload);
    return QBOResponseMapper.toProductResult(item);
  }

  async cancelInvoice(invoiceId: string): Promise<{ cancellationType: string; message: string }> {
    const result = await QBOInvoiceFlow.executeCancelInvoice(invoiceId, this.client);
    return {
      cancellationType: result.cancellationType,
      message: `QuickBooks Online faturası (${invoiceId}) başarıyla iptal edildi (Voided).`,
    };
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    const docNumber = QBODocNumber.format(referenceCode);
    const invoice = await this.client.findInvoiceByDocNumber(docNumber);
    if (!invoice) return null;
    return QBOResponseMapper.toInvoiceResult(invoice);
  }
}
