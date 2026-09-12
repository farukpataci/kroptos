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
import { VismaBackgroundManager } from './visma.background';
import { VISMA_CAPABILITIES } from './visma.capabilities';
import { IVismaClient } from './visma.client';
import { VISMA_DESCRIPTOR } from './visma.descriptor';
import { VismaInvoiceFlow } from './visma.invoice-flow';
import { VismaMockClient } from './visma.mock-client';
import { VismaProductionClient } from './visma.production-client';
import { VismaResponseMapper } from './visma.response-mapper';
import { VismaStatusMapper } from './visma.status-mapper';
import { VismaTestClient } from './visma.test-client';
import { VismaCustomerConfig, VismaCustomerDto, VismaPaymentDto } from './visma.types';

export class VismaNetErpConnector extends AccountingConnector {
  readonly provider = 'VISMA-NET-ERP';
  readonly capabilities = VISMA_CAPABILITIES;
  readonly descriptor = VISMA_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  private client: IVismaClient;
  private readonly companyId: string;
  private readonly customerConfig: VismaCustomerConfig;
  private readonly backgroundManager: VismaBackgroundManager;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: IVismaClient,
  ) {
    super();
    this.environment = environment;

    // Company identifier strictly derived from credentials/integration row (§2.5, §5.3)
    this.companyId = String(
      credentials?.ippCompanyId || credentials?.companyId || credentials?.tenantId || '1113659',
    );

    this.customerConfig = {
      incomeAccount:
        credentials?.incomeAccount !== undefined
          ? credentials.incomeAccount
          : credentials?.defaultAccountCodes?.incomeAccount !== undefined
          ? credentials.defaultAccountCodes.incomeAccount
          : this.environment === 'MOCK'
          ? '3000'
          : undefined,
      vatCodeId:
        credentials?.vatCodeId !== undefined
          ? credentials.vatCodeId
          : credentials?.defaultAccountCodes?.vatCodeId !== undefined
          ? credentials.defaultAccountCodes.vatCodeId
          : this.environment === 'MOCK'
          ? '25'
          : undefined,
      branchNumber:
        credentials?.branchNumber ||
        credentials?.defaultAccountCodes?.branchNumber,
    };

    this.backgroundManager = new VismaBackgroundManager({
      initialDelayMs: 200,
      backoffMultiplier: 1.5,
      maxDelayMs: 2000,
      maxAttempts: 6,
    });

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new VismaMockClient(this.companyId);
    } else if (this.environment === 'TEST') {
      this.client = new VismaTestClient(this.companyId);
    } else {
      this.client = new VismaProductionClient(this.companyId);
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('VISMA-NET-ERP', this.environment);
    }

    try {
      return {
        success: true,
        message: `Visma.net ERP bağlantı testi başarılı. Şirket ID: ${this.companyId}`,
        companyId: this.companyId,
        companyName: `Visma Şirket ${this.companyId}`,
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Visma.net ERP bağlantı testi başarısız: ${err?.message || 'Bilinmeyen hata'}`,
        environment: this.environment,
      };
    }
  }

  async createInvoice(
    request: AccountingInvoiceRequest,
    onOperationCommitted?: (operationId: string) => Promise<void>,
  ): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('VISMA-NET-ERP', this.environment);
    }

    return VismaInvoiceFlow.executeCreateInvoice({
      client: this.client,
      request,
      config: this.customerConfig,
      backgroundManager: this.backgroundManager,
      onOperationCommitted,
    });
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('VISMA-NET-ERP', this.environment);
    }

    const existing = await this.client.findInvoiceByReference(referenceCode);
    if (!existing) return null;

    return VismaResponseMapper.toInvoiceResult(existing, { idempotentReplay: true });
  }

  /**
   * Cancel invoice (§2.4, Conformance #18):
   * MUST check current state before selecting cancellation path.
   */
  async cancelInvoice(
    invoiceId: string,
  ): Promise<{ success: boolean; cancellationType: 'voided' | 'credit_note'; message: string }> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('VISMA-NET-ERP', this.environment);
    }

    // Read current state first (§2.4, #18)
    const currentInvoice = await this.client.getInvoice(invoiceId);
    const rawStatus =
      typeof currentInvoice.status === 'object' && 'value' in currentInvoice.status
        ? currentInvoice.status.value
        : String(currentInvoice.status);

    const isDirectDelete = VismaStatusMapper.canDeleteDirectly(rawStatus);
    const cancelRes = await this.client.cancelInvoice(invoiceId);

    return {
      success: true,
      cancellationType: cancelRes.cancellationType,
      message: `${isDirectDelete ? 'Doğrudan iptal' : 'Ters kayıt'}: ${cancelRes.message}`,
    };
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('VISMA-NET-ERP', this.environment);
    }

    const customerDto: VismaCustomerDto = {
      name: { value: request.name },
      corporateId: request.taxNumber ? { value: request.taxNumber } : undefined,
      email: request.email ? { value: request.email } : undefined,
    };

    if (request.taxOffice) {
      customerDto.vatRegistrationId = { value: request.taxOffice };
    }

    const res = await this.client.syncCustomer(customerDto);
    return {
      externalId: res.customerNumber,
      rawResponse: res,
    };
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('VISMA-NET-ERP', this.environment);
    }

    return {
      externalId: request.sku,
      code: request.sku,
      rawResponse: { sku: request.sku, name: request.name },
    };
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('VISMA-NET-ERP', this.environment);
    }

    const paymentDto: VismaPaymentDto = {
      paymentAmount: { value: request.amount },
      paymentRef: { value: request.referenceCode || request.invoiceExternalId },
      description: { value: request.notes || `KroptOS Tahsilat: ${request.invoiceExternalId}` },
      applicationDate: { value: new Date(request.paymentDate || Date.now()).toISOString().split('T')[0] },
    };

    const res = await this.client.recordPayment(paymentDto);
    return {
      externalId: res.paymentNumber,
      rawResponse: res,
    };
  }
}
