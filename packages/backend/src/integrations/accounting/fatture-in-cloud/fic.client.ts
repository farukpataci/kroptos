/**
 * Fatture in Cloud (TeamSystem) Base HTTP Client
 * Reference: FIC REST API v2 & §3.1, §4, §5.1
 *
 * CRITICAL DISCIPLINE (§4, §5.1):
 * 1. Base URL is strictly https://api-v2.fattureincloud.it
 * 2. Company axis: /c/{company_id}/
 * 3. Rate limiting: inspects RateLimit-HourlyRemaining / RateLimit-MonthlyRemaining.
 *    On 429, honors Retry-After with exponential backoff + jitter. No tight loops.
 * 4. STRICTLY PROHIBITED ENDPOINTS (§5.1):
 *    Any call to /e_invoice/send is intercepted and BLOCKED.
 */

import { BadRequestException } from '@nestjs/common';
import { AccountingRateLimitError } from '../core/AccountingErrors';
import {
  FIC_API_BASE_URL,
  FicIssuedDocumentPayload,
  FicIssuedDocumentResponse,
  FicTotalsCalculationRequest,
  FicTotalsCalculationResponse,
  FicUserCompaniesResponse,
  FicXmlVerifyResponse,
} from './fic.types';

export interface FicClientConfig {
  accessToken: string;
  companyId?: string | number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface FicRateLimitInfo {
  hourlyRemaining?: number;
  hourlyLimit?: number;
  monthlyRemaining?: number;
  monthlyLimit?: number;
  retryAfterSeconds?: number;
}

export class FicHttpClient {
  private readonly baseUrl = FIC_API_BASE_URL;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private lastRateLimitInfo: FicRateLimitInfo = {};

  constructor(
    private readonly config: FicClientConfig,
    private readonly fetchFn: (url: string, init?: any) => Promise<any> = fetch,
  ) {
    this.maxRetries = config.maxRetries ?? 3;
    this.baseBackoffMs = config.baseBackoffMs ?? 1000;
    this.maxBackoffMs = config.maxBackoffMs ?? 30000;
  }

  getRateLimitInfo(): FicRateLimitInfo {
    return { ...this.lastRateLimitInfo };
  }

  /**
   * Executes an HTTP request with rate limit inspection and exponential backoff retry.
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // §5.1: STRICTLY BLOCK SdI send endpoint from ever being called
    if (endpoint.includes('/e_invoice/send')) {
      throw new BadRequestException(
        'YASAK: Fatture in Cloud SdI e-fatura gönderme ucu bu fazda çağrılamaz (§5.1). İşlem yasal ve geri alınamazdır.',
      );
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    // Verify host
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== this.baseUrl) {
      throw new BadRequestException(
        `Geçersiz Fatture in Cloud hedef adresi: ${parsedUrl.origin}. Yalnızca ${this.baseUrl} adresine izin verilir.`,
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.accessToken}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      let response: Response;

      try {
        response = await this.fetchFn(url, {
          ...options,
          headers,
        });
      } catch (err: any) {
        if (attempt > this.maxRetries) {
          throw err;
        }
        await this.delay(this.calculateBackoff(attempt));
        continue;
      }

      this.updateRateLimitInfo(response.headers);

      if (response.status === 429) {
        const retryAfter = this.lastRateLimitInfo.retryAfterSeconds || Math.pow(2, attempt);
        if (attempt > this.maxRetries) {
          throw new AccountingRateLimitError(
            'fatture-in-cloud',
            retryAfter,
          );
        }
        await this.delay(Math.min(retryAfter * 1000, this.maxBackoffMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Fatture in Cloud HTTP ${response.status} hatası: ${errorText || response.statusText}`,
        );
      }

      return (await response.json()) as T;
    }

    throw new Error('Fatture in Cloud API istek deneme limiti aşıldı.');
  }

  private updateRateLimitInfo(headers: Headers): void {
    if (!headers) return;

    const hRemaining = headers.get('RateLimit-HourlyRemaining');
    const hLimit = headers.get('RateLimit-HourlyLimit');
    const mRemaining = headers.get('RateLimit-MonthlyRemaining');
    const mLimit = headers.get('RateLimit-MonthlyLimit');
    const retryAfter = headers.get('Retry-After');

    this.lastRateLimitInfo = {
      hourlyRemaining: hRemaining ? parseInt(hRemaining, 10) : undefined,
      hourlyLimit: hLimit ? parseInt(hLimit, 10) : undefined,
      monthlyRemaining: mRemaining ? parseInt(mRemaining, 10) : undefined,
      monthlyLimit: mLimit ? parseInt(mLimit, 10) : undefined,
      retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) : undefined,
    };
  }

  private calculateBackoff(attempt: number): number {
    const exp = Math.min(this.baseBackoffMs * Math.pow(2, attempt - 1), this.maxBackoffMs);
    const jitter = Math.random() * 200;
    return exp + jitter;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- API Methods ---

  /**
   * Retrieves list of user accessible companies.
   * GET /user/companies (§3.4 d)
   */
  async getUserCompanies(): Promise<FicUserCompaniesResponse> {
    return this.request<FicUserCompaniesResponse>('/user/companies', { method: 'GET' });
  }

