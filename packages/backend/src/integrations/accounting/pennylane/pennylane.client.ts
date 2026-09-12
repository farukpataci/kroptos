import { Logger } from '@nestjs/common';
import {
  PennylaneCreateInvoiceRequest,
  PennylaneCustomerRequest,
  PennylaneCustomerResponse,
  PennylaneInvoiceResponse,
  PennylaneListResponse,
  PennylaneProductRequest,
  PennylaneProductResponse,
} from './pennylane.types';
import { PennylaneWindowLimiter } from './pennylane.window-limiter';
import { PennylaneSerializer } from './pennylane.serialize';

export interface IPennylaneClient {
  createCustomer(data: PennylaneCustomerRequest): Promise<PennylaneCustomerResponse>;
  getCustomer(id: number): Promise<PennylaneCustomerResponse>;
  findCustomerByExternalReference(ref: string): Promise<PennylaneCustomerResponse | null>;
  createInvoice(data: PennylaneCreateInvoiceRequest): Promise<PennylaneInvoiceResponse>;
  getInvoice(id: number): Promise<PennylaneInvoiceResponse>;
  findInvoiceByExternalReference(ref: string): Promise<PennylaneInvoiceResponse | null>;
  finalizeInvoice(id: number): Promise<PennylaneInvoiceResponse>;
  deleteDraftInvoice(id: number): Promise<void>;
  createProduct(data: PennylaneProductRequest): Promise<PennylaneProductResponse>;
  listInvoices(cursor?: string, limit?: number): Promise<PennylaneListResponse<PennylaneInvoiceResponse>>;
}

export interface PennylaneClientConfig {
  apiToken: string;
  baseUrl?: string;
  limiter?: PennylaneWindowLimiter;
  fetchFn?: typeof fetch;
}

/**
 * Pennylane API v2 HTTP İstemcisi (§2, §5, §9)
 *
 * KRİTİK GÜVENLİK VE UYUM KURALLARI:
 * 1. Sürüm: Yalnızca v2 kullanılır; v1 yolu ('/v1/') ASLA üretilmez (§2.1, §9.8).
 * 2. E-fatura engeli: Factur-X / e_invoices uçları çağrılamaz (§6, §9.13).
 * 3. Rate Limit: 25 req / 5 sn kayan pencere kısıtına uyar (§5.3, §9.6).
 * 4. 429 Retry-After & ratelimit-reset başlıklarına tam uyum sağlar (§9.7).
 */
export class PennylaneHttpClient implements IPennylaneClient {
  private readonly logger = new Logger(PennylaneHttpClient.name);
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly limiter: PennylaneWindowLimiter;
  private readonly fetchFn: typeof fetch;

