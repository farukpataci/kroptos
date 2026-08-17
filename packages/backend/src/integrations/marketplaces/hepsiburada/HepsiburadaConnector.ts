import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { HepsiburadaMapper } from './HepsiburadaMapper';
import { HepsiburadaItem, HepsiburadaOrder, HepsiburadaProduct } from './HepsiburadaTypes';

/**
 * Hepsiburada splits its integration API across three hosts: order management,
 * listing/inventory, and the product catalogue (MPOP). Each has a sandbox twin.
 *
 * DOĞRULANAMADI: hosts and paths are written from Hepsiburada's integration
 * documentation and have not been exercised against a real merchant account.
 */
const HOSTS: Record<string, Record<'oms' | 'listing' | 'mpop', string>> = {
  production: {
    oms: 'https://oms-external.hepsiburada.com',
    listing: 'https://listing-external.hepsiburada.com',
    mpop: 'https://mpop.hepsiburada.com',
  },
  sandbox: {
    oms: 'https://oms-external-sit.hepsiburada.com',
    listing: 'https://listing-external-sit.hepsiburada.com',
    mpop: 'https://mpop-sit.hepsiburada.com',
  },
};

const PATHS = {
  orders: (merchantId: string) => `/orders/merchantid/${merchantId}`,
  listings: (merchantId: string) => `/listings/merchantid/${merchantId}`,
  stockUploads: (merchantId: string) => `/listings/merchantid/${merchantId}/stock-uploads`,
  categories: () => '/product/api/categories/get-all-categories',
  categoryAttributes: (categoryId: string) => `/product/api/categories/${categoryId}/attributes`,
};

/** Hepsiburada pages by offset/limit rather than page number. */
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

interface HepsiburadaPage<T> {
  items?: T[];
  content?: T[];
  totalCount?: number;
  totalElements?: number;
}

