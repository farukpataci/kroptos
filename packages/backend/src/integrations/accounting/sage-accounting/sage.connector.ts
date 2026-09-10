import { AccountingConnector } from '../core/AccountingConnector';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingTokenStore } from '../core/AccountingTokenStore';
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
import { SageAuth } from './sage.auth';
import { SAGE_CAPABILITIES } from './sage.capabilities';
import { ISageClient } from './sage.client';
import { SageMockClient } from './sage.mock-client';
import {
  buildSageAuthorizationUrl,
  exchangeSageAuthorizationCode,
} from './sage.oauth';
import { SageProductionClient } from './sage.production-client';
import { SageRequestMapper } from './sage.request-mapper';
import { SageResponseMapper } from './sage.response-mapper';
import { SageTestClient } from './sage.test-client';
import {
  SageBusiness,
  SageCredentials,
  SageLedgerAccount,
  SageTaxRate,
} from './sage.types';

export class SageConnector extends AccountingConnector {
  readonly provider = 'SAGE-ACCOUNTING';
  readonly capabilities: AccountingCapabilities = SAGE_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly client: ISageClient;
  private readonly sageAuth: SageAuth;
  private readonly credentials: SageCredentials;

  constructor(
    credentials: Record<string, any> = {},
    environment: AccountingEnvironment = 'MOCK',
    tokenStore: AccountingTokenStore = new AccountingTokenStore(),
  ) {
    super();
    this.environment = environment;
    this.credentials = {
      businessId: credentials.businessId || '',
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      ...credentials,
    };

    this.sageAuth = new SageAuth(tokenStore);

    switch (environment) {
      case 'TEST':
        this.client = new SageTestClient(this.credentials);
        break;
      case 'PRODUCTION':
        this.client = new SageProductionClient(this.credentials);
        break;
      case 'MOCK':
      default:
        this.client = new SageMockClient(this.credentials);
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

  /**
   * §4.6 Sales Invoice Flow:
   * 1. Sync contact to obtain contact external ID.
   * 2. Build payload with non-empty reference (§4.5) and ledger/tax IDs (§6).
   * 3. Send invoice to Sage.
   * 4. Read back and reconcile totals with KroptOS grandTotal (§4.6 zero tolerance).
   */
  async createInvoice(
    request: AccountingInvoiceRequest,
  ): Promise<AccountingInvoiceResult> {
    // 1. Ensure contact exists in Sage
    const contactResult = await this.syncContact({
      companyId: request.companyId,
      kroptosKey: request.contact.taxNumber || request.contact.name,
      name: request.contact.name,
      email: request.contact.email,
      phone: request.contact.phone,
      address: request.contact.address,
      city: request.contact.city,
      taxNumber: request.contact.taxNumber,
      taxOffice: request.contact.taxOffice,
      isCompany: request.contact.isCompany,
    });

    // 2. Map payload enforcing configuration rules (§6)
    const isMock = this.environment === 'MOCK';
    const isExplicitlyConfigured = Boolean(this.credentials.businessId);

    const defaultLedgerAccountId =
      (this.credentials as any).defaultLedgerAccountId ||
      (isMock && !isExplicitlyConfigured ? '4000' : undefined);
    const defaultTaxRateId =
      (this.credentials as any).defaultTaxRateId ||
      (isMock && !isExplicitlyConfigured ? 'GB_STANDARD' : undefined);

    const payload = SageRequestMapper.toSalesInvoiceCreatePayload(
      request,
      contactResult.externalId,
      {
        defaultLedgerAccountId,
        defaultTaxRateId,
      },
    );

    // 3. Post to Sage
    const created = await this.client.createSalesInvoice(payload);

    // 4. Reconcile totals (§4.6)
    SageResponseMapper.reconcileTotals(created, request);

    return SageResponseMapper.toInvoiceResult(created);
  }

  /**
   * §4.7 Payment flow is DOCUMENTATION_REQUIRED.
   * Calling this throws IntegrationNotVerifiedError.
   */
  async recordPayment(
    _request: AccountingPaymentRequest,
  ): Promise<AccountingPaymentResult> {
    throw new IntegrationNotVerifiedError(this.provider, this.environment);
  }

  async syncContact(
    request: AccountingContactRequest,
  ): Promise<AccountingContactResult> {
    const payload = SageRequestMapper.toContactCreatePayload(request);
    const contact = await this.client.syncContact(payload);
    return SageResponseMapper.toContactResult(contact);
  }

  async mapProduct(
    request: AccountingProductRequest,
  ): Promise<AccountingProductResult> {
    return SageResponseMapper.toProductResult(request.sku);
  }

  /**
   * §4.5 Optional method: findInvoiceByReference.
   * Capabilities status is DOCUMENTATION_REQUIRED. In Mock, delegates to mock store.
   */
  async findInvoiceByReference(
    referenceCode: string,
  ): Promise<AccountingInvoiceResult | null> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(this.provider, this.environment);
    }
    const inv = await this.client.findInvoiceByReference(referenceCode);
    return inv ? SageResponseMapper.toInvoiceResult(inv) : null;
  }

  // OAuth helper implementations
  buildAuthorizationUrl(params: { state: string; redirectUri: string }): string {
    const { clientId } = this.sageAuth.resolveAppCredentials(this.credentials);
    return buildSageAuthorizationUrl({
      clientId,
      redirectUri: params.redirectUri,
      state: params.state,
    });
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    redirectUri: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const { clientId, clientSecret } = this.sageAuth.resolveAppCredentials(
      this.credentials,
    );
    const tokenRes = await exchangeSageAuthorizationCode({
      clientId,
      clientSecret,
      code: params.code,
      redirectUri: params.redirectUri,
    });

    return {
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      expiresIn: tokenRes.expires_in,
    };
  }

  // §6 Configuration discovery
  async listBusinesses(): Promise<SageBusiness[]> {
    return this.client.listBusinesses();
  }

  async listLedgerAccounts(): Promise<SageLedgerAccount[]> {
    return this.client.listLedgerAccounts();
  }

  async listTaxRates(): Promise<SageTaxRate[]> {
    return this.client.listTaxRates();
  }
}