  constructor(config: PennylaneClientConfig) {
    let base = (config.baseUrl || 'https://app.pennylane.com/api/external/v2/').trim();

    // v1 yolu kesinlikle engellenir (§2.1, §9.8)
    if (base.includes('/v1/') || base.endsWith('/v1')) {
      throw new Error(
        'Pennylane API v1 tamamen emekliye ayrılmıştır (§2.1). Yalnızca API v2 (https://app.pennylane.com/api/external/v2/) kullanılabilir.',
      );
    }

    if (!base.endsWith('/')) {
      base += '/';
    }
    this.baseUrl = base;
    this.apiToken = config.apiToken;
    this.limiter = config.limiter ?? new PennylaneWindowLimiter();
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async createCustomer(data: PennylaneCustomerRequest): Promise<PennylaneCustomerResponse> {
    return this.request<PennylaneCustomerResponse>('POST', 'customers', data);
  }

  async getCustomer(id: number): Promise<PennylaneCustomerResponse> {
    return this.request<PennylaneCustomerResponse>('GET', `customers/${id}`);
  }

  async findCustomerByExternalReference(ref: string): Promise<PennylaneCustomerResponse | null> {
    const filter = JSON.stringify([
      { field: 'external_reference', operator: 'eq', value: ref },
    ]);
    const res = await this.request<PennylaneListResponse<PennylaneCustomerResponse>>(
      'GET',
      `customers?filter=${encodeURIComponent(filter)}&limit=1`,
    );
    return res.items && res.items.length > 0 ? res.items[0] : null;
  }

  async createInvoice(data: PennylaneCreateInvoiceRequest): Promise<PennylaneInvoiceResponse> {
    // §5.1: draft: true kontrolü
    if ((data as any).draft !== true) {
      throw new Error(
        "Pennylane v2 güvenlik kuralı ihlali (§5.1): Fatura oluştururken 'draft: true' zorunludur! draft atlanırsa fatura anında kesinleşir.",
      );
    }

    // §5.2, §9.3: Parasal tutarların string olduğunun teyidi
    if (data.invoice_lines) {
      for (const line of data.invoice_lines) {
        PennylaneSerializer.assertLinePriceIsString(line);
      }
    }

    return this.request<PennylaneInvoiceResponse>('POST', 'customer_invoices', data);
  }

  async getInvoice(id: number): Promise<PennylaneInvoiceResponse> {
    return this.request<PennylaneInvoiceResponse>('GET', `customer_invoices/${id}`);
  }

  async findInvoiceByExternalReference(ref: string): Promise<PennylaneInvoiceResponse | null> {
    const filter = JSON.stringify([
      { field: 'external_reference', operator: 'eq', value: ref },
    ]);
    const res = await this.request<PennylaneListResponse<PennylaneInvoiceResponse>>(
      'GET',
      `customer_invoices?filter=${encodeURIComponent(filter)}&limit=1`,
    );
    return res.items && res.items.length > 0 ? res.items[0] : null;
  }

  async finalizeInvoice(id: number): Promise<PennylaneInvoiceResponse> {
    return this.request<PennylaneInvoiceResponse>('PUT', `customer_invoices/${id}/finalize`);
  }

  async deleteDraftInvoice(id: number): Promise<void> {
    await this.request<void>('DELETE', `customer_invoices/${id}`);
  }

  async createProduct(data: PennylaneProductRequest): Promise<PennylaneProductResponse> {
    return this.request<PennylaneProductResponse>('POST', 'products', data);
  }

  async listInvoices(cursor?: string, limit = 50): Promise<PennylaneListResponse<PennylaneInvoiceResponse>> {
    let query = `customer_invoices?limit=${limit}`;
    if (cursor) {
      query += `&cursor=${encodeURIComponent(cursor)}`;
    }
    return this.request<PennylaneListResponse<PennylaneInvoiceResponse>>('GET', query);
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    attempt = 1,
  ): Promise<T> {
    // §2.1, §9.8: v1 yolu engeli
    if (endpoint.includes('/v1/') || endpoint.startsWith('v1/')) {
      throw new Error(
        'Pennylane API v1 tamamen emekliye ayrılmıştır (§2.1). İstek yolu v1 içeremez.',
      );
    }

    // §6, §9.13: Factur-X / e-invoicing uçlarının engellenmesi
    if (endpoint.includes('e_invoices') || endpoint.includes('import_e_invoice')) {
      throw new Error(
        'Pennylane Factur-X / e-fatura içe aktarma uçları bu turda kapsam dışıdır ve çağrılamaz (§6, §9.13).',
      );
    }

    // §5.3, §9.6: Pencere tabanlı rate limiter'dan izin al
    await this.limiter.acquire();

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      Accept: 'application/json',
    };

    let payload: string | undefined;
    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await this.fetchFn(url, {
      method,
      headers,
      body: payload,
    });

    if (response.status === 429 && attempt <= 3) {
      const retryAfter = response.headers.get('retry-after');
      const ratelimitReset = response.headers.get('ratelimit-reset');
      const waitMs = PennylaneWindowLimiter.computeRetryWaitMs(retryAfter, ratelimitReset, attempt);

      this.logger.warn(
        `[PennylaneClient] 429 Rate limit alındı. ${waitMs}ms sonra tekrar denenecek (${attempt}/3)...`,
      );

      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.request<T>(method, endpoint, body, attempt + 1);
    }

    if (!response.ok) {
      let errorDetails: string;
      try {
        const errorJson = await response.json();
        errorDetails = JSON.stringify(errorJson);
      } catch {
        errorDetails = await response.text();
      }

      // Sırların maskelenmesi (§9.15)
      const sanitized = errorDetails.replace(new RegExp(this.apiToken, 'g'), '[REDACTED]');
      throw new Error(
        `Pennylane API Hatası [HTTP ${response.status} ${response.statusText}] (${method} ${cleanEndpoint}): ${sanitized}`,
      );
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }
}
