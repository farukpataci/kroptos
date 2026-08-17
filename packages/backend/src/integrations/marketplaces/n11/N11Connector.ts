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
import {
  N11OrderStatus,
  N11_ORDER_STATUSES,
  RawN11Page,
  RawN11Product,
  RawN11ShipmentPackage,
  RawN11TaskAck,
  RawN11TaskDetails,
} from './N11Types';

/**
 * Endpoints from n11's seller documentation ("n11 RestAPI Entegrasyon
 * Servisleri", alındı 2026-08-17). Three service families live under three
 * different roots — orders are not under `/ms/` at all, which is why probing
 * `/ms/order/*` found nothing but unrouted 503s before the document arrived.
 *
 * n11 publishes no sandbox, so both environments resolve to the same host.
 */
const BASE_URL = 'https://api.n11.com';

const PATHS = {
  categories: () => '/cdn/categories',
  categoryAttributes: (categoryId: string) => `/cdn/category/${categoryId}/attribute`,
  products: () => '/ms/product-query',
  orders: () => '/rest/delivery/v1/shipmentPackages',
  priceStockUpdate: () => '/ms/product/tasks/price-stock-update',
  taskDetails: () => '/ms/product/task-details/page-query',
};

/**
 * Published quotas, per service family. Only the order service states one
 * (1000/min); the product and category services state none, so they get a
 * deliberately conservative number rather than an optimistic guess. The
 * seller's `advanced.rateLimitPerMinute` still caps all of them.
 */
const RATE_LIMITS = {
  orders: { key: 'orders', perMinute: 1000 },
  products: { key: 'products', perMinute: 60 },
} as const;

/** Documented maxima. Asking for more is rejected or silently clamped. */
const PRODUCT_PAGE_SIZE = 250;
const ORDER_PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * n11 serves at most a 15-day window: given only a start date it returns the
 * following 15 days, and given a wide range it quietly returns the last 15 days
 * before the end date. Asking for 90 days would look like it worked and import
 * a fraction of the orders, so the request is clamped here where it is visible.
 */
const MAX_BACKFILL_DAYS = 15;

/** n11 wants the integrator named on every write, and the same name each time. */
const DEFAULT_INTEGRATOR = 'KroptOS';

const SIMULATED_ORDERS: RawN11ShipmentPackage[] = [
  {
    orderNumber: 'SIM-1001',
    id: '900001',
    shipmentPackageStatus: 'Created',
    customerfullName: 'Simülasyon Alıcı',
    customerEmail: 'simulasyon@example.com',
    shippingAddress: {
      address: 'Örnek Mah. 1. Sok. No:1',
      neighborhood: 'Örnek',
      district: 'Kadıköy',
      city: 'İstanbul',
      gsm: '5550000000',
    },
    lines: [
      { stockCode: 'SIM-SKU-1', productName: 'Simülasyon Ürün 1', quantity: 1, price: 149.9, totalSellerDiscountPrice: 0 },
      { stockCode: 'SIM-SKU-2', productName: 'Simülasyon Ürün 2', quantity: 2, price: 50, totalSellerDiscountPrice: 0 },
    ],
    totalAmount: 249.9,
  },
  {
    orderNumber: 'SIM-1002',
    id: '900002',
    shipmentPackageStatus: 'Shipped',
    customerfullName: 'Simülasyon Alıcı 2',
    shippingAddress: { address: 'Örnek Cad. No:2', district: 'Konak', city: 'İzmir' },
    lines: [
      { stockCode: 'SIM-SKU-1', productName: 'Simülasyon Ürün 1', quantity: 1, price: 99.9, totalSellerDiscountPrice: 0 },
    ],
    totalAmount: 99.9,
  },
];

const SIMULATED_PRODUCTS: RawN11Product[] = [
  {
    stockCode: 'SIM-SKU-1',
    title: 'Simülasyon Ürün 1',
    description: 'Simülasyon modunda üretilmiş örnek kayıt.',
    salePrice: 149.9,
    listPrice: 149.9,
    quantity: 12,
    currencyType: 'TL',
    imageUrls: ['https://example.invalid/sim-1.jpg'],
    barcode: '8690000000001',
    vatRate: 20,
  },
  {
    stockCode: 'SIM-SKU-2',
    title: 'Simülasyon Ürün 2',
    salePrice: 50,
    listPrice: 50,
    quantity: 0,
    currencyType: 'TL',
    barcode: '8690000000002',
    vatRate: 20,
  },
];

const SIMULATED_CATEGORIES = [
  { id: 1000, name: 'Simülasyon Kategori', subCategories: [{ id: 1001, name: 'Simülasyon Alt Kategori', subCategories: null }] },
];

