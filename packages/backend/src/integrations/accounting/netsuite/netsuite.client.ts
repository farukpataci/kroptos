import { BadRequestException } from '@nestjs/common';
import { NetSuiteCredentials } from './netsuite.types';
import { NetSuiteUriHelper } from './netsuite.uri';
import { NetSuiteAuthService } from './netsuite.auth';
import { NetSuiteErrorMapper } from './netsuite.error-mapper';
import { AccountingRateLimitError } from '../core/AccountingErrors';

export interface NetSuiteRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
}

/**
 * NetSuite HTTP İstemcisi (§5.1, §5.3, §5.10)
 *
 * KRİTİK YÖNETİŞİM KURALLARI:
 * 1. Eşzamanlılık 1: Hesap genelindeki havuzu korumak için entegrasyon başına varsayılan eşzamanlılık 1'dir.
 *    Aynı hesaba yapılan istekler Promise kuyruğu ile sıraya dizilir (§5.3).
 * 2. Host Doğrulaması: Giden her isteğin adresi accountId'ye göre doğrulanır; yabancı host'a istek engellenir (§5.1).
 * 3. 429 Üstel Geri Çekilme: HTTP 429 veya eşzamanlılık aşımında üstel geri çekilme + jitter ile sınırlı deneme yapılır;
 *    asla sıkı döngüye (tight loop) girilmez (§5.3).
 * 4. Hassas Sır Koruması: Private key veya JWT hata ve loglara sızdırılmaz (§5.2).
 */
export class NetSuiteHttpClient {
  // Hesap bazında eşzamanlılık kuyruk zinciri (Varsayılan eşzamanlılık: 1)
  private static accountQueues: Map<string, Promise<any>> = new Map();

  // Testlerde veya simülasyonda mock fetch fonksiyonu enjeksiyonu
  private fetchFn?: (url: string, init: any) => Promise<any>;

  constructor(
    private readonly credentials: NetSuiteCredentials,
    fetchFn?: (url: string, init: any) => Promise<any>,
  ) {
    this.fetchFn = fetchFn;
  }

  /**
   * Kuyruk zincirini temizler (testler için)
   */
  static clearQueues(): void {
    this.accountQueues.clear();
  }

  /**
   * İstekleri hesap kuyruğuna dizerek seri olarak (eşzamanlılık: 1) yürütür (§5.3).
   */
  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const accountKey = this.credentials.accountId.trim().toLowerCase();
    const currentQueue = NetSuiteHttpClient.accountQueues.get(accountKey) || Promise.resolve();

    let releaseResolve: () => void;
    const nextQueue = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });

    // Kuyruğu güncelle (sonraki gelen bu Promise'i bekler)
    NetSuiteHttpClient.accountQueues.set(
      accountKey,
      currentQueue.then(() => nextQueue).catch(() => nextQueue),
    );

    try {
      // Önceki işin bitmesini bekle
      await currentQueue;
      return await operation();
    } finally {
      // Sonraki işin önünü aç
      releaseResolve!();
    }
  }

  /**
   * HTTP isteği gönderir (Eşzamanlılık 1 kuyruğu + 429 üstel geri çekilme + host kontrolü)
   */
  async request<T = any>(url: string, options: NetSuiteRequestOptions = {}): Promise<T> {
    // 1. Host Güvenlik Doğrulaması (§5.1)
    NetSuiteUriHelper.validateHost(url, this.credentials.accountId);

    return this.enqueue(async () => {
      return this.executeWithBackoff<T>(url, options);
    });
  }

  /**
   * HTTP isteğini üstel geri çekilme mantığıyla yürütür (§5.3)
   */
  private async executeWithBackoff<T>(
    url: string,
    options: NetSuiteRequestOptions,
    attempt = 1,
  ): Promise<T> {
    const maxAttempts = 3;
    const baseBackoffMs = 1000;

    let accessToken = '';
    if (!options.skipAuth) {
      accessToken = await NetSuiteAuthService.getValidAccessToken(this.credentials, this.fetchFn);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchImpl = this.fetchFn || (globalThis.fetch as any);
    if (!fetchImpl) {
      throw new BadRequestException('[NetSuite Client] Global fetch desteklenmiyor.');
    }

    let response: any;
    try {
      response = await fetchImpl(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (networkErr: any) {
      // Ağ hatası durumunda host güvenliğini koru
      throw new BadRequestException(`[NetSuite Client] Bağlantı hatası: ${networkErr?.message}`);
    }

    // HTTP 429 Too Many Requests kontrolü (§5.3)
    if (response.status === 429) {
      if (attempt < maxAttempts) {
        const retryAfterHeader = response.headers?.get?.('Retry-After');
        const parsedRetryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : null;

        // Üstel geri çekilme + jitter
        const jitter = Math.random() * 200;
        const delayMs = parsedRetryAfter || Math.min(16000, baseBackoffMs * Math.pow(2, attempt - 1) + jitter);

        await new Promise((res) => setTimeout(res, delayMs));
        return this.executeWithBackoff<T>(url, options, attempt + 1);
      }

      // Deneme sayısı bittiğinde standart kota hatası fırlat
      throw NetSuiteErrorMapper.map(429, { message: 'Concurrency limit exceeded' });
    }

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw NetSuiteErrorMapper.map(response.status, errorBody);
    }

    if (response.status === 204) {
      return {} as T;
    }

    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  }
}
