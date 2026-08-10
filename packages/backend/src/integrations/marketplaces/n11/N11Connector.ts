import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { N11Mapper } from './N11Mapper';
import { N11Order, N11OrderItem, N11Product } from './N11Types';

/**
 * n11 publishes no separate sandbox gateway, so both environments resolve to
 * the same host; the entry is kept so the shape matches the other connectors
 * and a future stage host is a one-line change.
 *
 * DOĞRULANAMADI: paths below are written from n11's REST documentation and have
 * not been exercised against a real seller account. This is the lowest-confidence
 * path set of the connectors written so far — verify before going live.
 */
const BASE_URL = 'https://api.n11.com';

const PATHS = {
  orders: () => '/ms/order/list',
  products: () => '/ms/product-query/products',
  stockUpdate: () => '/ms/product/stock-update',
  categories: () => '/ms/category',
  categoryAttributes: (categoryId: string) => `/ms/category/${categoryId}/attributes`,
};

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface N11Page<T> {
  content?: T[];
  orderList?: T[];
  products?: T[];
  totalPages?: number;
  totalElements?: number;
}

export class N11Connector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  protected get displayName(): string {
    return 'n11';
  }

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('N11', credentials, httpClient, rateLimiter, settings);
  }

  protected authHeaders(): Record<string, string> {
    const { apiKey, apiSecret } = this.requireCredentials('apiKey', 'apiSecret');
    // n11 authenticates with a header pair rather than an Authorization header.
    return { appKey: apiKey, appSecret: apiSecret };
  }

  private call<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    return this.send<T>(`${BASE_URL}${path}`, options);
  }

  /** Reads whichever collection key this endpoint family happens to use. */
  private rows<T>(page: N11Page<T> | undefined): T[] {
    return page?.content ?? page?.orderList ?? page?.products ?? [];
  }

  private async fetchAllPages<T>(
    path: string,
    options: { method?: string; query?: Record<string, string | number | undefined>; body?: Record<string, unknown> },
  ): Promise<T[]> {
    const collected: T[] = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < MAX_PAGES) {
      // Order search is a POST with a filter body; product search is a GET with
      // a query string. Paging travels in whichever of the two the caller uses.
      const result = await this.call<N11Page<T>>(path, {
        method: options.method,
        query: options.query ? { ...options.query, page, size: PAGE_SIZE } : undefined,
        body: options.body ? { ...options.body, pagingData: { currentPage: page, pageSize: PAGE_SIZE } } : undefined,
      });

      collected.push(...this.rows(result));
      totalPages = Number(result?.totalPages) || 1;
      page++;
    }

    return collected;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiKey', 'apiSecret');
      const result = await this.call<N11Page<unknown>>(PATHS.products(), {
        query: { page: 0, size: 1 },
      });

      const total = Number(result?.totalElements);
      return Number.isFinite(total)
        ? `n11 bağlantısı doğrulandı. Satıcı hesabında ${total} ürün görüldü.`
        : 'n11 bağlantısı doğrulandı.';
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('apiKey', 'apiSecret');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const startDate = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.orders(), {
      method: 'POST',
      body: {
        searchData: {
          period: {
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
          },
        },
      },
    });

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((order) => this.toN11Order(order))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(this.statusName(order.status)))
      .map((order) => N11Mapper.toUnifiedOrder(order));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('apiKey', 'apiSecret');

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.products(), { query: {} });

    return raw.map((product) => N11Mapper.toUnifiedProduct(this.toN11Product(product)));
  }

  /** n11 addresses inventory by the seller's own stock code. */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      this.requireCredentials('apiKey', 'apiSecret');

      await this.call<unknown>(PATHS.stockUpdate(), {
        method: 'POST',
        body: { items: [{ stockCode: sku, quantity }] },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'n11 stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const result = await this.call<{ categories?: any[]; content?: any[] }>(PATHS.categories());
    return result?.categories ?? result?.content ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryAttributes(categoryId));
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  /**
   * N11Mapper keys off numeric status codes, so a textual status from the API
   * is folded back onto the same numbers rather than teaching the mapper a
   * second vocabulary.
   */
  private toStatusCode(raw: unknown): number {
    if (typeof raw === 'number') return raw;

    switch (String(raw ?? '').toLowerCase()) {
      case 'new':
      case 'created':
      case 'pending':
      case 'accepted':
        return 1;
      case 'shipped':
      case 'intransit':
        return 2;
      case 'delivered':
      case 'completed':
        return 3;
      case 'cancelled':
      case 'canceled':
      case 'rejected':
        return 4;
      default:
        return 1;
    }
  }

  /** Inverse of toStatusCode, used to match against the settings vocabulary. */
  private statusName(code: number): string {
    switch (code) {
      case 2:
        return 'shipped';
      case 3:
        return 'delivered';
      case 4:
        return 'cancelled';
      default:
        return 'created';
    }
  }

  private toN11Order(raw: Record<string, any>): N11Order {
    // n11 wraps its line items twice; some endpoints flatten it to a plain array.
    const rawItems: Record<string, any>[] =
      raw.orderItemList?.orderItem ?? raw.orderItemList ?? raw.itemList ?? raw.items ?? [];

    const orderItem: N11OrderItem[] = (Array.isArray(rawItems) ? rawItems : [rawItems]).map(
      (item: Record<string, any>) => ({
        productSellerCode: item.productSellerCode ?? item.stockCode ?? item.sellerCode ?? '',
        productName: item.productName ?? item.title ?? '',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price ?? item.sellerInvoiceAmount ?? 0),
      }),
    );

    const buyer = raw.buyer ?? raw.customer ?? {};
    const address = raw.shippingAddress ?? raw.deliveryAddress ?? {};

    return {
      id: String(raw.id ?? raw.orderId ?? ''),
      orderNumber: raw.orderNumber ?? String(raw.id ?? ''),
      buyer: {
        fullName: buyer.fullName ?? [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') ?? '',
        email: buyer.email,
        gsm: buyer.gsm ?? buyer.phone,
      },
      shippingAddress: {
        address: address.address ?? address.fullAddress ?? '',
        city: address.city ?? '',
        district: address.district ?? address.town ?? '',
      },
      orderItemList: { orderItem },
      status: this.toStatusCode(raw.status ?? raw.orderStatus),
      totalPrice: Number(raw.totalPrice ?? raw.totalAmount ?? 0),
      currency: raw.currency ?? 'TRY',
    };
  }

  private toN11Product(raw: Record<string, any>): N11Product {
    const image = Array.isArray(raw.images)
      ? typeof raw.images[0] === 'string'
        ? raw.images[0]
        : raw.images[0]?.url
      : raw.image;

    return {
      stockCode: raw.stockCode ?? raw.productSellerCode ?? raw.sellerCode ?? '',
      title: raw.title ?? raw.productName ?? '',
      description: raw.description,
      salePrice: Number(raw.salePrice ?? raw.displayPrice ?? raw.price ?? 0),
      stockQuantity: Number(raw.stockQuantity ?? raw.quantity ?? 0),
      image,
      gtin: raw.gtin ?? raw.barcode,
    };
  }
}
