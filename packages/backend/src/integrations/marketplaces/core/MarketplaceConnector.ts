import {
  ConnectionTestResult,
  MarketplaceMode,
  MarketplaceModeSource,
  MarketplaceModeStamp,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from './MarketplaceTypes';
import { MarketplaceHttpClient, MarketplaceHttpError } from './MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter';

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
    return rotated && Object.keys(rotated).length > 0 ? rotated : undefined;
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
  // Live vs simulation
  //
  // A connector written from documentation that no seller account has confirmed
  // is worse than a missing one: it reports success, imports nothing, and the
  // seller believes the integration works. So a connector may declare itself
  // unverified, serve sample data instead of calling endpoints that do not
  // exist, and say so in every payload it hands back.
  //
  // Nothing here may fall back silently. Simulation makes no outbound request
  // at all, and a live call into an unverified endpoint fails loudly rather
  // than quietly returning sample rows.
  // --------------------------------------------------------------------------

  /**
   * What this connector does when nothing else selects a mode. `live` for every
   * marketplace whose endpoints are verified; a connector overrides it to
   * `simulation` while its endpoints are still unconfirmed.
   */
  protected readonly defaultMode: MarketplaceMode = 'live';

  /**
   * The resolved mode and what decided it: the seller's `general.mode` setting
   * wins, then the `MARKETPLACE_MODE` environment variable, then the
   * connector's own default.
   *
   * Public because the callers are the ones that must act on it — the worker
   * refuses to persist simulated rows, and the API hands the mode to the UI so
   * the badge is not guesswork.
   */
  get connectionMode(): { mode: MarketplaceMode; source: MarketplaceModeSource } {
    const configured = String(this.settings['general.mode'] ?? '').trim().toLowerCase();
    if (configured === 'live' || configured === 'simulation') {
      return { mode: configured, source: 'setting' };
    }

    const fromEnv = String(process.env.MARKETPLACE_MODE ?? '').trim().toLowerCase();
    if (fromEnv === 'live' || fromEnv === 'simulation') {
      return { mode: fromEnv, source: 'env' };
    }

    return { mode: this.defaultMode, source: 'default' };
  }

  protected get isSimulation(): boolean {
    return this.connectionMode.mode === 'simulation';
  }

  /** Spread into every result so no payload leaves here mode-ambiguous. */
  protected get modeStamp(): Required<MarketplaceModeStamp> {
    const { mode, source } = this.connectionMode;
    return { mode, modeSource: source };
  }

  /**
   * Refuses an operation whose endpoint has never been confirmed against a real
   * seller account. Throwing beats returning an empty list: an empty list reads
   * as "the marketplace has no orders" and is indistinguishable from success.
   */
  protected notImplemented(method: string): never {
    throw new Error(
      `${this.displayName} canlı uç noktası doğrulanmadı: ${method}. ` +
        `Sağlayıcı dokümanı doğrulanana kadar entegrasyonu simülasyon modunda kullanın ` +
        `(Ayarlar → Genel → Çalışma modu).`,
    );
  }

  // --------------------------------------------------------------------------
  // Order settings the manifest offers every provider
  //
  // Both of these were configurable in the UI and read by nobody: a seller
  // could fill in a status mapping or an order prefix, see it saved, and have
  // it silently ignored. They live here rather than in one connector so the
  // next provider inherits them instead of re-implementing them.
  // --------------------------------------------------------------------------

  /** Kroptos statuses a mapping may target — anything else is a stale row. */
  private static readonly MAPPABLE_STATUSES = [
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'returned',
  ];

  /**
   * Applies the seller's `orders.statusMap` to a marketplace status, falling
   * back to the connector's own mapping when there is no row for it.
   *
   * `rawStatus` is the marketplace's own spelling ('Created', 'Picking'); the
   * mapping table stores it lowercased.
   */
  protected mapOrderStatus(rawStatus: string, fallback: string): string {
    const map = this.setting<Record<string, string>>('orders.statusMap', {});
    if (!map || typeof map !== 'object') return fallback;

    const configured = map[String(rawStatus ?? '').trim().toLowerCase()];
    // A value outside the known set would be written straight to Order.status
    // and quietly break every status filter downstream, so it is ignored.
    return MarketplaceConnector.MAPPABLE_STATUSES.includes(configured) ? configured : fallback;
  }

  /**
   * Prepends `orders.numberPrefix` to an imported order number. Two
   * marketplaces can hand out the same number, and `Order.orderNumber` is
   * globally unique, so without a prefix the second one is silently treated as
   * an order that already exists.
   */
  protected prefixOrderNumber(orderNumber: string): string {
    const prefix = this.setting<string>('orders.numberPrefix', '');
    return prefix ? `${prefix}${orderNumber}` : orderNumber;
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
      /**
       * Per-call throttling, for a marketplace that publishes different quotas
       * for different service families. The seller's `advanced.rateLimitPerMinute`
       * still applies: the lower of the two wins, so raising the setting can
       * never push a call past the marketplace's own published limit.
       */
      rateLimit?: { key?: string; perMinute?: number };
    } = {},
  ): Promise<T> {
    if (options.rateLimit) {
      const { key, perMinute } = options.rateLimit;
      await this.rateLimiter.throttle(
        key ? `${this.rateLimitKey}:${key}` : this.rateLimitKey,
        perMinute === undefined ? this.rateLimitPerMinute : Math.min(perMinute, this.rateLimitPerMinute),
        60000,
      );
    } else {
      await this.throttle();
    }

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

    try {
      return await this.httpClient.request<T>(target.toString(), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
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
    const detail = this.describeUpstreamBody(
      error instanceof MarketplaceHttpError ? error.upstreamBody : undefined,
    );
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
        // `detail` belongs here most of all: a 400 is a validation answer, and
        // the body is the only place that says *which* field the marketplace
        // rejected. Dropping it left the UI showing a bare "status 400" — the
        // Trendyol storefrontCode bug hid behind exactly that for weeks.
        return new Error(
          error?.message
            ? `${name} isteği başarısız: ${error.message}${detail}`
            : `${name} isteği başarısız${detail}`,
        );
    }
  }

  /**
   * Renders the upstream body for a seller-facing message.
   *
   * A marketplace API answers with JSON that names the rejected field, and that
   * belongs in the message. But an edge proxy in front of the API answers with a
   * full HTML page — Trendyol's stage gateway returns Cloudflare's "you have
   * been blocked" page for every path — and pasting markup into the UI hides the
   * one fact that matters: nothing reached the marketplace at all.
   */
  private describeUpstreamBody(body?: string): string {
    const trimmed = body?.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('<')) {
      return (
        ' Sunucu API yerine bir HTML sayfası döndürdü; istek büyük olasılıkla ' +
        'pazaryerine ulaşmadan bir ağ geçidi/WAF tarafından engellendi.'
      );
    }

    return ` Sunucu yanıtı: ${trimmed.slice(0, 300)}`;
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
      return { success: true, message, durationMs: Date.now() - startTime, ...this.modeStamp };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${this.displayName} bağlantısı doğrulanamadı`,
        durationMs: Date.now() - startTime,
        ...this.modeStamp,
      };
    }
  }

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract getOrders(): Promise<MarketplaceOrder[]>;
  abstract getProducts(): Promise<MarketplaceProduct[]>;
  /**
   * `identifiers` carries the other names the same product goes by locally, for
   * marketplaces that key inventory on something other than the SKU — Trendyol
   * keys on the barcode. Optional so a connector that only needs the SKU can
   * keep the two-argument signature, and so a caller that has nothing else to
   * offer still works.
   */
  abstract updateStock(
    sku: string,
    quantity: number,
    identifiers?: { barcode?: string | null },
  ): Promise<StockUpdateResult>;
  abstract getCategories(): Promise<any[]>;
  abstract getCategoryAttributes(categoryId: string): Promise<any>;
}
