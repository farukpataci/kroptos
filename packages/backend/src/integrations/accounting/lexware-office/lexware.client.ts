import {
  LexwareArticle,
  LexwareContact,
  LexwareCreateInvoiceRequest,
  LexwareInvoice,
  LexwarePageResponse,
} from './lexware.types';
import { LexwareErrorMapper } from './lexware.error-mapper';
import { LexwareBackoff } from './lexware.backoff';

export interface ILexwareClient {
  createDraftInvoice(data: LexwareCreateInvoiceRequest): Promise<LexwareInvoice>;
  getInvoice(id: string): Promise<LexwareInvoice>;
  finalizeInvoice(id: string, version: number): Promise<LexwareInvoice>;
  deleteDraftInvoice(id: string): Promise<void>;
  createContact(data: Partial<LexwareContact>): Promise<LexwareContact>;
  getContact(id: string): Promise<LexwareContact>;
  createArticle(data: Partial<LexwareArticle>): Promise<LexwareArticle>;
  getArticle(id: string): Promise<LexwareArticle>;
  listInvoices(page?: number, size?: number): Promise<LexwarePageResponse<LexwareInvoice>>;
  getProfile(): Promise<any>;
}

export class LexwareHttpClient implements ILexwareClient {
  private readonly baseUrl = 'https://api.lexware.io/v1';
  private readonly apiKey: string;
  private lastRequestTime = 0;
  private readonly minIntervalMs = 500; // 2 requests per second = 500ms minimum interval

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Throttle requests to max 2 requests/sec (§3.2, §5.1)
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestTime = Date.now();
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: any;
      params?: Record<string, any>;
      retries?: number;
    } = {},
  ): Promise<T> {
    const method = options.method || 'GET';
    const maxRetries = options.retries ?? 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      await this.throttle();

      let url = `${this.baseUrl}${path}`;
      if (options.params) {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(options.params)) {
          if (v !== undefined && v !== null) {
            qs.append(k, String(v));
          }
        }
        const qsStr = qs.toString();
        if (qsStr) url += `?${qsStr}`;
      }

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        };
        if (options.body) {
          headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (!res.ok) {
          let errBody: any;
          try {
            errBody = await res.json();
          } catch (_) {
            errBody = { message: res.statusText };
          }

          if (res.status === 429 && attempt <= maxRetries) {
            // §3.2 & §5.1: No Retry-After header. Use full jitter backoff.
            await LexwareBackoff.sleep(attempt);
            continue;
          }

          throw LexwareErrorMapper.mapError(res.status, errBody);
        }

        if (res.status === 204) {
          return undefined as any;
        }

        return (await res.json()) as T;
      } catch (err: any) {
        if (err.name === 'LexwareValidationError' || err.statusCode === 406) {
          // Never retry validation errors (§5.3)
          throw err;
        }
        if (attempt > maxRetries) {
          throw err;
        }
      }
    }

    throw new Error('Lexware Office isteği maksimum deneme sayısına ulaştı.');
  }

  async createDraftInvoice(data: LexwareCreateInvoiceRequest): Promise<LexwareInvoice> {
    // §5.2, §9: POST /v1/invoices without ?finalize=true strictly
    return this.request<LexwareInvoice>('/invoices', {
      method: 'POST',
      body: data,
    });
  }

  async getInvoice(id: string): Promise<LexwareInvoice> {
    return this.request<LexwareInvoice>(`/invoices/${id}`);
  }

  async finalizeInvoice(id: string, version: number): Promise<LexwareInvoice> {
    // Finalize state change with version
    return this.request<LexwareInvoice>(`/invoices/${id}/finalize`, {
      method: 'POST',
      body: { version },
    });
  }

  async deleteDraftInvoice(id: string): Promise<void> {
    return this.request<void>(`/invoices/${id}`, {
      method: 'DELETE',
    });
  }

  async createContact(data: Partial<LexwareContact>): Promise<LexwareContact> {
    return this.request<LexwareContact>('/contacts', {
      method: 'POST',
      body: data,
    });
  }

  async getContact(id: string): Promise<LexwareContact> {
    return this.request<LexwareContact>(`/contacts/${id}`);
  }

  async createArticle(data: Partial<LexwareArticle>): Promise<LexwareArticle> {
    return this.request<LexwareArticle>('/articles', {
      method: 'POST',
      body: data,
    });
  }

  async getArticle(id: string): Promise<LexwareArticle> {
    return this.request<LexwareArticle>(`/articles/${id}`);
  }

  async listInvoices(page = 0, size = 25): Promise<LexwarePageResponse<LexwareInvoice>> {
    const safeSize = Math.min(Math.max(1, size), 250); // §3.5: Max 250
    return this.request<LexwarePageResponse<LexwareInvoice>>('/invoices', {
      params: { page, size: safeSize },
    });
  }

  async getProfile(): Promise<any> {
    return this.request<any>('/profile');
  }
}
