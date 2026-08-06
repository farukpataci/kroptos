import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from './MarketplaceTypes';
import { MarketplaceHttpClient } from './MarketplaceHttpClient';
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

  /** Convenience wrapper so call sites do not repeat the window. */
  protected throttle(): Promise<void> {
    return this.rateLimiter.throttle(this.provider, this.rateLimitPerMinute, 60000);
  }

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract getOrders(): Promise<MarketplaceOrder[]>;
  abstract getProducts(): Promise<MarketplaceProduct[]>;
  abstract updateStock(sku: string, quantity: number): Promise<StockUpdateResult>;
  abstract getCategories(): Promise<any[]>;
  abstract getCategoryAttributes(categoryId: string): Promise<any>;
}
