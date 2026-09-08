import { Injectable, Logger } from '@nestjs/common';
import { AccountingApiError } from './AccountingErrors';

export interface AccountingHttpRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  provider?: string;
  contentType?: 'json' | 'form';
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

  private encodeFormBody(obj: any, prefix = ''): string {
    if (!obj || typeof obj !== 'object') return String(obj ?? '');
    const pairs: string[] = [];
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val === undefined || val === null) continue;
      const propKey = prefix ? `${prefix}[${key}]` : key;
      if (typeof val === 'object' && !(val instanceof Date)) {
        pairs.push(this.encodeFormBody(val, propKey));
      } else {
        pairs.push(`${encodeURIComponent(propKey)}=${encodeURIComponent(String(val))}`);
      }
    }
    return pairs.filter(Boolean).join('&');
  }

  static enforceHttps(url: string): string {
    if (url.startsWith('http://')) {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
          return url.replace(/^http:\/\//i, 'https://');
        }
      } catch {
        return url.replace(/^http:\/\//i, 'https://');
      }
    }
    return url;
  }

  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    options: AccountingHttpRequestOptions = {},
  ): Promise<T> {
    const provider = options.provider || 'ACCOUNTING';
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const contentType = options.contentType || 'json';

    let fullUrl = AccountingHttpClient.enforceHttps(url);
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
      'Content-Type': contentType === 'form' ? 'application/x-www-form-urlencoded' : 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const safeUrl = this.sanitizeUrl(fullUrl);
    this.logger.debug(`[${provider}] ${method} ${safeUrl}`);

    let body: string | undefined;
    if (data !== undefined && data !== null) {
      if (typeof data === 'string') {
        body = data;
      } else if (contentType === 'form') {
        body = this.encodeFormBody(data);
      } else {
        body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body,
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
