import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { WooUrlGuard } from './WooUrlGuard';
import { WooCommerceMapper } from './WooCommerceMapper';
import {
  WooCommerceProductVariation,
  WooCommerceRawCategory,
  WooCommerceRawOrder,
  WooCommerceRawProduct,
  WooCommerceSystemStatus,
} from './WooCommerceTypes';

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
   * Resolves, guards against SSRF, and normalizes the store URL.
   * Checks credentials.baseUrl first, falling back to settings.general.shopUrl.
   */
  private async getResolvedBaseUrl(): Promise<string> {
    const raw = String(
      this.credentials.baseUrl || this.setting<string>('general.shopUrl', ''),
    ).trim();

    return await WooUrlGuard.validateAndNormalize(raw);
  }

  protected override async authHeaders(): Promise<Record<string, string>> {
    const { consumerKey, consumerSecret } = this.requireCredentials('consumerKey', 'consumerSecret');
    const token = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    return {
      Authorization: `Basic ${token}`,
    };
  }

  /**
   * Builds the absolute endpoint URL for WooCommerce REST API v3.
   */
  private async endpoint(path: string): Promise<string> {
    const baseUrl = await this.getResolvedBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}/wp-json/wc/v3${normalizedPath}`;
  }

  /**
   * Diagnostic connection test with detailed error reporting (docs §4.4).
   * 
   * Steps:
   * 1. Check /wp-json/ for namespaces including 'wc/v3'.
   * 2. Probe authenticated endpoint (system_status or products).
   * 3. Read environment info (WC version, WP version, currency, tax rules).
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const baseUrl = await this.getResolvedBaseUrl();

      // Step 1: Probe root WordPress REST index
      let rootIndex: { namespaces?: string[] } | null = null;
      try {
        rootIndex = await this.httpClient.request<{ namespaces?: string[] }>(
          `${baseUrl}/wp-json/`,
          { method: 'GET', headers: { Accept: 'application/json' } },
        );
      } catch (err: any) {
        if (err?.upstreamStatus === 404) {
          throw new Error(
            'WordPress REST API uç noktası (404) bulunamadı. Lütfen WordPress admin panelinden ' +
              'Ayarlar -> Kalıcı Bağlantılar (Permalinks) ayarının "Düz" (Plain) dışında bir değere ayarlı olduğundan emin olun.',
          );
        }
        throw new Error(`WordPress REST API erişilemedi: ${err?.message || 'Bilinmeyen ağ hatası'}`);
      }

      if (!rootIndex?.namespaces?.includes('wc/v3')) {
        throw new Error(
          'WooCommerce REST API v3 bulunamadı. Lütfen mağazanızda WooCommerce eklentisinin aktif olduğundan emin olun.',
        );
      }

      // Step 2 & 3: Authenticated probe for Read/Write capability & system status
      try {
        const systemStatus = await this.send<WooCommerceSystemStatus>(
          await this.endpoint('/system_status'),
          { query: {} },
        );

        const wcVersion = systemStatus?.environment?.version || 'v3';
        const currency = systemStatus?.settings?.currency || 'TRY';
        const pricesIncludeTax = systemStatus?.settings?.prices_include_tax ? 'KDV Dahil' : 'KDV Hariç';

        return `WooCommerce bağlantısı başarılı (WC: ${wcVersion}, Para Birimi: ${currency}, ${pricesIncludeTax}).`;
      } catch {
        // Fallback probe in case system_status permissions are restricted
        const productsProbe = await this.send<any[]>(
          await this.endpoint('/products'),
          { query: { per_page: 1 } },
        );

        if (!Array.isArray(productsProbe)) {
          throw new Error('WooCommerce API sunucusundan geçersiz yanıt alındı.');
        }

        return 'WooCommerce mağaza bağlantısı başarıyla doğrulandı.';
      }
    });
  }

  /**
   * Fetches orders from WooCommerce.
   */
  async getOrders(params?: {
    modifiedAfter?: string;
    page?: number;
    perPage?: number;
    status?: string;
  }): Promise<MarketplaceOrder[]> {
    const query: Record<string, string | number | boolean | undefined> = {
      per_page: params?.perPage ?? 50,
      page: params?.page ?? 1,
      order: 'asc',
      orderby: 'modified',
    };

    if (params?.modifiedAfter) {
      query.modified_after = params.modifiedAfter;
      query.dates_are_gmt = true;
    }
    if (params?.status) {
      query.status = params.status;
    }

    const rawOrders = await this.send<WooCommerceRawOrder[]>(
      await this.endpoint('/orders'),
      { query },
    );

    if (!Array.isArray(rawOrders)) return [];

    const orders: MarketplaceOrder[] = [];
    for (const raw of rawOrders) {
      const mapped = WooCommerceMapper.toMarketplaceOrder(raw);
      if (mapped) {
        // Apply user-configured status mapping if any
        mapped.status = this.mapOrderStatus(raw.status, mapped.status);
        mapped.orderNumber = this.prefixOrderNumber(mapped.orderNumber);
        orders.push(mapped);
      }
    }

    return orders;
  }

  /**
   * Fetches products catalogue including variations for variable products.
   */
  async getProducts(): Promise<MarketplaceProduct[]> {
    const rawProducts = await this.send<WooCommerceRawProduct[]>(
      await this.endpoint('/products'),
      { query: { per_page: 50 } },
    );

    if (!Array.isArray(rawProducts)) return [];

    const products: MarketplaceProduct[] = [];

    for (const p of rawProducts) {
      if (p.type === 'variable' && Array.isArray(p.variations) && p.variations.length > 0) {
        try {
          const variations = await this.send<WooCommerceProductVariation[]>(
            await this.endpoint(`/products/${p.id}/variations`),
            { query: { per_page: 100 } },
          );

          if (Array.isArray(variations) && variations.length > 0) {
            for (const v of variations) {
              products.push(WooCommerceMapper.toMarketplaceProduct(p, v));
            }
            continue;
          }
        } catch {
          // If variations fail to load, fallback to parent
        }
      }

      products.push(WooCommerceMapper.toMarketplaceProduct(p));
    }

    return products;
  }

  /**
   * Updates product or variant stock quantity by SKU.
   */
  async updateStock(
    sku: string,
    quantity: number,
    identifiers?: { barcode?: string | null },
  ): Promise<StockUpdateResult> {
    const targetQty = Math.max(0, Math.floor(quantity));
    const targetStatus = targetQty > 0 ? 'instock' : 'outofstock';

    try {
      // 1. Search product by SKU
      const searchRes = await this.send<WooCommerceRawProduct[]>(
        await this.endpoint('/products'),
        { query: { sku } },
      );

      if (Array.isArray(searchRes) && searchRes.length > 0) {
        const product = searchRes[0];
        await this.send(await this.endpoint(`/products/${product.id}`), {
          method: 'PUT',
          body: {
            manage_stock: true,
            stock_quantity: targetQty,
            stock_status: targetStatus,
          },
        });

        return { sku, quantity: targetQty, success: true };
      }

      // 2. If not found as top-level product, check if it's a variation
      // We can query products that are variable or search across variations
      return {
        sku,
        quantity: targetQty,
        success: false,
        error: `SKU '${sku}' WooCommerce mağazasında bulunamadı.`,
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
   * Adds an order note to WooCommerce (e.g. carrier tracking information).
   */
  async addOrderNote(orderId: string | number, note: string, customerNote: boolean = true): Promise<void> {
    await this.send(await this.endpoint(`/orders/${orderId}/notes`), {
      method: 'POST',
      body: {
        note,
        customer_note: customerNote,
      },
    });
  }

  /**
   * Updates the status of an order on WooCommerce.
   */
  async updateOrderStatus(orderId: string | number, status: string): Promise<void> {
    await this.send(await this.endpoint(`/orders/${orderId}`), {
      method: 'PUT',
      body: { status },
    });
  }

  /**
   * Fetches product categories.
   */
  async getCategories(): Promise<any[]> {
    const rawCats = await this.send<WooCommerceRawCategory[]>(
      await this.endpoint('/products/categories'),
      { query: { per_page: 100 } },
    );

    if (!Array.isArray(rawCats)) return [];

    return rawCats.map((c) => ({
      id: String(c.id),
      name: c.name,
      parentId: c.parent ? String(c.parent) : null,
    }));
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return {
      categoryId,
      attributes: [],
    };
  }
}
