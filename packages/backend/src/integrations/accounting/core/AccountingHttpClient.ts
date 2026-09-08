import { Injectable, Logger } from '@nestjs/common';
import { AccountingApiError } from './AccountingErrors';

export interface AccountingHttpRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  provider?: string;
}

@Injectable()
export class AccountingHttpClient {
  private readonly logger = new Logger(AccountingHttpClient.name);
  private readonly defaultTimeoutMs = 15000;

  async get<T = any>(url: string, options: AccountingHttpRequestOptions = {}): Promise<T> {
    return this.request<T>('GET', url, undefined, options);
  }

  async post<T = any>(url: string, data?: any, options: AccountingHttpRequestOptions = {}): Promise<T> {
    return this.request<T>('POST', url, data, options);
  }

  async put<T = any>(url: string, data?: any, options: AccountingHttpRequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', url, data, options);
  }

  async delete<T = any>(url: string, options: AccountingHttpRequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    options: AccountingHttpRequestOptions = {},
  ): Promise<T> {
    const provider = options.provider || 'ACCOUNTING';
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;

    let fullUrl = url;
    if (options.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        fullUrl += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const safeUrl = this.sanitizeUrl(fullUrl);
    this.logger.debug(`[${provider}] ${method} ${safeUrl}`);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: data ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
        signal: controller.signal,
      });

      const responseText = await response.text();
      let responseBody: any = null;
      if (responseText) {
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = responseText;
        }
      }

      if (!response.ok) {
        const errorMsg =
          (responseBody && typeof responseBody === 'object' && (responseBody.error || responseBody.message || JSON.stringify(responseBody))) ||
          `HTTP ${response.status} ${response.statusText}`;

        this.logger.warn(`[${provider}] Request failed: ${response.status} - ${errorMsg}`);
        throw new AccountingApiError(provider, response.status, String(errorMsg), responseBody);
      }

      return responseBody as T;
    } catch (err: any) {
      if (err instanceof AccountingApiError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new AccountingApiError(provider, 408, `Request timed out after ${timeoutMs}ms`);
      }
      throw new AccountingApiError(provider, 500, err.message || 'Unknown network error');
    } finally {
      clearTimeout(timeout);
    }
  }

  private sanitizeUrl(rawUrl: string): string {
    return rawUrl.replace(/(password|secret|token|client_secret)=([^&]+)/gi, '$1=***');
  }
}
