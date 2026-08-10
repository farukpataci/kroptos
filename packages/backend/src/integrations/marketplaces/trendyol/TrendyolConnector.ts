import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolMapper } from './TrendyolMapper';
import { TrendyolOrder, TrendyolOrderLine, TrendyolProduct } from './TrendyolTypes';

/**
 * Host per environment, chosen by the `general.environment` setting. Trendyol
 * serves the stage tenant from a separate gateway; the paths are identical.
 *
 * DOĞRULANAMADI: paths and hosts below are written from Trendyol's integration
 * documentation but have not been exercised against a real seller account.
 */
const BASE_URLS: Record<string, string> = {
  production: 'https://apigw.trendyol.com',
  sandbox: 'https://stageapigw.trendyol.com',
};

/**
 * One Trendyol seller account can serve Türkiye and the international
 * storefronts. The gateway is shared; what changes is the storefront the call
 * is scoped to, so a marketplace is a query scope rather than a second
 * integration.
 *
 * DOĞRULANAMADI: storefront codes are written from Trendyol's international
 * seller documentation and have not been exercised against a real account.
 */
const MARKETPLACES: Record<string, { storefrontCode?: string; label: string }> = {
  tr: { label: 'Türkiye' },
  int: { storefrontCode: 'INT', label: 'Trendyol Global' },
  az: { storefrontCode: 'AZ', label: 'Azerbaycan' },
  de: { storefrontCode: 'DE', label: 'Almanya' },
  gb: { storefrontCode: 'GB', label: 'Birleşik Krallık' },
};

/** Every Trendyol path in one place, so a gateway version bump lands here only. */
const PATHS = {
  orders: (sellerId: string) => `/integration/order/sellers/${sellerId}/orders`,
  products: (sellerId: string) => `/integration/product/sellers/${sellerId}/products`,
  priceAndInventory: (sellerId: string) =>
    `/integration/inventory/sellers/${sellerId}/products/price-and-inventory`,
  categories: () => '/integration/product/product-categories',
  categoryAttributes: (categoryId: string) =>
    `/integration/product/product-categories/${categoryId}/attributes`,
};

/** Trendyol pages are capped at 200 rows; asking for more is silently trimmed. */
const PAGE_SIZE = 200;

/** Stops a malformed totalPages from turning one sync into an endless loop. */
const MAX_PAGES = 50;

interface TrendyolPage<T> {
  content?: T[];
  totalPages?: number;
  totalElements?: number;
}

