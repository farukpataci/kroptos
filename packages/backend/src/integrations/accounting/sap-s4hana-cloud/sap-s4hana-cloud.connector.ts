import { NotImplementedException } from '@nestjs/common';
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
import { AccountingHttpClient } from '../core/AccountingHttpClient';
import { SAP_S4HANA_CLOUD_CAPABILITIES } from './sap-s4hana-cloud.capabilities';
import { ISapS4HanaCloudClient } from './sap-s4hana-cloud.client';
import { SapS4HanaCloudMockClient } from './sap-s4hana-cloud.mock-client';
import { SapS4HanaCloudProductionClient } from './sap-s4hana-cloud.production-client';
import { SapS4HanaCloudResponseMapper } from './sap-s4hana-cloud.response-mapper';
import { SapS4HanaCloudSandboxClient } from './sap-s4hana-cloud.sandbox-client';
import { SapS4HanaCloudTestClient } from './sap-s4hana-cloud.test-client';
import {
  SapBusinessPartner,
  SapFindContactQuery,
  SapS4HanaCloudCredentials,
} from './sap-s4hana-cloud.types';

export class SapS4HanaCloudConnector extends AccountingConnector {
  readonly provider = 'SAP_S4HANA_CLOUD';
  readonly capabilities: AccountingCapabilities = SAP_S4HANA_CLOUD_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly client: ISapS4HanaCloudClient;

  constructor(
    credentials: SapS4HanaCloudCredentials = {},
    environment: AccountingEnvironment | 'SANDBOX' = 'MOCK',
    httpClient?: AccountingHttpClient,
    mockClientOverride?: ISapS4HanaCloudClient,
  ) {
    super();
    this.environment = (environment === 'SANDBOX' ? 'MOCK' : environment) as AccountingEnvironment;

    if (mockClientOverride) {
      this.client = mockClientOverride;
      return;
    }

    switch (environment as string) {
      case 'TEST':
        this.client = new SapS4HanaCloudTestClient();
        break;
      case 'PRODUCTION':
        this.client = new SapS4HanaCloudProductionClient();
        break;
      case 'SANDBOX':
        this.client = new SapS4HanaCloudSandboxClient(credentials, httpClient);
        break;
      case 'MOCK':
      default:
        if (credentials.useSandbox) {
          this.client = new SapS4HanaCloudSandboxClient(credentials, httpClient);
        } else {
          this.client = new SapS4HanaCloudMockClient(credentials);
        }
        break;
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const res = await this.client.testConnection();
    return {
      success: res.success,
      message: res.message,
      companyName: res.companyName,
      environment: this.environment,
    };
  }

  /**
   * Phase 1 read-only vertical slice: Search/Find Business Partner in SAP S/4HANA Cloud.
   */
  async findBusinessPartners(
    query: SapFindContactQuery,
  ): Promise<{ items: AccountingContactResult[]; raw: SapBusinessPartner[]; totalCount?: number }> {
    const res = await this.client.getBusinessPartners(query);
    const items = res.results.map((bp) => SapS4HanaCloudResponseMapper.toContactResult(bp));
    return {
      items,
      raw: res.results,
      totalCount: res.totalCount,
    };
  }

  /**
   * Look up a single Business Partner by internal SAP ID.
   */
  async findBusinessPartnerById(id: string): Promise<AccountingContactResult | null> {
    const bp = await this.client.getBusinessPartnerById(id);
    if (!bp) return null;
    return SapS4HanaCloudResponseMapper.toContactResult(bp);
  }

  // =========================================================================
  // Strictly NOT_SUPPORTED operations in Phase 1 (No fake writes)
  // =========================================================================

  async createInvoice(_request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    throw new NotImplementedException(
      'SAP S/4HANA Cloud fatura yazma desteği Faz 1 kapsamında değildir (Hedef: Yalnızca Business Partner Okuma).',
    );
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    throw new NotImplementedException(
      'SAP S/4HANA Cloud doğrudan tahsilat oluşturma servisi desteklememektedir (Açık Kalem Denkleştirme gerektirir).',
    );
  }

  async syncContact(_request: AccountingContactRequest): Promise<AccountingContactResult> {
    throw new NotImplementedException(
      'SAP S/4HANA Cloud cari yazma desteği Faz 1 kapsamında değildir (Yalnızca Business Partner Okuma desteklenir).',
    );
  }

  async mapProduct(_request: AccountingProductRequest): Promise<AccountingProductResult> {
    throw new NotImplementedException(
      'SAP S/4HANA Cloud harici ürün yazma desteği bulunmamaktadır (Ürünler SAP ana veri ekibi tarafından açılır).',
    );
  }

  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    throw new NotImplementedException(
      'SAP S/4HANA Cloud fatura sorgulama desteği Faz 1 kapsamında değildir.',
    );
  }

  async cancelInvoice(_externalId: string): Promise<never> {
    throw new NotImplementedException(
      'SAP S/4HANA Cloud uzaktan fatura iptali desteği bulunmamaktadır.',
    );
  }
}
