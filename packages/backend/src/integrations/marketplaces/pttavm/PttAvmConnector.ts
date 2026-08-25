import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { PttAvmMapper } from './PttAvmMapper';
import { PttAvmOrder, PttAvmOrderItem, PttAvmProduct } from './PttAvmTypes';

/**
 * PttAVM serves one gateway with no public sandbox, so both environments
 * resolve to the same host.
 *
 * DOĞRULANAMADI: host and paths are written from PttAVM's seller integration
 * documentation and have not been exercised against a real seller account.
 * Together with idefix this is the weakest path set in this codebase — verify
 * against the merchant panel before going live.
 */
const BASE_URL = 'https://api.pttavm.com';

const PATHS = {
  orders: () => '/orders',
  products: () => '/products',
  stockUpdate: () => '/products/stock',
  categories: () => '/categories',
  categoryAttributes: (categoryId: string) => `/categories/${categoryId}/attributes`,
};

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface PttAvmPage<T> {
  items?: T[];
  content?: T[];
  data?: T[];
  totalCount?: number;
  totalPages?: number;
}

export class PttAvmConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  protected get displayName(): string {
    return 'PttAVM';
  }

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('PTTAVM', credentials, httpClient, rateLimiter, settings);
  }

  protected authHeaders(): Record<string, string> {
    const { apiKey, apiSecret } = this.requireCredentials('apiKey', 'apiSecret');
    return {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
    };
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

  private rows<T>(page: PttAvmPage<T> | undefined): T[] {
    return page?.items ?? page?.content ?? page?.data ?? [];
  }

  private async fetchAllPages<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined>,
  ): Promise<T[]> {
    const collected: T[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<PttAvmPage<T>>(path, {
        query: { ...query, page, size: PAGE_SIZE },
      });

      const rows = this.rows(result);
      collected.push(...rows);

      if (rows.length < PAGE_SIZE) break;

      const totalPages = Number(result?.totalPages);
      if (Number.isFinite(totalPages) && page + 1 >= totalPages) break;
    }

    return collected;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiKey', 'apiSecret');
      const result = await this.call<PttAvmPage<unknown>>(PATHS.products(), {
        query: { page: 0, size: 1 },
      });

      const total = Number(result?.totalCount);
      return Number.isFinite(total)
        ? `PttAVM bağlantısı doğrulandı. Satıcı hesabında ${total} ürün görüldü.`
        : 'PttAVM bağlantısı doğrulandı.';
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('apiKey', 'apiSecret');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const startDate = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.orders(), {
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
    });

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((order) => this.observeUnmapped('orders', order, (row) => this.toPttAvmOrder(row)))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(this.settingsStatus(order.status)))
      .map((order) => PttAvmMapper.toUnifiedOrder(order));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('apiKey', 'apiSecret');

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.products(), {});

    return raw.map((product) =>
      PttAvmMapper.toUnifiedProduct(
        this.observeUnmapped('products', product, (row) => this.toPttAvmProduct(row)),
      ),
    );
  }

  /** PttAVM addresses inventory by the seller's stock code. */
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
        error: error?.message || 'PttAVM stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const result = await this.call<PttAvmPage<any>>(PATHS.categories());
    return this.rows(result);
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryAttributes(categoryId));
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  /** PttAvmMapper compares capitalised names, so incoming values fold to those. */
  private toStatusName(raw: unknown): string {
    switch (String(raw ?? '').toLowerCase()) {
      case 'approved':
      case 'preparing':
      case 'picking':
        return 'Approved';
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
        return 'New';
    }
  }

  private settingsStatus(status: string): string {
    switch (status) {
      case 'Approved':
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

  private toPttAvmOrder(raw: Record<string, any>): PttAvmOrder {
    const items: PttAvmOrderItem[] = (raw.items ?? raw.orderItems ?? raw.lines ?? []).map(
      (item: Record<string, any>) => ({
        stockCode: item.stockCode ?? item.sku ?? item.productCode ?? '',
        productName: item.productName ?? item.name ?? '',
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

  private toPttAvmProduct(raw: Record<string, any>): PttAvmProduct {
    const image = Array.isArray(raw.images)
      ? typeof raw.images[0] === 'string'
        ? raw.images[0]
        : raw.images[0]?.url
      : raw.image ?? raw.imageUrl;

    return {
      stockCode: raw.stockCode ?? raw.sku ?? raw.productCode ?? '',
      name: raw.name ?? raw.productName ?? raw.title ?? '',
      description: raw.description,
      price: Number(raw.price ?? raw.salePrice ?? 0),
      quantity: Number(raw.quantity ?? raw.stock ?? raw.stockQuantity) || 0,
      image,
      barcode: raw.barcode,
    };
  }
}
