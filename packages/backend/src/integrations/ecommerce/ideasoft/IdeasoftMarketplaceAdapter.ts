import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../../marketplaces/core/MarketplaceTypes';
import { MarketplaceConnector } from '../../marketplaces/core/MarketplaceConnector';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';
import { IdeasoftConnector } from './IdeasoftConnector';
import { EcommerceHttpClient, EcommerceRateLimiter } from '../core';

/**
 * Adapter allowing IdeaSoft to be consumed through the MarketplaceConnector
 * interface whenever a caller queries MarketplaceConnectorFactory.
 */
export class IdeasoftMarketplaceAdapter extends MarketplaceConnector {
  private readonly delegate: IdeasoftConnector;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('IDEASOFT', credentials, httpClient, rateLimiter, settings);
    const ecommerceHttpClient = new EcommerceHttpClient();
    const ecommerceRateLimiter = new EcommerceRateLimiter();
    this.delegate = new IdeasoftConnector(credentials, ecommerceHttpClient, ecommerceRateLimiter, settings);
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
      marketplaceOrderNumber: o.id,
      customerName: o.customer?.fullName || 'Müşteri',
      customerEmail: o.customer?.email,
      customerPhone: o.customer?.phone,
      status: o.orderStatus,
      paymentStatus: o.financialStatus === 'paid' ? 'paid' : 'pending',
      totalAmount: o.totalPrice,
      currency: o.currency,
      source: 'ideasoft',
      shippingAddress: o.shippingAddress
        ? [o.shippingAddress.address1, o.shippingAddress.province, o.shippingAddress.city, o.shippingAddress.country].filter(Boolean).join(' ')
        : undefined,
      shippingFullName: o.shippingAddress?.fullName,
      shippingPhone: o.shippingAddress?.phone,
      shippingLine1: o.shippingAddress?.address1,
      shippingCity: o.shippingAddress?.city,
      shippingDistrict: o.shippingAddress?.province,
      shippingPostalCode: o.shippingAddress?.postalCode,
      shippingCountryCode: o.shippingAddress?.country,
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
        sku: v.sku || p.id,
        name: p.title,
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
    return this.delegate.getCategories();
  }

  override async getCategoryAttributes(categoryId: string): Promise<any> {
    return { categoryId, attributes: [] };
  }
}