export class HepsiburadaConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 50;

  protected get displayName(): string {
    return 'Hepsiburada';
  }

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('HEPSIBURADA', credentials, httpClient, rateLimiter, settings);
  }

  private host(family: 'oms' | 'listing' | 'mpop'): string {
    return (HOSTS[this.environment] ?? HOSTS.production)[family];
  }

  protected authHeaders(): Record<string, string> {
    const { merchantId, apiKey, apiSecret } = this.requireCredentials(
      'merchantId',
      'apiKey',
      'apiSecret',
    );
    return {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      // Hepsiburada expects the merchant to identify itself in the agent string.
      'User-Agent': `${merchantId} - SelfIntegration`,
    };
  }

  private call<T>(
    family: 'oms' | 'listing' | 'mpop',
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    return this.send<T>(`${this.host(family)}${path}`, options);
  }

  /** Walks an offset/limit collection until the reported total is covered. */
  private async fetchAll<T>(
    family: 'oms' | 'listing' | 'mpop',
    path: string,
    query: Record<string, string | number | undefined>,
  ): Promise<T[]> {
    const collected: T[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<HepsiburadaPage<T>>(family, path, {
        query: { ...query, offset, limit: PAGE_LIMIT },
      });

      const rows = result?.items ?? result?.content ?? [];
      collected.push(...rows);

      const total = Number(result?.totalCount ?? result?.totalElements);
      offset += PAGE_LIMIT;

      // Stop on a short page as well: a missing total must not cost 50 requests.
      if (rows.length < PAGE_LIMIT) break;
      if (Number.isFinite(total) && offset >= total) break;
    }

    return collected;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const { merchantId } = this.requireCredentials('merchantId', 'apiKey', 'apiSecret');
      const result = await this.call<HepsiburadaPage<unknown>>('listing', PATHS.listings(merchantId), {
        query: { offset: 0, limit: 1 },
      });

      const total = Number(result?.totalCount ?? result?.totalElements);
      return Number.isFinite(total)
        ? `Hepsiburada bağlantısı doğrulandı. Satıcı hesabında ${total} listeleme görüldü.`
        : 'Hepsiburada bağlantısı doğrulandı.';
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const { merchantId } = this.requireCredentials('merchantId', 'apiKey', 'apiSecret');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const beginDate = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const raw = await this.fetchAll<Record<string, any>>('oms', PATHS.orders(merchantId), {
      beginDate: beginDate.toISOString(),
      endDate: new Date().toISOString(),
    });

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => this.normaliseStatus(status)));

    return raw
      .map((order) => this.toHepsiburadaOrder(order))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(this.normaliseStatus(order.status)))
      .map((order) => HepsiburadaMapper.toUnifiedOrder(order));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    const { merchantId } = this.requireCredentials('merchantId', 'apiKey', 'apiSecret');

    const raw = await this.fetchAll<Record<string, any>>('listing', PATHS.listings(merchantId), {});

    return raw.map((product) =>
      HepsiburadaMapper.toUnifiedProduct(this.toHepsiburadaProduct(product)),
    );
  }

  /** Hepsiburada keys inventory by the merchant's own SKU, not by barcode. */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      const { merchantId } = this.requireCredentials('merchantId', 'apiKey', 'apiSecret');

      await this.call<unknown>('listing', PATHS.stockUploads(merchantId), {
        method: 'POST',
        body: [{ merchantSku: sku, availableStock: quantity }],
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'Hepsiburada stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const result = await this.call<{ data?: any[]; categories?: any[] }>(
      'mpop',
      PATHS.categories(),
      { query: { leaf: true } },
    );
    return result?.data ?? result?.categories ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>('mpop', PATHS.categoryAttributes(categoryId));
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  /**
   * Hepsiburada order statuses ("Open", "Packaged", "InTransit"...) and our
   * settings vocabulary ("created", "picking", "shipped") are different words
   * for the same states, so both sides are folded before comparison.
   */
  private normaliseStatus(status: string): string {
    const value = (status ?? '').toLowerCase();
    if (['open', 'new', 'created', 'awaiting'].includes(value)) return 'created';
    if (['packaged', 'picking', 'readytoship'].includes(value)) return 'picking';
    if (['intransit', 'shipped'].includes(value)) return 'shipped';
    if (['delivered'].includes(value)) return 'delivered';
    if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
    if (['returned', 'refunded'].includes(value)) return 'returned';
    if (['invoiced'].includes(value)) return 'invoiced';
    return value;
  }

  private toHepsiburadaOrder(raw: Record<string, any>): HepsiburadaOrder {
    const items: HepsiburadaItem[] = (raw.items ?? raw.lines ?? raw.details ?? []).map(
      (item: Record<string, any>) => ({
        sku: item.merchantSku ?? item.sku ?? item.hepsiburadaSku ?? '',
        name: item.productName ?? item.name ?? '',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price ?? item.unitPrice ?? item.totalPrice ?? 0),
      }),
    );

    const customer = raw.customer ?? {};
    const address = raw.shippingAddress ?? raw.deliveryAddress ?? {};
    // `||`, not `??`: an empty join('') is not nullish, so `??` made every
    // fallback after the first one unreachable.
    const customerName =
      customer.name ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      raw.customerName ||
      '';

    return {
      id: String(raw.id ?? raw.orderId ?? ''),
      orderNumber: raw.orderNumber ?? raw.orderId ?? String(raw.id ?? ''),
      customer: {
        name: customerName || 'Hepsiburada Müşterisi',
        email: customer.email ?? raw.customerEmail,
        phone: customer.phone ?? customer.phoneNumber ?? raw.customerPhone,
      },
      shippingAddress: {
        address: address.address ?? address.addressDetail ?? '',
        city: address.city ?? '',
        town: address.town ?? address.district ?? '',
      },
      items,
      // Folded once, here. The mapper used to compare the raw name with `===`,
      // so anything other than Open/Shipped/Delivered/Cancelled — Packaged,
      // InTransit, ReadyToShip — silently arrived as "pending".
      status: this.normaliseStatus(raw.status ?? raw.orderStatus ?? 'Open'),
      totalAmount: Number(raw.totalPrice ?? raw.totalAmount ?? 0),
      currency: raw.currency ?? 'TRY',
    };
  }

  private toHepsiburadaProduct(raw: Record<string, any>): HepsiburadaProduct {
    const image = Array.isArray(raw.images)
      ? typeof raw.images[0] === 'string'
        ? raw.images[0]
        : raw.images[0]?.url
      : raw.image;

    return {
      hepsiburadaSku: raw.hepsiburadaSku ?? raw.hbSku ?? '',
      merchantSku: raw.merchantSku ?? raw.sku ?? '',
      name: raw.productName ?? raw.name ?? raw.title ?? '',
      description: raw.description,
      price: Number(raw.price ?? raw.salePrice ?? 0),
      stock: Number(raw.availableStock ?? raw.stock ?? raw.quantity) || 0,
      image,
      barcode: raw.barcode,
    };
  }
}
