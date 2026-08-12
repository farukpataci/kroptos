import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from './MarketplaceTypes';
import { MarketplaceHttpClient, MarketplaceHttpError } from './MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter';
// TEMPORARY (live-verification round): remove with IntegrationTrace.
import { trace, traceHeaders } from './IntegrationTrace';

export abstract class MarketplaceConnector {
  protected constructor(
    protected readonly provider: string,
    protected readonly credentials: Record<string, any>,
    protected readonly httpClient: MarketplaceHttpClient,
    protected readonly rateLimiter: MarketplaceRateLimiter,
    /**
     * Resolved integration settings (manifest defaults merged with what the
     * user saved). Empty for callers that build a connector purely to test
     * credentials, before any settings exist.
     */
    protected readonly settings: Record<string, unknown> = {},
  ) {}

  /** Reads one setting by its manifest key, falling back when it is unset. */
  protected setting<T>(key: string, fallback: T): T {
    const value = this.settings[key];
    return value === undefined || value === null ? fallback : (value as T);
  }

  // --------------------------------------------------------------------------
  // Rotated credentials
  //
  // Some marketplaces hand back a *new* refresh token every time the old one is
  // exchanged. Keeping that value only in memory means the integration works
  // until the process restarts and then fails to authenticate for good — the
  // seller has to paste a fresh token even though nothing they did was wrong.
  //
  // The connector cannot persist it itself: it holds credentials as a plain
  // read-only object and has no database. So it records the new value and the
  // caller — which does have the integration id and Prisma — collects it after
  // the operation. A pull rather than a callback: no async side effect fires
  // from inside a connector, and a caller that forgets simply persists nothing
  // instead of writing at an unpredictable moment.
  // --------------------------------------------------------------------------

  private rotatedCredentials?: Record<string, string>;

  /** Called by a subclass when the marketplace issues replacement credentials. */
  protected recordRotatedCredentials(patch: Record<string, string>): void {
    // TEMPORARY (live-verification round): keys only, never values.
    trace(`${this.provider} recordRotatedCredentials`, { keys: Object.keys(patch).join(',') });
    this.rotatedCredentials = { ...this.rotatedCredentials, ...patch };
  }

  /**
   * Credentials that changed during this connector's lifetime, or `undefined`
   * when nothing rotated. Clears on read so a caller cannot persist the same
   * rotation twice.
   */
  consumeRotatedCredentials(): Record<string, string> | undefined {
    const rotated = this.rotatedCredentials;
    this.rotatedCredentials = undefined;
    const result = rotated && Object.keys(rotated).length > 0 ? rotated : undefined;
    // TEMPORARY (live-verification round): did the caller find anything?
    trace(`${this.provider} consumeRotatedCredentials`, {
      found: Boolean(result),
      keys: result ? Object.keys(result).join(',') : '',
    });
    return result;
  }

  /**
   * Requests per minute this connector may make. Comes from
   * `advanced.rateLimitPerMinute`, which each provider manifest defaults to
   * that marketplace's published quota.
   */
  protected get rateLimitPerMinute(): number {
    const configured = Number(this.settings['advanced.rateLimitPerMinute']);
    return Number.isFinite(configured) && configured > 0 ? configured : this.defaultRateLimit;
  }

  /** Used when no settings row exists yet; overridden per marketplace. */
  protected readonly defaultRateLimit: number = 60;

  /**
   * Throttling bucket. Defaults to the provider name, which is right when one
   * provider means one upstream quota. A connector whose quota is really per
   * storefront or per account overrides this — otherwise a busy scope stalls a
   * quiet one that shares the name.
   */
  protected get rateLimitKey(): string {
    return this.provider;
  }

  /** Convenience wrapper so call sites do not repeat the window. */
  protected throttle(): Promise<void> {
    return this.rateLimiter.throttle(this.rateLimitKey, this.rateLimitPerMinute, 60000);
  }

  /** Which environment the manifest's `general.environment` field selected. */
  protected get environment(): string {
    return this.setting<string>('general.environment', 'production');
  }

  // --------------------------------------------------------------------------
  // Shared transport
  //
  // Every marketplace needs the same four things around a request: throttle,
  // attach credentials, build the query string, and turn a transport failure
  // into a sentence a seller can act on. Only the credential part differs, so
  // that is the single hook subclasses override.
  // --------------------------------------------------------------------------