export class N11Connector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  /**
   * Still simulation. The endpoints below are documented but no call has been
   * made against a real seller account, and one open question blocks pricing:
   * the document never says whether `salePrice` includes VAT.
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
    // Confirmed live and in the document: a header pair, no Authorization
    // header, and "Authorization: no auth" on n11's side.
    return { appKey: apiKey, appSecret: apiSecret };
  }

  private call<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      rateLimit?: { key?: string; perMinute?: number };
    } = {},
  ): Promise<T> {
    return this.send<T>(`${BASE_URL}${path}`, options);
  }

  private get integrator(): string {
    return String(this.setting<string>('advanced.integrator', '') || DEFAULT_INTEGRATOR).trim();
  }

  // --------------------------------------------------------------------------

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiKey', 'apiSecret');

      if (this.isSimulation) {
        return (
          'n11 SİMÜLASYON modunda çalışıyor: kimlik bilgileri biçimsel olarak tamam, ' +
          'ancak pazaryerine hiçbir istek gönderilmedi ve aşağıdaki veriler örnektir.'
        );
      }

      const categories = await this.readCategories();
      return `n11 bağlantısı doğrulandı. Kategori listesi okundu (${categories.length} kayıt).`;
    });
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('apiKey', 'apiSecret');

    const raw = this.isSimulation
      ? SIMULATED_PRODUCTS
      : await this.readPages<RawN11Product>(PATHS.products(), PRODUCT_PAGE_SIZE, RATE_LIMITS.products);

    const products: MarketplaceProduct[] = [];
    for (const product of raw) {
      // A product priced in a currency we have not verified is skipped loudly
      // rather than imported at a number that may be wrong by an exchange rate.
      try {
        products.push({ ...N11Mapper.toUnifiedProduct(product), ...this.modeStamp });
      } catch (error: any) {
        this.warn(error?.message ?? 'n11 ürünü işlenemedi');
      }
    }

    return products;
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('apiKey', 'apiSecret');

    const backfillDays = Math.min(
      Math.max(0, Number(this.setting<number>('orders.backfillDays', 7))),
      MAX_BACKFILL_DAYS,
    );
    const endDate = Date.now();
    const startDate = endDate - backfillDays * 24 * 60 * 60 * 1000;

    const statuses = this.wantedStatuses();
    const collected: MarketplaceOrder[] = [];

    // n11 takes exactly one status per request, so a seller importing three
    // statuses costs three sweeps. Ordered so the loop is deterministic.
    for (const status of statuses) {
      const packages = this.isSimulation
        ? SIMULATED_ORDERS.filter((pkg) => pkg.shipmentPackageStatus === status)
        : await this.readPages<RawN11ShipmentPackage>(PATHS.orders(), ORDER_PAGE_SIZE, RATE_LIMITS.orders, {
            // Timestamps in milliseconds, GMT+3 per the document. Date.now() is
            // an absolute instant, so no offset arithmetic belongs here.
            startDate,
            endDate,
            status,
            orderByDirection: 'ASC',
          });

      for (const pkg of packages) {
        const unified = N11Mapper.toUnifiedOrder(pkg);

        // The seller's own mapping wins over ours, then the prefix is applied —
        // two marketplaces hand out the same number and Order lookups key on it.
        unified.status = this.mapOrderStatus(String(pkg.shipmentPackageStatus ?? ''), unified.status);
        unified.orderNumber = this.prefixOrderNumber(unified.orderNumber);

        this.warnOnUnreconciledTotal(pkg, unified);
        collected.push({ ...unified, ...this.modeStamp });
      }
    }

    return collected;
  }

  /**
   * n11 accepts stock and price in one call and answers with a task id: the
   * update is queued, not applied. We poll the task once inside the request
   * budget; if it has not finished by then the result is reported as pending
   * rather than as a success the marketplace has not actually granted.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      this.requireCredentials('apiKey', 'apiSecret');

      if (this.isSimulation) {
        return { sku, quantity, success: true, ...this.modeStamp };
      }

      // Price fields are deliberately absent: the document says a field left out
      // is left untouched, and listPrice/salePrice may only be sent together —
      // and whether salePrice includes VAT is still unverified.
      const ack = await this.call<RawN11TaskAck>(PATHS.priceStockUpdate(), {
        method: 'POST',
        rateLimit: RATE_LIMITS.products,
        body: {
          payload: {
            integrator: this.integrator,
            skus: [{ stockCode: sku, quantity }],
          },
        },
      });

      if (String(ack?.status ?? '').toUpperCase() === 'REJECT') {
        return {
          sku,
          quantity,
          success: false,
          error: `n11 stok güncellemesini reddetti: ${(ack?.reasons ?? []).join(' ') || 'sebep bildirilmedi'}`,
          ...this.modeStamp,
        };
      }

      const taskId = ack?.id;
      if (taskId === undefined || taskId === null) {
        return {
          sku,
          quantity,
          success: false,
          error: 'n11 stok güncellemesi için task kimliği döndürmedi.',
          ...this.modeStamp,
        };
      }

      return this.resolveStockTask(sku, quantity, taskId);
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
        id: Number(categoryId),
        name: 'Simülasyon Kategori',
        categoryAttributes: [
          {
            attributeId: 1,
            attributeName: 'Simülasyon Nitelik',
            isMandatory: false,
            isVariant: false,
            isCustomValue: true,
            attributeValues: [{ id: 1, value: 'Örnek' }],
          },
        ],
        ...this.modeStamp,
      };
    }

    return this.call<any>(PATHS.categoryAttributes(categoryId), { rateLimit: RATE_LIMITS.products });
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  /** The whole n11 tree comes back in one request; no paging, no parameters. */
  private async readCategories(): Promise<any[]> {
    const result = await this.call<{ categories?: any[]; content?: any[] } | any[]>(PATHS.categories(), {
      rateLimit: RATE_LIMITS.products,
    });
    if (Array.isArray(result)) return result;
    return result?.categories ?? result?.content ?? [];
  }

  /**
   * Walks a Spring page. n11 documents the same stop rule for both paged
   * services: start at 0, honour `totalPages`, and treat an empty `content` as
   * the end — a seller's page count can shrink between requests.
   */
  private async readPages<T>(
    path: string,
    size: number,
    rateLimit: { key: string; perMinute: number },
    query: Record<string, string | number | undefined> = {},
  ): Promise<T[]> {
    const collected: T[] = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < MAX_PAGES) {
      const result = await this.call<RawN11Page<T>>(path, {
        rateLimit,
        query: { ...query, page, size },
      });

      const rows = result?.content ?? [];
      if (rows.length === 0) break;

      collected.push(...rows);
      totalPages = Number(result?.totalPages) || 1;
      page++;
    }

    return collected;
  }

  /**
   * The seller's `orders.importStatuses` in n11's own spelling. The settings
   * vocabulary is lower case and shared across marketplaces, so it is matched
   * case-insensitively against n11's list and anything unknown is dropped —
   * sending a status n11 does not define returns nothing at all.
   */
  private wantedStatuses(): N11OrderStatus[] {
    const configured = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wanted = new Set((configured ?? []).map((status) => String(status).trim().toLowerCase()));

    const resolved = N11_ORDER_STATUSES.filter((status) => wanted.has(status.toLowerCase()));
    // An empty selection would silently import nothing; fall back to the three
    // statuses an order passes through before it is out of the seller's hands.
    return resolved.length > 0 ? resolved : ['Created', 'Picking', 'Shipped'];
  }

  /**
   * `totalAmount` is what the seller collects and is what we store, but it does
   * not equal the line sum in n11's own example — the gap looks like shipping,
   * and no documented field accounts for it. Unexplained gaps are logged rather
   * than absorbed, so a mismatch shows up as a question instead of a wrong total.
   */
  private warnOnUnreconciledTotal(pkg: RawN11ShipmentPackage, unified: MarketplaceOrder): void {
    const lineTotal = N11Mapper.lineTotal(pkg.lines ?? []);
    const difference = Number((unified.totalAmount - lineTotal).toFixed(2));
    if (Math.abs(difference) < 0.01) return;

    this.warn(
      `n11 siparişi ${unified.orderNumber}: paket toplamı ${unified.totalAmount.toFixed(2)} ile ` +
        `satır toplamı ${lineTotal.toFixed(2)} arasında ${difference.toFixed(2)} fark var. ` +
        `Dokümanda bu farkı açıklayan bir alan yok (kargo bedeli olabilir); toplam olarak paket ` +
        `tutarı kaydedildi.`,
    );
  }

  /**
   * One poll, inside the same request budget. n11 answers `PROCESSED` once the
   * task is done and carries a per-SKU `SUCCESS`/`Fail`; anything else means we
   * stopped waiting before it finished.
   */
  private async resolveStockTask(sku: string, quantity: number, taskId: number): Promise<StockUpdateResult> {
    const pending: StockUpdateResult = {
      sku,
      quantity,
      success: false,
      pending: true,
      taskId: String(taskId),
      ...this.modeStamp,
    };

    let details: RawN11TaskDetails;
    try {
      details = await this.call<RawN11TaskDetails>(PATHS.taskDetails(), {
        method: 'POST',
        rateLimit: RATE_LIMITS.products,
        body: { taskId, pageable: { page: 0, size: 100 } },
      });
    } catch (error: any) {
      // The update itself was accepted; only the confirmation failed. Reporting
      // failure here would send the caller retrying a queued update.
      return { ...pending, error: `n11 task sonucu okunamadı: ${error?.message ?? 'bilinmeyen hata'}` };
    }

    if (String(details?.status ?? '').toUpperCase() !== 'PROCESSED') {
      return pending;
    }

    const row = (details?.skus?.content ?? []).find((item) => item.itemCode === sku);
    if (!row) return pending;

    if (String(row.status ?? '').toUpperCase() === 'SUCCESS') {
      return { sku, quantity, success: true, taskId: String(taskId), ...this.modeStamp };
    }

    return {
      sku,
      quantity,
      success: false,
      taskId: String(taskId),
      error: `n11 stok güncellemesi başarısız: ${(row.reasons ?? []).join(' ') || 'sebep bildirilmedi'}`,
      ...this.modeStamp,
    };
  }

  /** Collected by the caller; a connector has no logger of its own. */
  private warn(message: string): void {
    console.warn(`[n11] ${message}`);
  }
}
