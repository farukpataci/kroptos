import { Injectable, Logger } from '@nestjs/common';
import {
  AccountingNetworkError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { CegidUriHelper } from './cegid.uri';

export interface CegidClientOptions {
  instanceUrl: string;
  endpointName?: string;
  endpointVersion?: string;
  branchId?: string;
}

export interface CegidHttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pathOrUrl: string;
  body?: any;
  headers?: Record<string, string>;
  token?: string;
}

@Injectable()
export class CegidHttpClient {
  private readonly logger = new Logger(CegidHttpClient.name);

  // Eşzamanlılık 1 kuralı için serialization kuyruğu (§6.5)
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: CegidClientOptions) {}

  /**
   * İstekleri eşzamanlılık 1 disipliniyle sıraya alır ve yürütür (§6.5).
   */
  async request<T>(req: CegidHttpRequestOptions): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue = this.requestQueue
        .then(async () => {
          try {
            const result = await this.executeWithRetry<T>(req);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .catch((err) => {
          // Kuyruk zincirinin kırılmasını önle
          reject(err);
        });
    });
  }

  /**
   * Üstel geri çekilme ve Retry-After incelemesi ile istek yürütür (§6.5).
   */
  private async executeWithRetry<T>(
    req: CegidHttpRequestOptions,
    attempt = 1,
    maxAttempts = 3,
  ): Promise<T> {
    const fullUrl = req.pathOrUrl.startsWith('https://')
      ? req.pathOrUrl
      : `${CegidUriHelper.cleanBaseUrl(this.options.instanceUrl)}${
          req.pathOrUrl.startsWith('/') ? '' : '/'
        }${req.pathOrUrl}`;

    // Katı Host Doğrulaması (§5.1, §6.1)
    CegidUriHelper.validateHost(fullUrl, this.options.instanceUrl);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(req.headers || {}),
    };

    if (req.token) {
      headers['Authorization'] = `Bearer ${req.token}`;
    }

    if (this.options.branchId) {
      headers['PX-Branch'] = this.options.branchId;
    }

    try {
      const response = await fetch(fullUrl, {
        method: req.method,
        headers,
        body: req.body ? JSON.stringify(req.body) : undefined,
      });

      // 429 Too Many Requests
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSec = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) || 5
          : 5;

        if (attempt < maxAttempts) {
          const jitter = Math.random() * 500;
          const waitMs = retryAfterSec * 1000 + jitter;
          this.logger.warn(
            `[CegidClient] 429 Rate limit alındı. ${waitMs}ms sonra tekrar denenecek (${attempt}/${maxAttempts})...`,
          );
          await new Promise((r) => setTimeout(r, waitMs));
          return this.executeWithRetry<T>(req, attempt + 1, maxAttempts);
        }

        throw new AccountingRateLimitError('CEGID-XRP-FLEX', retryAfterSec);
      }

      // 503 Service Unavailable / Geçici Hata
      if (response.status === 503 && attempt < maxAttempts) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 300;
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.executeWithRetry<T>(req, attempt + 1, maxAttempts);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let parsedJson: any = null;
        try {
          parsedJson = JSON.parse(errorText);
        } catch {
          // not json
        }

        const error = new Error(
          parsedJson?.message ||
            parsedJson?.exceptionMessage ||
            `HTTP ${response.status}: ${errorText}`,
        );
        (error as any).status = response.status;
        (error as any).responseBody = parsedJson || errorText;
        throw error;
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return null as unknown as T;
      }

      return JSON.parse(text) as T;
    } catch (err: any) {
      if (err instanceof AccountingRateLimitError) {
        throw err;
      }

      if (err.name === 'FetchError' || err.code === 'ECONNRESET') {
        throw new AccountingNetworkError('CEGID-XRP-FLEX', err.message);
      }

      throw err;
    }
  }
}
