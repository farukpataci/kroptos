import { ErpConnectionTestResult, ErpOrder, ErpProduct, ErpStock } from './ErpTypes';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

export abstract class ErpConnector {
  protected constructor(
    protected readonly provider: string,
    protected readonly credentials: Record<string, any>,
    protected readonly httpClient: MarketplaceHttpClient,
    protected readonly rateLimiter: MarketplaceRateLimiter,
  ) {}

  abstract testConnection(): Promise<ErpConnectionTestResult>;
  abstract getProducts(): Promise<ErpProduct[]>;
  abstract updateStock(sku: string, quantity: number): Promise<any>;
  abstract createSalesOrder(order: ErpOrder): Promise<any>;
}