  /**
   * Provider-specific authentication headers. Defaults to none so a connector
   * that has not been wired to a real API yet still compiles.
   *
   * May return a promise: OAuth marketplaces have to exchange a refresh token
   * for a short-lived access token before they can sign a request.
   */
  protected authHeaders(): Record<string, string> | Promise<Record<string, string>> {
    return {};
  }

  /**
   * Performs one authenticated, throttled JSON call and normalises failures.
   * `url` must already be absolute: hosts differ per marketplace and sometimes
   * per API family within one marketplace.
   */
  protected async send<T>(
    url: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    await this.throttle();

    const target = new URL(url);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        target.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(await this.authHeaders()),
      ...(options.headers ?? {}),
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    }

    // TEMPORARY (live-verification round): see IntegrationTrace.
    traceHeaders(`${this.provider} request ${options.method ?? 'GET'} ${target.pathname}`, headers);

    try {
      const result = await this.httpClient.request<T>(target.toString(), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      trace(`${this.provider} response ok`, { path: target.pathname });
      return result;
    } catch (error) {
      trace(`${this.provider} response failed`, {
        path: target.pathname,
        upstreamStatus: error instanceof MarketplaceHttpError ? error.upstreamStatus : undefined,
      });
      throw this.describeError(error);
    }
  }

  /**
   * Turns a transport error into something a seller can act on. Without this the
   * UI shows "status 401" and the user cannot tell a wrong secret from a wrong
   * environment. Subclasses may override to add marketplace-specific hints.
   */
  protected describeError(error: any): Error {
    const status = error instanceof MarketplaceHttpError ? error.upstreamStatus : undefined;
    const detail =
      error instanceof MarketplaceHttpError && error.upstreamBody
        ? ` Sunucu yanıtı: ${error.upstreamBody.slice(0, 300)}`
        : '';
    const name = this.displayName;

    switch (status) {
      case 401:
      case 403:
        return new Error(
          `${name} kimlik doğrulaması reddedildi (${status}). API anahtarları hatalı olabilir ` +
            `veya satıcı hesabı bu anahtarlara ait değil.${detail}`,
        );
      case 404:
        return new Error(
          `${name} uç noktası bulunamadı (404). Satıcı kimliği veya ortam seçimi hatalı olabilir.${detail}`,
        );
      case 429:
        return new Error(
          `${name} istek limiti aşıldı (429). Ayarlardan advanced.rateLimitPerMinute değerini düşürün.${detail}`,
        );
      default:
        if (status && status >= 500) {
          return new Error(`${name} tarafında geçici hata (${status}). Daha sonra tekrar deneyin.${detail}`);
        }
        return new Error(
          error?.message ? `${name} isteği başarısız: ${error.message}` : `${name} isteği başarısız`,
        );
    }
  }

  /** Human-readable marketplace name used in error messages. */
  protected get displayName(): string {
    return this.provider.charAt(0) + this.provider.slice(1).toLowerCase();
  }

  /**
   * Fails before any request when a required credential is blank. A missing
   * field is a configuration mistake, and saying which one is empty beats
   * letting the marketplace answer with a generic 401.
   */
  protected requireCredentials<K extends string>(...keys: K[]): Record<K, string> {
    const resolved = {} as Record<K, string>;
    const missing: string[] = [];

    for (const key of keys) {
      const value = String(this.credentials[key] ?? '').trim();
      if (!value) missing.push(key);
      resolved[key] = value;
    }

    if (missing.length > 0) {
      throw new Error(`${this.displayName} kimlik bilgileri eksik: ${missing.join(', ')}`);
    }

    return resolved;
  }

  /**
   * Runs `testConnection` bookkeeping around a provider-supplied probe so every
   * marketplace reports duration and failure the same way.
   */
  protected async probe(run: () => Promise<string>): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const message = await run();
      return { success: true, message, durationMs: Date.now() - startTime };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${this.displayName} bağlantısı doğrulanamadı`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract getOrders(): Promise<MarketplaceOrder[]>;
  abstract getProducts(): Promise<MarketplaceProduct[]>;
  abstract updateStock(sku: string, quantity: number): Promise<StockUpdateResult>;
  abstract getCategories(): Promise<any[]>;
  abstract getCategoryAttributes(categoryId: string): Promise<any>;
}
