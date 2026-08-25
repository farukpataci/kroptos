import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { IdefixMapper } from './IdefixMapper';
import { IdefixOrder, IdefixOrderItem, IdefixProduct } from './IdefixTypes';

/**
 * idefix serves one seller gateway with no public sandbox, so both
 * environments resolve to the same host. Calls are scoped by the vendor id
 * rather than by a header.
 *
 * DOĞRULANAMADI: host and paths are written from idefix's seller integration
 * documentation and have not been exercised against a real vendor account.
 * Together with PttAVM this is the weakest path set in this codebase — verify
 * against the merchant panel before going live.
 */
const BASE_URL = 'https://sellerapi.idefix.com';

const PATHS = {
  orders: (vendorId: string) => `/orders/vendors/${vendorId}`,
  products: (vendorId: string) => `/products/vendors/${vendorId}`,
  stockUpdate: (vendorId: string) => `/products/vendors/${vendorId}/stock`,
  categories: () => '/categories',
  categoryAttributes: (categoryId: string) => `/categories/${categoryId}/attributes`,
};

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface IdefixPage<T> {
  content?: T[];
  items?: T[];
  totalElements?: number;
  totalPages?: number;
}

export class IdefixConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  protected get displayName(): string {
    return 'idefix';
  }

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('IDEFIX', credentials, httpClient, rateLimiter, settings);
  }

  protected authHeaders(): Record<string, string> {
    const { apiKey, apiSecret, vendorId } = this.requireCredentials(
      'apiKey',
      'apiSecret',
      'vendorId',
    );
    return {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      'User-Agent': `${vendorId} - SelfIntegration`,
    };
  }

  private get vendorId(): string {
    const { vendorId } = this.requireCredentials('vendorId');
    return vendorId;
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

  private rows<T>(page: IdefixPage<T> | undefined): T[] {
    return page?.content ?? page?.items ?? [];
  }

  private async fetchAllPages<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined>,
  ): Promise<T[]> {
    const collected: T[] = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < MAX_PAGES) {
      const result = await this.call<IdefixPage<T>>(path, {
        query: { ...query, page, size: PAGE_SIZE },
      });

      collected.push(...this.rows(result));
      totalPages = Number(result?.totalPages) || 1;
      page++;
    }

    return collected;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiKey', 'apiSecret', 'vendorId');
      const result = await this.call<IdefixPage<unknown>>(PATHS.products(this.vendorId), {
        query: { page: 0, size: 1 },
      });

      const total = Number(result?.totalElements);
      return Number.isFinite(total)
        ? `idefix bağlantısı doğrulandı. Satıcı hesabında ${total} ürün görüldü.`
        : 'idefix bağlantısı doğrulandı.';
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('apiKey', 'apiSecret', 'vendorId');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const startDate = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.orders(this.vendorId), {
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
    });

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((order) => this.observeUnmapped('orders', order, (row) => this.toIdefixOrder(row)))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(this.settingsStatus(order.status)))
      .map((order) => IdefixMapper.toUnifiedOrder(order));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('apiKey', 'apiSecret', 'vendorId');

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.products(this.vendorId), {});

    return raw.map((product) =>
      IdefixMapper.toUnifiedProduct(
        this.observeUnmapped('products', product, (row) => this.toIdefixProduct(row)),
      ),
    );
  }

  /** idefix addresses inventory by the merchant's own SKU. */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      this.requireCredentials('apiKey', 'apiSecret', 'vendorId');

      await this.call<unknown>(PATHS.stockUpdate(this.vendorId), {
        method: 'POST',
        body: { items: [{ merchantSku: sku, quantity }] },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'idefix stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const result = await this.call<IdefixPage<any>>(PATHS.categories());
    return this.rows(result);
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryAttributes(categoryId));
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  private toStatusName(raw: unknown): string {
    switch (String(raw ?? '').toLowerCase()) {
      case 'picking':
      case 'preparing':
      case 'approved':
        return 'Picking';
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

  private settingsStatus(status: string): string {
    switch (status) {
      case 'Picking':
        return 'picking';
      case 'Shipped':
        return 'shipped';
      case 'Delivered':
        return 'delivered';
      case 'Cancelled':
        return 'cancelled';
      default:
        return 'created';
    }
  }

  private toIdefixOrder(raw: Record<string, any>): IdefixOrder {
    const items: IdefixOrderItem[] = (raw.items ?? raw.lines ?? raw.orderItems ?? []).map(
      (item: Record<string, any>) => ({
        merchantSku: item.merchantSku ?? item.sku ?? item.stockCode ?? '',
        productName: item.productName ?? item.name ?? item.title ?? '',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price ?? item.unitPrice ?? 0),
      }),
    );

    const address = raw.shippingAddress ?? raw.deliveryAddress ?? raw.address ?? {};
    const addressLine =
      typeof address === 'string' ? address : address.address ?? address.fullAddress ?? '';

    return {
      id: String(raw.id ?? raw.orderId ?? ''),
      orderNumber: raw.orderNumber ?? raw.orderCode ?? String(raw.id ?? ''),
      customerName:
        raw.customerName ??
        [raw.customerFirstName, raw.customerLastName].filter(Boolean).join(' ') ??
        '',
      customerEmail: raw.customerEmail ?? raw.email,
      customerPhone: raw.customerPhone ?? raw.phone,
      address: addressLine,
      city: typeof address === 'string' ? (raw.city ?? '') : address.city ?? raw.city ?? '',
      // Optional passthrough: absent means undefined, which is today's
      // behaviour. Nothing is invented, nothing is parsed out of the line.
      neighborhood:
        typeof address === 'string'
          ? raw.neighborhood
          : address.neighborhood ?? address.quarter ?? raw.neighborhood,
      postalCode:
        typeof address === 'string'
          ? (raw.postalCode ?? raw.zipCode)
          : address.postalCode ?? address.zipCode ?? raw.postalCode,
      district:
        typeof address === 'string'
          ? (raw.district ?? '')
          : address.district ?? address.town ?? raw.district ?? '',
      status: this.toStatusName(raw.status ?? raw.orderStatus),
      totalPrice: Number(raw.totalPrice ?? raw.totalAmount ?? 0),
      currency: raw.currency ?? 'TRY',
      items,
    };
  }

  private toIdefixProduct(raw: Record<string, any>): IdefixProduct {
    const image = Array.isArray(raw.images)
      ? typeof raw.images[0] === 'string'
        ? raw.images[0]
        : raw.images[0]?.url
      : raw.image ?? raw.imageUrl;

    return {
      merchantSku: raw.merchantSku ?? raw.sku ?? raw.stockCode ?? '',
      title: raw.title ?? raw.name ?? raw.productName ?? '',
      description: raw.description,
      salePrice: Number(raw.salePrice ?? raw.price ?? 0),
      quantity: Number(raw.quantity ?? raw.stock ?? raw.stockQuantity) || 0,
      image,
      barcode: raw.barcode,
    };
  }
}
