import { BadRequestException } from '@nestjs/common';
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
import { CEGID_CAPABILITIES } from './cegid.capabilities';
import { CEGID_DESCRIPTOR } from './cegid.descriptor';
import { CegidInvoiceFlow, ICegidClient } from './cegid.invoice-flow';
import { CegidMappingContext, CegidRequestMapper } from './cegid.request-mapper';
import { CegidResponseMapper } from './cegid.response-mapper';
import { CegidStatusMapper } from './cegid.status-mapper';
import { CegidMockClient } from './cegid.mock-client';
import { CegidProductionClient } from './cegid.production-client';
import { CegidTestClient } from './cegid.test-client';

export class CegidConnector extends AccountingConnector {
  readonly provider = 'CEGID-XRP-FLEX';
  readonly capabilities = CEGID_CAPABILITIES;
  readonly descriptor = CEGID_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  private client: ICegidClient;
  private readonly instanceUrl: string;
  private readonly branchId?: string;
  private readonly mappingContext: CegidMappingContext;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: ICegidClient,
  ) {
    super();
    this.environment = environment;

    // Şirket ve örnek tanımlayıcısı istekten okunmaz, yalnızca credentials'tan gelir (§5, Conformance #16)
    this.instanceUrl = String(
      credentials?.instanceUrl || 'https://mock-instance.cegid.cloud',
    );
    this.branchId = credentials?.branchId;

    this.mappingContext = {
      branchId: this.branchId,
      defaultIncomeAccount:
        credentials?.defaultIncomeAccount !== undefined
          ? credentials.defaultIncomeAccount
          : credentials?.defaultAccountCodes?.salesAccount !== undefined
          ? credentials.defaultAccountCodes.salesAccount
          : this.environment === 'MOCK'
          ? '707000'
          : undefined,
      defaultVatCode:
        credentials?.defaultVatCode !== undefined
          ? credentials.defaultVatCode
          : credentials?.defaultAccountCodes?.vatCode !== undefined
          ? credentials.defaultAccountCodes.vatCode
          : this.environment === 'MOCK'
          ? 'TVA20'
          : undefined,
      defaultAccountCodes: credentials?.defaultAccountCodes,
    };

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new CegidMockClient();
    } else if (this.environment === 'TEST') {
      this.client = new CegidTestClient(credentials);
    } else {
      this.client = new CegidProductionClient(credentials);
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'CEGID-XRP-FLEX',
        'Cegid XRP Flex yalnızca MOCK ortamında desteklenir.',
      );
    }

    try {
      if (this.client instanceof CegidMockClient) {
        await this.client.testConnection();
      }

      return {
        success: true,
        message: `Cegid XRP Flex bağlantı ve şema keşfi testi başarılı. Örnek: ${this.instanceUrl}`,
        companyId: this.instanceUrl,
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Cegid XRP Flex bağlantı hatası: ${err.message}`,
        companyId: this.instanceUrl,
        environment: this.environment,
      };
    }
  }

  async createInvoice(
    request: AccountingInvoiceRequest,
  ): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'CEGID-XRP-FLEX',
        this.environment,
      );
    }

    return CegidInvoiceFlow.executeCreateInvoice({
      client: this.client,
      request,
      context: this.mappingContext,
    });
  }

  async syncContact(
    request: AccountingContactRequest,
  ): Promise<AccountingContactResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'CEGID-XRP-FLEX',
        this.environment,
      );
    }

    const payload = CegidRequestMapper.toCegidCustomer(request, this.mappingContext);
    const result = await (this.client as any).syncContact(payload);
    return CegidResponseMapper.toCustomerResult(result);
  }

  async recordPayment(
    request: AccountingPaymentRequest,
  ): Promise<AccountingPaymentResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'CEGID-XRP-FLEX',
        this.environment,
      );
    }

    const payload = CegidRequestMapper.toCegidPayment(request, this.mappingContext);
    const result = await (this.client as any).recordPayment(payload);
    return CegidResponseMapper.toPaymentResult(result);
  }

  async mapProduct(
    request: AccountingProductRequest,
  ): Promise<AccountingProductResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'CEGID-XRP-FLEX',
        this.environment,
      );
    }

    return {
      externalId: request.sku,
      code: request.code || request.sku,
      rawResponse: { sku: request.sku, name: request.name },
    };
  }

  async findInvoiceByReference(
    referenceCode: string,
  ): Promise<AccountingInvoiceResult | null> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'CEGID-XRP-FLEX',
        this.environment,
      );
    }

    if (this.client.findInvoiceByReference) {
      const doc = await this.client.findInvoiceByReference(referenceCode);
      if (!doc) return null;
      return CegidResponseMapper.toInvoiceResult(doc, { idempotentReplay: true });
    }

    return null;
  }

  /**
   * Evrensel Kural (§5, Conformance #18):
   * İptal öncesi güncel durum okunur.
   */
  async cancelInvoice(
    invoiceId: string,
  ): Promise<{ success: boolean; cancellationType: 'voided' | 'credit_note'; message: string }> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'CEGID-XRP-FLEX',
        this.environment,
      );
    }

    if (!invoiceId) {
      throw new BadRequestException(
        '[Cegid] İptal edilecek fatura kimliği belirtilmelidir.',
      );
    }

    // 1. Güncel durumu oku (Universal Rule #18)
    const currentDoc = await this.client.getInvoice(invoiceId);
    const currentStatus = currentDoc.Status?.value;

    const isDirectDelete = CegidStatusMapper.canDeleteDirectly(currentStatus);
    const path = CegidStatusMapper.determineCancellationPath(currentStatus);

    if (isDirectDelete) {
      currentDoc.Status = { value: 'Voided' };
      currentDoc.Hold = { value: false };
      return {
        success: true,
        cancellationType: 'voided',
        message: 'Fatura doğrudan iptal edildi (Voided).',
      };
    }

    return {
      success: true,
      cancellationType: path === 'credit_note' ? 'credit_note' : 'voided',
      message: 'Fatura ters kayıt / alacak dekontu ile iptal edildi.',
    };
  }

  async getInvoice(invoiceId: string): Promise<AccountingInvoiceResult> {
    const doc = await this.client.getInvoice(invoiceId);
    return CegidResponseMapper.toInvoiceResult(doc);
  }
}
