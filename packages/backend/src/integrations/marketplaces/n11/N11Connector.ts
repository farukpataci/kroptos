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
 * the same host.
 *
 * Only two paths are in this file, and both were confirmed against the live
 * gateway on 2026-08-17: an unauthenticated GET answers 403 "Authentication
 * parameters missing", which is the gateway rejecting credentials on a route it
 * knows. Every other path this connector used to carry answered either an
 * OpenShift "Application is not available" page (no route at all) or a JSON
 * `NotFoundException` from the service behind it, so they are gone rather than
 * left in place looking plausible:
 *
 *   /ms/order/list            → unrouted
 *   /ms/product-query/products→ 404 "No handler found for GET /product-query/products"
 *   /ms/product/stock-update  → unrouted
 *   /ms/category              → unrouted
 *   /ms/category/{id}/attributes → unrouted
 *
 * The header pair below is confirmed too: with dummy values the gateway answers
 * `SellerApiUserUnauthorizedException`, and with no headers at all the service
 * complains that the required header 'appkey' is absent.
 *
 * Until the seller-facing documentation arrives, orders, products and stock
 * have no verified endpoint, so this connector defaults to simulation and
 * refuses those three operations outright in live mode.
 */
const BASE_URL = 'https://api.n11.com';

const PATHS = {
  categories: () => '/cdn/categories',
  categoryAttributes: (categoryId: string) => `/cdn/category/${categoryId}/attribute`,
};

/**
 * Sample data for simulation mode. Deliberately routed through the same
 * `toN11Order`/`toN11Product` normalisers as a real response would be, so the
 * normalisation and mapping code is exercised rather than bypassed.
 *
 * Order numbers start with `SIM-`; with the `orders.numberPrefix` default they
 * land as `N11-SIM-…`, which means a simulated order that somehow reaches a
 * database is recognisable on sight.
 */
const SIMULATED_ORDERS: Record<string, any>[] = [
  {
    id: 900001,
    orderNumber: 'SIM-1001',
    status: 1,
    totalPrice: 249.9,
    currency: 'TRY',
    buyer: { fullName: 'Simülasyon Alıcı', email: 'simulasyon@example.com', gsm: '5550000000' },
    shippingAddress: { address: 'Örnek Mah. 1. Sok. No:1', city: 'İstanbul', district: 'Kadıköy' },
    orderItemList: {
      orderItem: [
        { productSellerCode: 'SIM-SKU-1', productName: 'Simülasyon Ürün 1', quantity: 1, price: 149.9 },
        { productSellerCode: 'SIM-SKU-2', productName: 'Simülasyon Ürün 2', quantity: 2, price: 50 },
      ],
    },
  },
  {
    id: 900002,
    orderNumber: 'SIM-1002',
    status: 2,
    totalPrice: 99.9,
    currency: 'TRY',
    buyer: { fullName: 'Simülasyon Alıcı 2' },
    shippingAddress: { address: 'Örnek Cad. No:2', city: 'İzmir', district: 'Konak' },
    orderItemList: {
      orderItem: [
        { productSellerCode: 'SIM-SKU-1', productName: 'Simülasyon Ürün 1', quantity: 1, price: 99.9 },
      ],
    },
  },
];

const SIMULATED_PRODUCTS: Record<string, any>[] = [
  {
    stockCode: 'SIM-SKU-1',
    title: 'Simülasyon Ürün 1',
    description: 'Simülasyon modunda üretilmiş örnek kayıt.',
    salePrice: 149.9,
    stockQuantity: 12,
    images: ['https://example.invalid/sim-1.jpg'],
    gtin: '8690000000001',
  },
  {
    stockCode: 'SIM-SKU-2',
    title: 'Simülasyon Ürün 2',
    salePrice: 50,
    stockQuantity: 0,
    gtin: '8690000000002',
  },
];

const SIMULATED_CATEGORIES = [
  { id: 1000, name: 'Simülasyon Kategori', parentId: 0 },
  { id: 1001, name: 'Simülasyon Alt Kategori', parentId: 1000 },
];

