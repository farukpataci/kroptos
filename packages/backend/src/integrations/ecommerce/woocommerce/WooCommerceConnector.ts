import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../../marketplaces/core/MarketplaceTypes';
import { MarketplaceConnector } from '../../marketplaces/core/MarketplaceConnector';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

export class WooCommerceConnector extends MarketplaceConnector {
  protected override readonly defaultRateLimit: number = 60;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('WOOCOMMERCE', credentials, httpClient, rateLimiter, settings);
  }

  protected override get displayName(): string {
    return 'WooCommerce';
  }

  /**
   * Reads and normalises the seller's WooCommerce site URL from settings.
   * `general.shopUrl` is stored as an unmasked setting field.
   */
  private get shopBaseUrl(): string {
    const raw = this.setting<string>('general.shopUrl', '').trim();
    if (!raw) {
      throw new Error(
        'WooCommerce mağaza adresi (general.shopUrl) girilmemiş. Lütfen entegrasyon ayarlarından mağaza URL adresinizi kaydedin.',
      );
    }

    let urlStr = raw;
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = `https://${urlStr}`;
    }

    // Strip trailing slashes
    urlStr = urlStr.replace(/\/+$/, '');
    return urlStr;
  }

  protected override authHeaders(): Record<string, string> {
    const { consumerKey, consumerSecret } = this.requireCredentials('consumerKey', 'consumerSecret');
    const token = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    return {
      Authorization: `Basic ${token}`,
    };
  }

  /**
   * Helper to build absolute WooCommerce REST API endpoints (v3 API).
   */
  private endpoint(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.shopBaseUrl}/wp-json/wc/v3${normalizedPath}`;
  }

  /**
   * Converts a major unit price string/number (e.g. 49.90 or "49.90") to major numeric float.
   * WooCommerce reports prices in major units (e.g., "49.90").
   */
  public parseAmount(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }

  /**
   * Probes the WooCommerce site using `/wp-json/wc/v3/products?per_page=1`.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const res = await this.send<{ id?: number; name?: string }[] | Record<string, any>>(
        this.endpoint('/products'),
        { query: { per_page: 1 } },
      );

      if (!res) {
        throw new Error('WooCommerce API sunucusundan boş yanıt alındı.');
      }
      return 'WooCommerce mağaza bağlantısı doğrulandı.';
    });
  }

  /**
   * Fetches recent orders from WooCommerce.
   */
  async getOrders(): Promise<MarketplaceOrder[]> {
    const rawOrders = await this.send<any[]>(this.endpoint('/orders'), {
      query: { per_page: 50, order: 'desc', orderby: 'date' },
    });

    if (!Array.isArray(rawOrders)) return [];

    return rawOrders.map((order) => {
      const items = Array.isArray(order.line_items)
        ? order.line_items.map((item: any) => ({
            sku: item.sku || String(item.product_id || ''),
            name: item.name || 'Ürün',
            quantity: Number(item.quantity) || 1,
            unitPrice: this.parseAmount(item.price),
            totalPrice: this.parseAmount(item.total),
          }))
        : [];

      return {
        orderNumber: String(order.number || order.id),
        customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Müşteri',
        customerEmail: order.billing?.email || undefined,
        status: String(order.status || 'pending'),
        paymentStatus: order.date_paid ? 'paid' : 'pending',
        totalAmount: this.parseAmount(order.total),
        currency: String(order.currency || 'TRY').toUpperCase(),
        source: 'woocommerce',
        items,
      };
    });
  }

  /**
   * Fetches products from WooCommerce.
   */
  async getProducts(): Promise<MarketplaceProduct[]> {
    const rawProducts = await this.send<any[]>(this.endpoint('/products'), {
      query: { per_page: 50 },
    });

    if (!Array.isArray(rawProducts)) return [];

    return rawProducts.map((p) => ({
      sku: p.sku || String(p.id),
      name: String(p.name || ''),
      price: this.parseAmount(p.price || p.regular_price),
      stockQuantity: typeof p.stock_quantity === 'number' ? p.stock_quantity : 0,
      barcode: p.sku || undefined,
    }));
  }

  /**
   * Updates product or variant stock quantity by SKU.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    const targetQty = Math.max(0, Math.floor(quantity));
    try {
      // 1. Find product or variation by SKU
      const searchRes = await this.send<any[]>(this.endpoint('/products'), {
        query: { sku },
      });

      if (!Array.isArray(searchRes) || searchRes.length === 0) {
        return {
          sku,
          quantity: targetQty,
          success: false,
          error: `SKU '${sku}' olan ürün WooCommerce mağazasında bulunamadı.`,
        };
      }

      const product = searchRes[0];
      const productId = product.id;

      // 2. Update stock_quantity
      await this.send(this.endpoint(`/products/${productId}`), {
        method: 'PUT',
        body: {
          manage_stock: true,
          stock_quantity: targetQty,
        },
      });

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
        error: err?.message || `WooCommerce stok güncelleme başarısız (${sku})`,
      };
    }
  }

  /**
   * Fetches store product categories.
   */
  async getCategories(): Promise<any[]> {
    const rawCats = await this.send<any[]>(this.endpoint('/products/categories'), {
      query: { per_page: 100 },
    });

    if (!Array.isArray(rawCats)) return [];

    return rawCats.map((c) => ({
      id: String(c.id),
      name: c.name,
      parentId: c.parent ? String(c.parent) : null,
    }));
  }

  /**
   * WooCommerce categories don't have separate fixed attribute trees like marketplaces.
   */
  async getCategoryAttributes(categoryId: string): Promise<any> {
    return {
      categoryId,
      attributes: [],
    };
  }
}
