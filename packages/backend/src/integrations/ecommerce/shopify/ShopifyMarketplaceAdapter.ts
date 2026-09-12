import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../../marketplaces/core/MarketplaceTypes';
import { MarketplaceConnector } from '../../marketplaces/core/MarketplaceConnector';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';
import { ShopifyConnector } from './ShopifyConnector';
import { EcommerceHttpClient, EcommerceRateLimiter } from '../core';

/**
 * Adapter allowing Shopify to be consumed seamlessly through the legacy MarketplaceConnector
 * interface whenever a caller asks MarketplaceConnectorFactory for it.
 */
export class ShopifyMarketplaceAdapter extends MarketplaceConnector {
  private readonly delegate: ShopifyConnector;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('SHOPIFY', credentials, httpClient, rateLimiter, settings);
    const ecommerceHttpClient = new EcommerceHttpClient();
    const ecommerceRateLimiter = new EcommerceRateLimiter();
    this.delegate = new ShopifyConnector(credentials, ecommerceHttpClient, ecommerceRateLimiter, settings);
  }

  override async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    const res = await this.delegate.testConnection();
    return {
      success: res.success,
      message: res.message,
      durationMs: Date.now() - start,
      mode: 'live',
      modeSource: 'default',
    };
  }

  override async getOrders(): Promise<MarketplaceOrder[]> {
    const orders = await this.delegate.fetchOrders();
    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.customer?.fullName || 'Müşteri',
      customerEmail: o.customer?.email,
      status: o.orderStatus,
      paymentStatus: o.financialStatus === 'paid' ? 'paid' : 'pending',
      totalAmount: o.totalPrice,
      currency: o.currency,
      source: 'shopify',
      items: o.items.map((i) => ({
        sku: i.sku || i.id,
        name: i.title,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
      })),
    }));
  }

  override async getProducts(): Promise<MarketplaceProduct[]> {
    const products = await this.delegate.fetchProducts();
    return products.flatMap((p) =>
      p.variants.map((v) => ({
        sku: v.sku || `${p.id}-${v.id}`,
        name: `${p.title}${v.title && v.title !== 'Default Title' ? ` - ${v.title}` : ''}`,
        price: v.price,
        stockQuantity: v.inventoryQuantity,
        barcode: v.barcode,
      })),
    );
  }

  override async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    const res = await this.delegate.updateInventory({ sku, availableQuantity: quantity });
    return {
      sku,
      quantity,
      success: res.success,
      error: res.success ? undefined : res.message,
    };
  }

  override async getCategories(): Promise<any[]> {
    return [];
  }

  override async getCategoryAttributes(categoryId: string): Promise<any> {
    return { categoryId, attributes: [] };
  }
}
