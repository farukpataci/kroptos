import { BadRequestException } from '@nestjs/common';
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
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { NetSuiteCredentials } from './netsuite.types';
import { NETSUITE_CAPABILITIES } from './netsuite.capabilities';
import { NETSUITE_DESCRIPTOR } from './netsuite.descriptor';
import { NetSuiteMockClient } from './netsuite.mock-client';
import { NetSuiteTestClient } from './netsuite.test-client';
import { NetSuiteProductionClient } from './netsuite.production-client';
import { INetSuiteClient, NetSuiteInvoiceFlow } from './netsuite.invoice-flow';
import { NetSuiteRequestMapper } from './netsuite.request-mapper';
import { NetSuiteResponseMapper } from './netsuite.response-mapper';
import { NetSuiteStatusMapper } from './netsuite.status-mapper';
import { NetSuiteSchemaManager } from './netsuite.schema';
import { NetSuiteJwtHelper } from './netsuite.jwt';

export class NetSuiteConnector extends AccountingConnector {
  readonly provider = 'NETSUITE';
  readonly capabilities = NETSUITE_CAPABILITIES;
  readonly descriptor = NETSUITE_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  public readonly credentials: NetSuiteCredentials;
  private client: INetSuiteClient;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: INetSuiteClient,
  ) {
    super();
    this.environment = environment;

    this.credentials = {
      accountId: credentials?.accountId?.trim() || '1234567_SB1',
      clientId: credentials?.clientId?.trim() || 'mock_client_id',
      certificateId: credentials?.certificateId?.trim() || 'mock_cert_kid',
      keyReference: credentials?.keyReference?.trim() || 'NETSUITE_PRIVATE_KEY',
      subsidiaryId: credentials?.subsidiaryId !== undefined ? String(credentials.subsidiaryId).trim() : undefined,
      certificateExpiresAt: credentials?.certificateExpiresAt?.trim() || undefined,
      concurrencyLimit: credentials?.concurrencyLimit ? Number(credentials.concurrencyLimit) : 1,
    };

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new NetSuiteMockClient(this.credentials);
    } else if (this.environment === 'TEST') {
      this.client = new NetSuiteTestClient();
    } else {
      this.client = new NetSuiteProductionClient();
    }
  }

  /**
   * NetSuite Bağlantı ve Şema Keşfi Testi (§5.5, §5.2)
   */
  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('netsuite', this.environment);
    }

    try {
      // 1. Temel bağlantı ve host kontrolü
      const mockClient = this.client as NetSuiteMockClient;
      const conn = await mockClient.testConnection();

      // 2. Metadata Catalog Şema Keşfi (§5.5)
      const discovery = await NetSuiteSchemaManager.discoverSchema(this.credentials, (type) =>
        mockClient.getMetadataCatalog(type),
      );
      NetSuiteSchemaManager.assertSchemaValid(discovery);

      // 3. Sertifika ömrü uyarısı kontrolü (§5.2)
      const certCheck = NetSuiteJwtHelper.checkCertificateStatus(this.credentials.certificateExpiresAt);
      let warningNote = '';
      if (certCheck.warningMessage) {
        warningNote = ` [${certCheck.warningMessage}]`;
      }

      return {
        success: true,
        message: `Oracle NetSuite bağlantısı ve şema keşfi başarılı (${conn.host}).${warningNote}`,
        companyId: this.credentials.accountId,
        companyName: `NetSuite (${this.credentials.accountId})`,
        environment: this.environment,
      };
    } catch (err: any) {
      if (err instanceof IntegrationNotVerifiedError) {
        throw err;
      }
      return {
        success: false,
        message: `NetSuite bağlantı testi başarısız: ${err?.message || 'Bilinmeyen hata'}`,
        environment: this.environment,
      };
    }
  }

  /**
   * §5.6 & §5.7 Fatura Oluşturma:
   * Ön-doğrulama (BizimHesap kalıbı) -> PUT eid:<externalId> upsert
   */
  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('netsuite', this.environment);
    }

    // Müşterinin varlığını doğrula / senkronize et
    let customerId = '42';
    if (request.contact) {
      const contactResult = await this.syncContact(request.contact as any);
      customerId = contactResult.externalId;
    }

    return NetSuiteInvoiceFlow.executeInvoiceFlow(this.client, request, customerId, this.credentials);
  }

  /**
   * Cari Senkronizasyonu
   */
  async syncContact(contact: AccountingContactRequest): Promise<AccountingContactResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('netsuite', this.environment);
    }

    const payload = NetSuiteRequestMapper.toNetSuiteCustomer(contact, this.credentials);
    const result = await this.client.upsertCustomer(payload.externalId!, payload);

    return {
      externalId: String(result.id),
      rawResponse: result,
    };
  }

  /**
   * Tahsilat / Ödeme Kaydı
   */
  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('netsuite', this.environment);
    }

    const payload = NetSuiteRequestMapper.toNetSuitePayment(request, '42', this.credentials);
    const result = await this.client.createPayment(payload);

    return {
      externalId: String(result.id),
      rawResponse: result,
    };
  }

  /**
   * Ürün Eşlemesi
   */
  async mapProduct(product: AccountingProductRequest): Promise<AccountingProductResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('netsuite', this.environment);
    }

    const payload = {
      itemId: product.sku,
      displayName: product.name,
      rate: product.unitPrice,
      subsidiary: this.credentials.subsidiaryId ? { id: String(this.credentials.subsidiaryId) } : undefined,
    };

    const result = await this.client.createItem(payload);

    return {
      externalId: String(result.id),
      code: product.code || product.sku,
      rawResponse: result,
    };
  }

  /**
   * Fatura İptali (§6, §8.16)
   * Güncel durum okunur, geçiş doğrulanır, iptal edilir.
   */
  async cancelInvoice(idOrExternalId: string): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('netsuite', this.environment);
    }

    const currentInvoice = await this.client.getInvoice(idOrExternalId);
    const transitionCheck = NetSuiteStatusMapper.validateCancellationTransition(currentInvoice?.status);

    if (!transitionCheck.canCancel) {
      if (transitionCheck.alreadyCancelled) {
        return NetSuiteResponseMapper.toInvoiceResult(currentInvoice, idOrExternalId);
      }
      throw new BadRequestException(transitionCheck.reason || 'Fatura iptal edilemez.');
    }

    const voided = await this.client.voidInvoice(idOrExternalId);
    return NetSuiteResponseMapper.toInvoiceResult(voided, idOrExternalId);
  }

  /**
   * Referans Kodu ile Fatura Arama (§5.7)
   */
  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('netsuite', this.environment);
    }

    try {
      const invoice = await this.client.getInvoice(`eid:${referenceCode}`);
      if (!invoice) return null;
      return NetSuiteResponseMapper.toInvoiceResult(invoice, referenceCode);
    } catch {
      return null;
    }
  }
}
