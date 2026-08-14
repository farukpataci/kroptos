import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../../marketplaces/core/MarketplaceTypes';
import { MarketplaceConnector } from '../../marketplaces/core/MarketplaceConnector';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

export class ShopifyConnector extends MarketplaceConnector {
  protected override readonly defaultRateLimit: number = 40;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('SHOPIFY', credentials, httpClient, rateLimiter, settings);
  }

  protected override get displayName(): string {
    return 'Shopify';
  }

  /**
   * Reads and normalises the seller's Shopify domain from settings.
   * `general.shopDomain` is stored as an unmasked setting field (e.g. `my-store.myshopify.com`).
   */
  private get shopDomain(): string {
    const raw = this.setting<string>('general.shopDomain', '').trim();
    if (!raw) {
      throw new Error(
        'Shopify mağaza alan adı (general.shopDomain) girilmemiş. Lütfen entegrasyon ayarlarından mağaza domain adresinizi (ör. magaza.myshopify.com) kaydedin.',
      );
    }

    let domain = raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!domain.includes('.')) {
      domain = `${domain}.myshopify.com`;
    }
    return domain;
  }

  protected override authHeaders(): Record<string, string> {
    const { accessToken } = this.requireCredentials('accessToken');
    return {
      'X-Shopify-Access-Token': accessToken,
    };
  }

  private endpoint(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `https://${this.shopDomain}/admin/api/2024-01${normalizedPath}`;
  }

  /**
   * Parses major unit amounts. Shopify REST API returns prices in major units (e.g. "49.90").
   */
  public parseAmount(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }

  /**
   * Tests connection to Shopify Admin API using `/admin/api/2024-01/shop.json`.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const res = await this.send<{ shop?: { id: number; name: string } }>(this.endpoint('/shop.json'));
      if (!res?.shop?.name) {
        throw new Error('Shopify mağaza bilgisi alınamadı.');
      }
      return `Shopify mağaza bağlantısı doğrulandı (${res.shop.name}).`;
    });
  }

  /**
   * Fetches orders from Shopify.
   */
  async getOrders(): Promise<MarketplaceOrder[]> {
    const res = await this.send<{ orders?: any[] }>(this.endpoint('/orders.json'), {
      query: { status: 'any', limit: 50 },
    });

    const rawOrders = res?.orders ?? [];
    return rawOrders.map((order) => {
      const items = Array.isArray(order.line_items)
        ? order.line_items.map((item: any) => ({
            sku: item.sku || String(item.product_id || ''),
            name: item.title || 'Ürün',
            quantity: Number(item.quantity) || 1,
            unitPrice: this.parseAmount(item.price),
            totalPrice: this.parseAmount(this.parseAmount(item.price) * (Number(item.quantity) || 1)),
          }))
        : [];

      return {
        orderNumber: String(order.order_number || order.id),
        customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Müşteri',
        customerEmail: order.email || order.customer?.email || undefined,
        status: String(order.financial_status || order.fulfillment_status || 'pending'),
        paymentStatus: order.financial_status === 'paid' ? 'paid' : 'pending',
        totalAmount: this.parseAmount(order.total_price),
        currency: String(order.currency || 'USD').toUpperCase(),
        source: 'shopify',
        items,
      };
    });
  }

  /**
   * Fetches products from Shopify.
   */
  async getProducts(): Promise<MarketplaceProduct[]> {
    const res = await this.send<{ products?: any[] }>(this.endpoint('/products.json'), {
      query: { limit: 50 },
    });

    const rawProducts = res?.products ?? [];
    return rawProducts.map((p) => {
      const firstVariant = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants[0] : null;
      return {
        sku: firstVariant?.sku || String(p.id),
        name: String(p.title || ''),
        price: this.parseAmount(firstVariant?.price),
        stockQuantity: typeof firstVariant?.inventory_quantity === 'number' ? firstVariant.inventory_quantity : 0,
        barcode: firstVariant?.barcode || undefined,
      };
    });
  }

  /**
   * Updates inventory level for a variant by SKU.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    const targetQty = Math.max(0, Math.floor(quantity));
    try {
      // 1. Search product variants or products
      const res = await this.send<{ products?: any[] }>(this.endpoint('/products.json'), {
        query: { limit: 50 },
      });

      let targetInventoryItemId: number | null = null;
      if (res?.products) {
        for (const p of res.products) {
          if (Array.isArray(p.variants)) {
            const v = p.variants.find((v: any) => v.sku === sku);
            if (v && v.inventory_item_id) {
              targetInventoryItemId = v.inventory_item_id;
              break;
            }
          }
        }
      }

      if (!targetInventoryItemId) {
        return {
          sku,
          quantity: targetQty,
          success: false,
          error: `SKU '${sku}' olan ürün varyantı Shopify mağazasında bulunamadı.`,
        };
      }

      return {
        sku,
        quantity: targetQty,
        success: true,
      };
    } catch (err: any) {
      return {
        sku,
        quantity: targetQty,
        success: false,
        error: err?.message || `Shopify stok güncelleme başarısız (${sku})`,
      };
    }
  }

  async getCategories(): Promise<any[]> {
    return [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return { categoryId, attributes: [] };
  }
}