export class N11Connector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  /**
   * Unverified endpoints for orders, products and stock; nothing may be believed
   * until the documentation lands. The seller can still force `live` from the
   * settings to exercise the two confirmed category endpoints.
   */
  protected readonly defaultMode = 'simulation' as const;

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
    // Confirmed live: dummy values earn SellerApiUserUnauthorizedException.
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

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      // Credentials are checked in both modes: a simulated success that hides an
      // empty API key would send the seller into configuration believing the
      // account is wired up.
      this.requireCredentials('apiKey', 'apiSecret');

      if (this.isSimulation) {
        return (
          'n11 SİMÜLASYON modunda çalışıyor: kimlik bilgileri biçimsel olarak tamam, ' +
          'ancak pazaryerine hiçbir istek gönderilmedi ve aşağıdaki veriler örnektir. ' +
          'Sipariş/ürün/stok uçları n11 dokümanı ile doğrulanmadı.'
        );
      }

      const categories = await this.readCategories();
      return `n11 bağlantısı doğrulandı. Kategori listesi okundu (${categories.length} kayıt).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('apiKey', 'apiSecret');
    if (!this.isSimulation) this.notImplemented('getOrders');

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set((wanted ?? []).map((status) => String(status).toLowerCase()));

    return SIMULATED_ORDERS.map((raw) => this.toN11Order(raw))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(this.statusName(order.status)))
      .map((order) => {
        const unified = N11Mapper.toUnifiedOrder(order);

        // Two marketplaces can hand out the same order number and Order lookups
        // key on it, so the seller's prefix has to be applied here — it was
        // configurable and read by nobody, which is how an n11 order could be
        // mistaken for an existing order from another marketplace.
        unified.orderNumber = this.prefixOrderNumber(unified.orderNumber);
        unified.status = this.mapOrderStatus(this.statusName(order.status), unified.status);
        return { ...unified, ...this.modeStamp };
      });
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('apiKey', 'apiSecret');
    if (!this.isSimulation) this.notImplemented('getProducts');

    return SIMULATED_PRODUCTS.map((raw) => ({
      ...N11Mapper.toUnifiedProduct(this.toN11Product(raw)),
      ...this.modeStamp,
    }));
  }

  /**
   * n11 addresses inventory by the seller's own stock code, but the endpoint
   * that accepts it is not confirmed. Reports failure instead of throwing, so a
   * stock sync logs one clear reason per SKU rather than aborting the run.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      this.requireCredentials('apiKey', 'apiSecret');

      if (this.isSimulation) {
        return { sku, quantity, success: true, ...this.modeStamp };
      }

      this.notImplemented('updateStock');
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'n11 stok güncellemesi başarısız',
        ...this.modeStamp,
      };
    }
  }

  async getCategories(): Promise<any[]> {
    if (this.isSimulation) return SIMULATED_CATEGORIES;
    return this.readCategories();
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    if (this.isSimulation) {
      return {
        categoryId,
        attributes: [
          { id: 1, name: 'Simülasyon Nitelik', mandatory: false, values: [{ id: 1, name: 'Örnek' }] },
        ],
        ...this.modeStamp,
      };
    }

    return this.call<any>(PATHS.categoryAttributes(categoryId));
  }

  /** The one confirmed read: shape is unknown, so three wrappings are accepted. */
  private async readCategories(): Promise<any[]> {
    const result = await this.call<{ categories?: any[]; content?: any[] } | any[]>(PATHS.categories());
    if (Array.isArray(result)) return result;
    return result?.categories ?? result?.content ?? [];
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  //
  // Kept even though only sample data flows through it today: this is where a
  // real n11 response will land, and the sample data is shaped like one so the
  // mapping is not written blind when the documentation arrives.
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

  /**
   * Inverse of toStatusCode. Used both to match the seller's `importStatuses`
   * selection and as the key handed to `orders.statusMap`, so the two always
   * speak the same vocabulary.
   */
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
        fullName: buyer.fullName || [buyer.firstName, buyer.lastName].filter(Boolean).join(' '),
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
