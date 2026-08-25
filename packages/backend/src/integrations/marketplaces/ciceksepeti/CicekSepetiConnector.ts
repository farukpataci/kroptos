import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { CicekSepetiMapper } from './CicekSepetiMapper';
import { CicekSepetiOrder, CicekSepetiOrderItem, CicekSepetiProduct } from './CicekSepetiTypes';

/**
 * ÇiçekSepeti exposes one gateway with no public sandbox twin, so both
 * environments resolve to the same host.
 *
 * DOĞRULANAMADI: paths below are written from ÇiçekSepeti's API documentation
 * and have not been exercised against a real seller account.
 */
const BASE_URL = 'https://apis.ciceksepeti.com';

const PATHS = {
  orders: () => '/api/v1/Order/GetOrders',
  products: () => '/api/v1/Product/GetProducts',
  stockUpdate: () => '/api/v1/Product/UpdateProductStock',
  categories: () => '/api/v1/Categories',
  categoryAttributes: (categoryId: string) => `/api/v1/Categories/${categoryId}/attributes`,
};

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface CicekSepetiPage<T> {
  /** ÇiçekSepeti nests its collections under a per-endpoint key. */
  orderList?: T[];
  productList?: T[];
  items?: T[];
  categories?: T[];
  totalCount?: number;
  pageCount?: number;
}

export class CicekSepetiConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  protected get displayName(): string {
    return 'ÇiçekSepeti';
  }

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('CICEKSEPETI', credentials, httpClient, rateLimiter, settings);
  }

  protected authHeaders(): Record<string, string> {
    const { apiKey } = this.requireCredentials('apiKey');
    // A single API key header; ÇiçekSepeti issues no secret alongside it.
    return { 'x-api-key': apiKey };
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

  private rows<T>(page: CicekSepetiPage<T> | undefined, key: 'orderList' | 'productList'): T[] {
    return page?.[key] ?? page?.items ?? [];
  }

  private async fetchAllPages<T>(
    path: string,
    key: 'orderList' | 'productList',
    query: Record<string, string | number | undefined>,
  ): Promise<T[]> {
    const collected: T[] = [];
    let page = 0;
    let pageCount = 1;

    while (page < pageCount && page < MAX_PAGES) {
      const result = await this.call<CicekSepetiPage<T>>(path, {
        query: { ...query, page, pageSize: PAGE_SIZE },
      });

      const rows = this.rows(result, key);
      collected.push(...rows);
      pageCount = Number(result?.pageCount) || 1;
      page++;

      // A short page ends the walk even when pageCount is absent or wrong.
      if (rows.length < PAGE_SIZE) break;
    }

    return collected;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiKey');
      const result = await this.call<CicekSepetiPage<unknown>>(PATHS.products(), {
        query: { page: 0, pageSize: 1 },
      });

      const total = Number(result?.totalCount);
      return Number.isFinite(total)
        ? `ÇiçekSepeti bağlantısı doğrulandı. Satıcı hesabında ${total} ürün görüldü.`
        : 'ÇiçekSepeti bağlantısı doğrulandı.';
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('apiKey');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const startDate = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.orders(), 'orderList', {
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
    });

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((order) => this.observeUnmapped('orders', order, (row) => this.toCicekSepetiOrder(row)))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(order.status.toLowerCase()))
      .map((order) => CicekSepetiMapper.toUnifiedOrder(order));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('apiKey');

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.products(), 'productList', {});

    return raw.map((product) =>
      CicekSepetiMapper.toUnifiedProduct(
        this.observeUnmapped('products', product, (row) => this.toCicekSepetiProduct(row)),
      ),
    );
  }

  /** ÇiçekSepeti addresses inventory by the seller's stock code. */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      this.requireCredentials('apiKey');

      await this.call<unknown>(PATHS.stockUpdate(), {
        method: 'POST',
        body: { products: [{ stockCode: sku, stockQuantity: quantity }] },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'ÇiçekSepeti stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const result = await this.call<CicekSepetiPage<any>>(PATHS.categories());
    return result?.categories ?? result?.items ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryAttributes(categoryId));
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  /**
   * CicekSepetiMapper compares against capitalised status names, so incoming
   * values are folded to that spelling instead of widening the mapper.
   */
  private toStatusName(raw: unknown): string {
    switch (String(raw ?? '').toLowerCase()) {
      case 'shipped':
      case 'intransit':
        return 'Shipped';
      case 'delivered':
      case 'completed':
        return 'Delivered';
      case 'cancelled':
      case 'canceled':
        return 'Cancelled';
      default:
        return 'Created';
    }
  }

  private toCicekSepetiOrder(raw: Record<string, any>): CicekSepetiOrder {
    const items: CicekSepetiOrderItem[] = (raw.items ?? raw.orderItems ?? raw.products ?? []).map(
      (item: Record<string, any>) => ({
        variantCode: item.variantCode ?? item.stockCode ?? item.sku ?? '',
        name: item.name ?? item.productName ?? '',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price ?? item.salePrice ?? 0),
      }),
    );

    return {
      id: Number(raw.id ?? raw.orderId) || 0,
      orderCode: raw.orderCode ?? raw.orderNumber ?? String(raw.id ?? ''),
      receiverName: raw.receiverName ?? raw.customerName ?? '',
      receiverPhone: raw.receiverPhone ?? raw.phone,
      address: raw.address ?? raw.deliveryAddress ?? '',
      city: raw.city ?? '',
      district: raw.district ?? raw.town ?? '',
      // Optional passthrough: absent in the payload means undefined here, which
      // is the same as today's behaviour. Nothing is invented.
      neighborhood: raw.neighborhood ?? raw.quarter,
      postalCode: raw.postalCode ?? raw.zipCode ?? raw.postCode,
      status: this.toStatusName(raw.status ?? raw.orderStatus),
      totalPrice: Number(raw.totalPrice ?? raw.totalAmount ?? 0),
      currency: raw.currency ?? 'TRY',
      items,
    };
  }

  private toCicekSepetiProduct(raw: Record<string, any>): CicekSepetiProduct {
    const image = Array.isArray(raw.images)
      ? typeof raw.images[0] === 'string'
        ? raw.images[0]
        : raw.images[0]?.url
      : raw.mainImage ?? raw.image;

    return {
      stockCode: raw.stockCode ?? raw.productCode ?? raw.sku ?? '',
      name: raw.name ?? raw.productName ?? raw.title ?? '',
      description: raw.description,
      price: Number(raw.price ?? raw.salePrice ?? 0),
      stock: Number(raw.stock ?? raw.stockQuantity ?? raw.quantity) || 0,
      mainImage: image,
      barcode: raw.barcode,
    };
  }
}