export class TrendyolConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  protected get displayName(): string {
    return 'Trendyol';
  }

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('TRENDYOL', credentials, httpClient, rateLimiter, settings);
  }

  private get baseUrl(): string {
    return BASE_URLS[this.environment] ?? BASE_URLS.production;
  }

  private get marketplace(): { storefrontCode?: string; label: string } {
    const selected = String(this.setting<string>('trendyol.marketplace', 'tr')).toLowerCase();
    return MARKETPLACES[selected] ?? MARKETPLACES.tr;
  }

  /**
   * Storefront scope for order and product reads. Türkiye is the account's home
   * storefront and takes no parameter, so the key is omitted rather than sent
   * empty — an empty value would filter everything out.
   */
  private get storefrontQuery(): Record<string, string | undefined> {
    const code = this.marketplace.storefrontCode;
    return code ? { storeFrontCode: code } : {};
  }

  protected authHeaders(): Record<string, string> {
    const { sellerId, apiKey, apiSecret } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');
    return {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      // Trendyol rejects integration traffic that does not identify the seller
      // in the agent string.
      'User-Agent': `${sellerId} - SelfIntegration`,
    };
  }

  private call<T>(
    path: string,
    options: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    return this.send<T>(`${this.baseUrl}${path}`, options);
  }

  /** Walks a paged Trendyol collection to the end, honouring the page cap. */
  private async fetchAllPages<T>(
    path: string,
    query: Record<string, string | number | undefined>,
  ): Promise<T[]> {
    const collected: T[] = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < MAX_PAGES) {
      const result = await this.call<TrendyolPage<T>>(path, {
        query: { ...query, page, size: PAGE_SIZE },
      });

      collected.push(...(result?.content ?? []));
      totalPages = Number(result?.totalPages) || 1;
      page++;
    }

    return collected;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');
      // Cheapest authenticated read: one product row proves the credentials,
      // the seller id and the environment all line up.
      const result = await this.call<TrendyolPage<unknown>>(PATHS.products(sellerId), {
        query: { page: 0, size: 1, ...this.storefrontQuery },
      });

      const total = Number(result?.totalElements);
      const where = this.marketplace.label;
      return Number.isFinite(total)
        ? `Trendyol bağlantısı doğrulandı (${where}). Satıcı hesabında ${total} ürün görüldü.`
        : `Trendyol bağlantısı doğrulandı (${where}).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const startDate = Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000;

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.orders(sellerId), {
      startDate,
      endDate: Date.now(),
      ...this.storefrontQuery,
    });

    // The status filter is applied here rather than as a query parameter: the
    // settings list is our own vocabulary, and matching it locally keeps one
    // mapping table instead of two that can drift.
    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((order) => this.toTrendyolOrder(order))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(order.status.toLowerCase()))
      .map((order) => TrendyolMapper.toUnifiedOrder(order));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');

    const raw = await this.fetchAllPages<Record<string, any>>(
      PATHS.products(sellerId),
      this.storefrontQuery,
    );

    return raw.map((product) => TrendyolMapper.toUnifiedProduct(this.toTrendyolProduct(product)));
  }

  /**
   * Trendyol identifies inventory rows by barcode, so the value handed in must
   * be the barcode Trendyol knows. Where the local SKU differs, the caller is
   * responsible for translating it through ProductMapping first.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');

      await this.call<unknown>(PATHS.priceAndInventory(sellerId), {
        method: 'POST',
        body: { items: [{ barcode: sku, quantity }] },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'Trendyol stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const result = await this.call<{ categories?: any[] }>(PATHS.categories());
    return result?.categories ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryAttributes(categoryId));
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  /**
   * Narrows a raw order payload down to the shape TrendyolMapper already knows.
   * Field names differ between Trendyol's order versions, so each value has a
   * fallback rather than assuming one spelling.
   */
  private toTrendyolOrder(raw: Record<string, any>): TrendyolOrder {
    const lines: TrendyolOrderLine[] = (raw.lines ?? []).map((line: Record<string, any>) => ({
      barcode: line.barcode ?? '',
      sku: line.merchantSku ?? line.sku ?? line.stockCode ?? line.barcode ?? '',
      quantity: Number(line.quantity) || 0,
      price: Number(line.price ?? line.amount ?? 0),
      merchantId: Number(line.merchantId) || 0,
      productName: line.productName ?? line.productTitle ?? '',
    }));

    const address = raw.shipmentAddress ?? raw.invoiceAddress ?? {};

    return {
      id: Number(raw.id) || 0,
      orderNumber: raw.orderNumber ?? raw.id?.toString() ?? '',
      customerFirstName: raw.customerFirstName ?? '',
      customerLastName: raw.customerLastName ?? '',
      customerEmail: raw.customerEmail,
      customerPhone: raw.customerPhone ?? address.phone,
      shipmentAddress: {
        address1: address.address1 ?? address.fullAddress ?? '',
        city: address.city ?? '',
        country: address.countryCode ?? address.country ?? 'TR',
      },
      lines,
      status: raw.status ?? raw.shipmentPackageStatus ?? 'Created',
      totalPrice: Number(raw.totalPrice ?? raw.grossAmount ?? 0),
      currency: raw.currencyCode ?? raw.currency ?? 'TRY',
    };
  }

  private toTrendyolProduct(raw: Record<string, any>): TrendyolProduct {
    const images = Array.isArray(raw.images)
      ? raw.images
          .map((image: any) => ({ url: typeof image === 'string' ? image : image?.url }))
          .filter((image: { url?: string }): image is { url: string } => Boolean(image.url))
      : [];

    return {
      title: raw.title ?? '',
      stockCode: raw.stockCode ?? raw.productMainId ?? raw.barcode ?? '',
      description: raw.description,
      salePrice: Number(raw.salePrice ?? raw.listPrice ?? 0),
      quantity: Number(raw.quantity) || 0,
      images,
      barcode: raw.barcode,
    };
  }
}
