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
import { BadRequestException } from '@nestjs/common';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { LEXWARE_CAPABILITIES } from './lexware.capabilities';
import { ILexwareClient, LexwareHttpClient } from './lexware.client';
import { LexwareMockClient } from './lexware.mock-client';
import { LexwareTestClient } from './lexware.test-client';
import { LexwareProductionClient } from './lexware.production-client';
import { LexwareInvoiceFlow } from './lexware.invoice-flow';
import { LexwareRequestMapper } from './lexware.request-mapper';
import { LexwareResponseMapper } from './lexware.response-mapper';

export class LexwareConnector extends AccountingConnector {
  readonly provider = 'LEXWARE-OFFICE';
  readonly capabilities: AccountingCapabilities = LEXWARE_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly client: ILexwareClient;
  private readonly apiKey: string;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: ILexwareClient,
  ) {
    super();
    this.environment = environment;
    this.apiKey = credentials?.apiKey || '';

    if (customClient) {
      this.client = customClient;
    } else {
      switch (environment) {
        case 'MOCK':
          this.client = new LexwareMockClient();
          break;
        case 'TEST':
          this.client = new LexwareTestClient(this.apiKey);
          break;
        case 'PRODUCTION':
          this.client = new LexwareProductionClient(this.apiKey);
          break;
        default:
          this.client = new LexwareMockClient();
      }
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('lexware-office', this.environment);
    }

    try {
      const profile = await this.client.getProfile();
      return {
        success: true,
        message: 'Lexware Office bağlantısı başarıyla doğrulandı.',
        companyId: profile?.organizationId || 'org-mock-lexware',
        companyName: profile?.companyName || 'Lexware Office Firma',
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lexware Office bağlantı hatası: ${err.message}`,
        environment: this.environment,
      };
    }
  }

  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    // §5.5: External reference filtering is not supported by Lexware API.
    // DOCUMENTATION_REQUIRED status, no automated query.
    return null;
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    // §5.2: Execute mandatory draft-first -> reconcile -> finalize flow
    return LexwareInvoiceFlow.executeCreateInvoice(this.client, request);
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    // §5.7: Lexware /payments endpoint is strictly GET (read-only)
    throw new BadRequestException(
      'Lexware Office API üzerinden tahsilat/ödeme kaydı yazılması desteklenmemektedir (§5.7). /payments ucu salt okunurdur.',
    );
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const payload = LexwareRequestMapper.toContact(request);
    const created = await this.client.createContact(payload);
    return LexwareResponseMapper.toContactResult(created);
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    const payload = LexwareRequestMapper.toArticle(request);
    const created = await this.client.createArticle(payload);
    return LexwareResponseMapper.toProductResult(created);
  }

  async cancelInvoice(externalId: string): Promise<void> {
    // Universal Rule 18: Current status must be checked before selecting cancellation path
    const current = await this.client.getInvoice(externalId);

    if (current.voucherStatus === 'draft') {
      // Draft invoices can be deleted
      await this.client.deleteDraftInvoice(externalId);
      return;
    }

    // §3.3: Finalized invoices cannot be deleted or directly cancelled via DELETE/PUT.
    // They require a credit note (Rechnungskorrektur) in German tax law.
    throw new BadRequestException(
      `Lexware Office faturası (${current.voucherNumber || externalId}) kesinleşmiş ('${current.voucherStatus}') durumdadır ve doğrudan silinemez/iptal edilemez. Düzeltme için Alacak Dekontu (Rechnungskorrektur / Credit Note) düzenlenmelidir.`,
    );
  }

  getClient(): ILexwareClient {
    return this.client;
  }
}
