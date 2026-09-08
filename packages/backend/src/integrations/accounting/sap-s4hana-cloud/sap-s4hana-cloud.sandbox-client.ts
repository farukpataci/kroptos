import { AccountingHttpClient } from '../core/AccountingHttpClient';
import { ISapS4HanaCloudClient } from './sap-s4hana-cloud.client';
import { SapS4HanaCloudErrorMapper } from './sap-s4hana-cloud.error-mapper';
import { SapS4HanaCloudMockClient } from './sap-s4hana-cloud.mock-client';
import { SapODataHelper } from './sap-s4hana-cloud.odata';
import {
  ODataListResponse,
  ODataSingleResponse,
  SapBusinessPartner,
  SapFindContactQuery,
  SapS4HanaCloudCredentials,
} from './sap-s4hana-cloud.types';

export class SapS4HanaCloudSandboxClient implements ISapS4HanaCloudClient {
  private readonly sandboxBaseUrl =
    'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER';
  private readonly apiKey: string | null = null;
  private readonly mockFallback: SapS4HanaCloudMockClient;

  constructor(
    private readonly credentials?: SapS4HanaCloudCredentials,
    private readonly httpClient?: AccountingHttpClient,
  ) {
    this.apiKey = credentials?.apiKey || process.env.SAP_SANDBOX_API_KEY || null;
    this.mockFallback = new SapS4HanaCloudMockClient(credentials);
  }

  /**
   * Checks if a live sandbox API key is present.
   */
  hasApiKey(): boolean {
    return !!this.apiKey?.trim() && !this.apiKey.startsWith('TRIGGER_');
  }

  async testConnection(): Promise<{ success: boolean; message: string; companyName?: string }> {
    // If no API key is provided, strictly avoid network request and fall back to mock
    if (!this.hasApiKey()) {
      return this.mockFallback.testConnection();
    }

    try {
      const res = await this.executeGet<ODataListResponse<SapBusinessPartner>>('/A_BusinessPartner', {
        $top: '1',
        $select: 'BusinessPartner,BusinessPartnerFullName',
        $format: 'json',
      });

      const count = res.d?.results?.length ?? 0;
      return {
        success: true,
        message: `SAP Sandbox bağlantısı başarılı (${count} örnek cari okundu)`,
        companyName: 'SAP Business Accelerator Hub Sandbox',
      };
    } catch (err: any) {
      throw err;
    }
  }

  async getBusinessPartners(
    query: SapFindContactQuery,
  ): Promise<{ results: SapBusinessPartner[]; totalCount?: number }> {
    if (!this.hasApiKey()) {
      return this.mockFallback.getBusinessPartners(query);
    }

    const params = SapODataHelper.buildBusinessPartnerQuery(query);
    const res = await this.executeGet<ODataListResponse<SapBusinessPartner>>('/A_BusinessPartner', params);

    const results = res.d?.results || [];
    const totalCount = res.d?.__count ? parseInt(res.d.__count, 10) : results.length;

    return { results, totalCount };
  }

  async getBusinessPartnerById(id: string): Promise<SapBusinessPartner | null> {
    if (!this.hasApiKey()) {
      return this.mockFallback.getBusinessPartnerById(id);
    }

    try {
      const escaped = SapODataHelper.escapeODataString(id);
      const res = await this.executeGet<ODataSingleResponse<SapBusinessPartner>>(
        `/A_BusinessPartner('${escaped}')`,
        {
          $format: 'json',
          $expand: 'to_BusinessPartnerAddress,to_BusinessPartnerTaxNumber',
        },
      );

      return res.d || null;
    } catch (err: any) {
      if (err.status === 404 || err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  private async executeGet<T>(subPath: string, queryParams?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.sandboxBaseUrl}${subPath}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([k, v]) => {
        url.searchParams.append(k, v);
      });
    }

    const headers: Record<string, string> = {
      APIKey: this.apiKey!,
      Accept: 'application/json',
      DataServiceVersion: '2.0',
    };

    if (this.httpClient) {
      return this.httpClient.get<T>(url.toString(), { headers });
    }

    // Standard native fetch fallback if AccountingHttpClient not injected
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    const bodyText = await response.text();
    let bodyJson: any = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      // not JSON
    }

    if (!response.ok) {
      throw SapS4HanaCloudErrorMapper.mapHttpError(response.status, bodyJson, bodyText);
    }

    SapS4HanaCloudErrorMapper.checkODataResponse(bodyJson);
    return bodyJson as T;
  }
}