  /**
   * Creates a new issued document.
   * POST /c/{company_id}/issued_documents (§3.1)
   */
  async createIssuedDocument(
    companyId: string | number,
    payload: FicIssuedDocumentPayload,
  ): Promise<{ data: FicIssuedDocumentResponse }> {
    return this.request<{ data: FicIssuedDocumentResponse }>(
      `/c/${companyId}/issued_documents`,
      {
        method: 'POST',
        body: JSON.stringify({ data: payload }),
      },
    );
  }

  /**
   * Calculates totals for a draft document.
   * POST /c/{company_id}/issued_documents/totals (§5.5)
   */
  async getNewIssuedDocumentTotals(
    companyId: string | number,
    request: FicTotalsCalculationRequest,
  ): Promise<FicTotalsCalculationResponse> {
    return this.request<FicTotalsCalculationResponse>(
      `/c/${companyId}/issued_documents/totals`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    );
  }

  /**
   * Retrieves an issued document.
   * GET /c/{company_id}/issued_documents/{document_id}?fieldset=detailed (§3.2, §5.2)
   */
  async getIssuedDocument(
    companyId: string | number,
    documentId: string | number,
    detailed: boolean = true,
  ): Promise<{ data: FicIssuedDocumentResponse }> {
    const query = detailed ? '?fieldset=detailed' : '';
    return this.request<{ data: FicIssuedDocumentResponse }>(
      `/c/${companyId}/issued_documents/${documentId}${query}`,
      { method: 'GET' },
    );
  }

  /**
   * Verifies electronic invoice XML without sending.
   * GET /c/{company_id}/issued_documents/{document_id}/e_invoice/xml_verify (§3.2, §5.8)
   */
  async verifyEInvoiceXml(
    companyId: string | number,
    documentId: string | number,
  ): Promise<FicXmlVerifyResponse> {
    return this.request<FicXmlVerifyResponse>(
      `/c/${companyId}/issued_documents/${documentId}/e_invoice/xml_verify`,
      { method: 'GET' },
    );
  }

  /**
   * Lists issued documents with optional filtering.
   * GET /c/{company_id}/issued_documents
   */
  async listIssuedDocuments(
    companyId: string | number,
    params: { type?: string; q?: string; page?: number; perPage?: number } = {},
  ): Promise<{ data: FicIssuedDocumentResponse[] }> {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.q) searchParams.set('q', params.q);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.perPage) searchParams.set('per_page', String(params.perPage));

    const queryStr = searchParams.toString();
    const endpoint = `/c/${companyId}/issued_documents${queryStr ? `?${queryStr}` : ''}`;
    return this.request<{ data: FicIssuedDocumentResponse[] }>(endpoint, { method: 'GET' });
  }
}
