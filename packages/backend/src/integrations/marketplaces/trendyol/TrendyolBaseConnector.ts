import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { TrendyolMapper } from './TrendyolMapper';
import { TrendyolOrder, TrendyolOrderLine, TrendyolProduct } from './TrendyolTypes';

/**
 * Everything Türkiye and the international storefronts share: one gateway, one
 * set of paths, one auth scheme, one paging contract, one response shape.
 *
 * The two live as separate providers because an *integration* is per country —
 * category trees, ProductMapping rows, rate limits and connection status cannot
 * be shared. The *protocol* is not per country, so it lives here instead of
 * being copied: a gateway change that landed in one file and not the other is
 * exactly the bug this class exists to prevent.
 *
 * Subclasses supply only what genuinely differs: the storefront code, the name
 * shown to the seller, and the rate-limit bucket.
 *
 * DOĞRULANAMADI: hosts and paths are written from Trendyol's integration
 * documentation and have not been exercised against a real seller account.
 */

const BASE_URLS: Record<string, string> = {
  production: 'https://apigw.trendyol.com',
  sandbox: 'https://stageapigw.trendyol.com',
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
  addresses: (sellerId: string) => `/integration/sellers/${sellerId}/addresses`,
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

export abstract class TrendyolBaseConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  /**
   * Value sent as the `storeFrontCode` header. Trendyol documents this as a
   * header parameter; a value in the query string is ignored, which silently
   * routes every call to the account's default storefront.
   */
  protected abstract get storefrontCode(): string | undefined;

  /** Currency assumed when a payload omits it. Differs per storefront. */
  protected abstract get fallbackCurrency(): string;

  /** Storefront named in connection-test and error messages. */
  protected abstract get storefrontLabel(): string;

  private get baseUrl(): string {
    return BASE_URLS[this.environment] ?? BASE_URLS.production;
  }

  private get storefrontHeaders(): Record<string, string> {
    const code = this.storefrontCode;
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

  /**
   * The storefront header is attached here rather than at each call site, so a
   * read that forgets it cannot quietly run against the wrong storefront.
   */
  protected call<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    return this.send<T>(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.storefrontHeaders, ...(options.headers ?? {}) },
    });
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
      // the seller id and the storefront all line up.
      const result = await this.call<TrendyolPage<unknown>>(PATHS.products(sellerId), {
        query: { page: 0, size: 1 },
      });

      const total = Number(result?.totalElements);
      const where = this.storefrontLabel;
      return Number.isFinite(total)
        ? `${this.displayName} bağlantısı doğrulandı (${where}). Satıcı hesabında ${total} ürün görüldü.`
        : `${this.displayName} bağlantısı doğrulandı (${where}).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const startDate = Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000;

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.orders(sellerId), {
      startDate,
      endDate: Date.now(),
    });

    // The status filter is applied here rather than as a query parameter: the
    // settings list is our own vocabulary, and matching it locally keeps one
    // mapping table instead of two that can drift.
    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((order) => this.toTrendyolOrder(order))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(order.status.toLowerCase()))
      .map((order) => {
        const unified = TrendyolMapper.toUnifiedOrder(order, {
          source: this.orderSource,
          fallbackCurrency: this.fallbackCurrency,
        });

        // The mapper's table is the default; a seller who filled in
        // orders.statusMap means it, and Trendyol has statuses the table does
        // not cover (Picking, Invoiced, UnSupplied) which otherwise all land on
        // 'pending'.
        unified.status = this.mapOrderStatus(order.status, unified.status);
        unified.orderNumber = this.prefixOrderNumber(unified.orderNumber);

        return unified;
      });
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.products(sellerId), {});

    return raw.map((product) => TrendyolMapper.toUnifiedProduct(this.toTrendyolProduct(product)));
  }

  /**
   * Trendyol identifies inventory rows by barcode, never by the seller's own
   * stock code. Sending a SKU that is not also the barcode is not an error the
   * gateway reports — the batch is accepted and matches nothing, so the update
   * silently does not happen. The caller therefore hands the product's barcode
   * in alongside the SKU; the SKU is only a fallback for the case where the two
   * are genuinely the same string.
   */
  async updateStock(
    sku: string,
    quantity: number,
    identifiers?: { barcode?: string | null },
  ): Promise<StockUpdateResult> {
    try {
      const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');
      const barcode = String(identifiers?.barcode ?? '').trim() || sku;

      await this.call<unknown>(PATHS.priceAndInventory(sellerId), {
        method: 'POST',
        body: { items: [{ barcode, quantity }] },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || `${this.displayName} stok güncellemesi başarısız`,
      };
    }
  }

  /**
   * The category tree is read through the storefront header, so each storefront
   * gets its own tree without the caller passing a country around.
   */
  async getCategories(): Promise<any[]> {
    const result = await this.call<{ categories?: any[] }>(PATHS.categories());
    return result?.categories ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryAttributes(categoryId));
  }

  /**
   * The seller's registered shipment and return addresses. Feeds the two
   * required `resourceSelect` fields in the settings form, which is why the
   * rows carry a ready-made `label`: the form only knows `id` and `label`.
   *
   * DOĞRULANAMADI: the seller account on hand is in Draft status, so the
   * gateway answers `supplier.api.draft.address` (404) and no real payload
   * could be inspected. The path *is* confirmed — it is the only candidate that
   * answered with a domain error instead of a routing error. Field names come
   * from Trendyol's documentation and are read with fallbacks so a differently
   * spelled response degrades to an id-only label instead of an empty list.
   */
  async getAddresses(): Promise<Array<Record<string, any>>> {
    const { sellerId } = this.requireCredentials('sellerId', 'apiKey', 'apiSecret');

    const result = await this.call<{ supplierAddresses?: any[] }>(PATHS.addresses(sellerId));
    const rows = result?.supplierAddresses ?? [];

    return rows.map((row) => ({
      id: String(row?.id ?? ''),
      label: this.addressLabel(row),
      // Passed through so the form can tell a shipment address from a return
      // one without a second call.
      shipment: Boolean(row?.shipment),
      returningAddress: Boolean(row?.returningAddress),
      invoice: Boolean(row?.invoice),
      isDefault: Boolean(row?.default),
    }));
  }

  private addressLabel(row: Record<string, any>): string {
    const parts = [
      row?.addressText ?? row?.fullAddress ?? row?.address,
      row?.district,
      row?.city,
    ].filter((part) => typeof part === 'string' && part.trim().length > 0);

    // An address with no readable text is still selectable: better a bare id in
    // the dropdown than a blank row the seller cannot pick.
    return parts.length > 0 ? parts.join(', ') : `#${row?.id ?? '?'}`;
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
        // The storefront's own country is the sensible default for an address
        // that omits one; hardcoding TR would mislabel every foreign order.
        country: address.countryCode ?? address.country ?? this.defaultAddressCountry,
      },
      lines,
      status: raw.status ?? raw.shipmentPackageStatus ?? 'Created',
      totalPrice: Number(raw.totalPrice ?? raw.grossAmount ?? 0),
      // Currency comes from the payload wherever Trendyol sends it; the fallback
      // only covers a response that omits it entirely.
      currency: raw.currencyCode ?? raw.currency ?? this.fallbackCurrency,
    };
  }

  /** Country stamped on an address the payload left blank. */
  protected abstract get defaultAddressCountry(): string;

  /**
   * Written to `Order.source` so an imported order says which provider it came
   * from. Note this does not carry the country: `Order` has no column for it —
   * see docs/plans/trendyol-global-schema.md.
   */
  protected abstract get orderSource(): string;

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
