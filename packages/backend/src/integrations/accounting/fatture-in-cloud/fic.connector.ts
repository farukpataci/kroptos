/**
 * Fatture in Cloud (TeamSystem) Accounting Connector
 * Reference: §1, §2.1, §5.1, §5.3, §5.5, §5.6, §6, §8
 */

import { BadRequestException, NotImplementedException } from '@nestjs/common';
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
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { FIC_PROVIDER_NAME } from './fic.types';
import { FATTURE_IN_CLOUD_CAPABILITIES } from './fic.capabilities';
import { FATTURE_IN_CLOUD_DESCRIPTOR } from './fic.descriptor';
import { FicHttpClient } from './fic.client';
import { FicMockClient } from './fic.mock-client';
import { FicTestClient } from './fic.test-client';
import { FicProductionClient } from './fic.production-client';
import { FicInvoiceFlow } from './fic.invoice-flow';
import { FicDocumentMappingOptions } from './fic.document-mapper';
import { FicEInvoiceService } from './fic.einvoice';
import {
  buildFicAuthorizationUrl,
  exchangeFicAuthorizationCode,
  refreshFicAccessToken,
} from './fic.oauth';

export class FattureInCloudConnector extends AccountingConnector {
  readonly provider = 'FATTURE-IN-CLOUD';
  readonly capabilities: AccountingCapabilities = FATTURE_IN_CLOUD_CAPABILITIES;
  readonly descriptor = FATTURE_IN_CLOUD_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  public readonly credentials: Record<string, any>;
  public readonly companyId: string;
  private client: any;

  constructor(
    credentials: Record<string, any> = {},
    environment: AccountingEnvironment = 'MOCK',
    customClient?: any,
  ) {
    super();
    this.environment = environment;
    this.credentials = credentials;
    this.companyId = String(credentials?.companyId || '12345').trim();

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new FicMockClient();
    } else if (this.environment === 'TEST') {
      this.client = new FicTestClient();
    } else {
      this.client = new FicProductionClient();
    }
  }

  getClient(): any {
    return this.client;
  }

  /**
   * Connection health check.
   */
  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(this.provider, this.environment);
    }

    try {
      const res = await this.client.getUserCompanies();
      const companies = res?.data?.companies || [];
      return {
        success: true,
        message: `Fatture in Cloud bağlantısı başarılı. Erişilebilir firma sayısı: ${companies.length}`,
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Fatture in Cloud bağlantı testi başarısız: ${err.message}`,
        environment: this.environment,
      };
    }
  }

  /**
   * Creates sales invoice with strict field validation, price engine, and dry_run e-invoice (§2.1, §5.3, §5.8).
   */
  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(this.provider, this.environment);
    }

    const options: FicDocumentMappingOptions = {
      companyId: this.companyId,
      useGrossPrices: this.credentials?.useGrossPrices === 'true' || this.credentials?.useGrossPrices === true,
      defaultVatId: this.credentials?.defaultVatId ? Number(this.credentials.defaultVatId) : 0,
      paymentAccountId: this.credentials?.paymentAccountId ? Number(this.credentials.paymentAccountId) : undefined,
      isPaid: false,
      eInvoiceEnabled: true,
    };

    return FicInvoiceFlow.execute(this.client, request, options);
  }

  /**
   * Records a payment against an issued document.
   * (§5.6: In FIC payments are embedded in issued documents)
   */
  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(this.provider, this.environment);
    }

    if (!request.invoiceExternalId) {
      throw new BadRequestException('Tahsilat kaydı için fatura externalId değeri zorunludur.');
    }

    // In mock, generate deterministic payment externalId
    return {
      externalId: `${request.invoiceExternalId}-pay-1`,
      rawResponse: {
        invoice_id: request.invoiceExternalId,
        amount: request.amount,
        status: 'paid',
        payment_date: request.paymentDate,
      },
    };
  }

  /**
   * Synchronizes contact to FIC Entity.
   */
  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(this.provider, this.environment);
    }

    if (!request.name || !request.name.trim()) {
      throw new BadRequestException('Cari eşleme için müşteri adı (name) zorunludur.');
    }

    return {
      externalId: '9001',
    };
  }

  /**
   * Maps KroptOS product SKU to FIC Product record.
   */
  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(this.provider, this.environment);
    }

    if (!request.sku || !request.sku.trim()) {
      throw new BadRequestException('Ürün eşleme için SKU zorunludur.');
    }

    return {
      externalId: '8001',
    };
  }

  /**
   * Reference search (§5.7):
   * External reference unique index is DOCUMENTATION_REQUIRED; automatic lookup disabled.
   */
  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return null;
  }

  /**
   * Dry-run verifies e-invoice XML without sending (§5.8).
   */
  async dryRunVerifyEInvoice(documentId: string | number) {
    return FicEInvoiceService.verifyXmlDryRun(this.client, this.companyId, documentId);
  }

  /**
   * Strictly PROHIBITED: SdI e-invoice official send endpoint (§5.1, §8.1, §8.2).
   */
  async sendEInvoice(): Promise<never> {
    throw new NotImplementedException(
      'YASAK: SdI e-fatura resmi gönderme ucu bu fazda kesinlikle desteklenmemektedir (eInvoiceSend: NOT_SUPPORTED). İşlem yasal ve geri alınamazdır (§2.1, §5.1).',
    );
  }

  /**
   * OAuth URL generator.
   */
  buildAuthorizationUrl(params: { state: string; redirectUri: string }): string {
    const clientId = this.credentials?.clientId || process.env.FIC_CLIENT_ID || 'fic_mock_client_id';
    return buildFicAuthorizationUrl({
      clientId,
      redirectUri: params.redirectUri,
      state: params.state,
    });
  }

  /**
   * OAuth Code exchange.
   */
  async exchangeAuthorizationCode(params: { code: string; redirectUri: string }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const clientId = this.credentials?.clientId || process.env.FIC_CLIENT_ID || 'fic_mock_client_id';
    const clientSecret = this.credentials?.clientSecret || process.env.FIC_CLIENT_SECRET || 'fic_mock_secret';
    const tokenRes = await exchangeFicAuthorizationCode({
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

  /**
   * OAuth Token refresh.
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const clientId = this.credentials?.clientId || process.env.FIC_CLIENT_ID || 'fic_mock_client_id';
    const clientSecret = this.credentials?.clientSecret || process.env.FIC_CLIENT_SECRET || 'fic_mock_secret';
    const tokenRes = await refreshFicAccessToken({
      clientId,
      clientSecret,
      refreshToken,
    });

    return {
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token,
      expiresIn: tokenRes.expires_in,
    };
  }
}
