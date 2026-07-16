import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from './MarketplaceTypes';
import { MarketplaceHttpClient } from './MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter';

export abstract class MarketplaceConnector {
  protected constructor(
    protected readonly provider: string,
    protected readonly credentials: Record<string, any>,
    protected readonly httpClient: MarketplaceHttpClient,
    protected readonly rateLimiter: MarketplaceRateLimiter,
  ) {}

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract getOrders(): Promise<MarketplaceOrder[]>;
  abstract getProducts(): Promise<MarketplaceProduct[]>;
  abstract updateStock(sku: string, quantity: number): Promise<StockUpdateResult>;
}
