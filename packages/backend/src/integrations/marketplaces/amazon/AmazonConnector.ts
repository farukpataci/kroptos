import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { AmazonMapper } from './AmazonMapper';
import { AmazonOrder, AmazonOrderItem, AmazonProduct } from './AmazonTypes';

/**
 * SP-API is region-scoped: a seller's account lives in exactly one of three
 * endpoints and calling the wrong one returns 403 rather than an empty list.
 *
 * DOĞRULANAMADI: hosts, paths and payload keys are written from Amazon's
 * SP-API documentation and have not been exercised against a real seller
 * account.
 */
const REGION_HOSTS: Record<string, { production: string; sandbox: string }> = {
  na: {
    production: 'https://sellingpartnerapi-na.amazon.com',
    sandbox: 'https://sandbox.sellingpartnerapi-na.amazon.com',
  },
  eu: {
    production: 'https://sellingpartnerapi-eu.amazon.com',
    sandbox: 'https://sandbox.sellingpartnerapi-eu.amazon.com',
  },
  fe: {
    production: 'https://sellingpartnerapi-fe.amazon.com',
    sandbox: 'https://sandbox.sellingpartnerapi-fe.amazon.com',
  },
};

/** Login with Amazon is a global endpoint, unrelated to the SP-API region. */
const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

const PATHS = {
  orders: () => '/orders/v0/orders',
  orderItems: (orderId: string) => `/orders/v0/orders/${orderId}/orderItems`,
  inventorySummaries: () => '/fba/inventory/v1/summaries',
  listingsItem: (sellerId: string, sku: string) =>
    `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
  productTypes: () => '/definitions/2020-09-01/productTypes',
  productTypeDefinition: (productType: string) =>
    `/definitions/2020-09-01/productTypes/${encodeURIComponent(productType)}`,
};

const MAX_PAGES = 50;

/** Refresh a minute early so a token cannot expire mid-request. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

interface LwaTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export class AmazonConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 30;

  protected get displayName(): string {
    return 'Amazon';
  }

  /**
   * Cached per connector instance. The factory builds one instance per request,
   * so this mainly spares the order sync a token exchange for every one of its
   * per-order item lookups.
   */
  private accessToken?: { value: string; expiresAt: number };

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('AMAZON', credentials, httpClient, rateLimiter, settings);
  }

  private get baseUrl(): string {
    const region = String(this.setting<string>('amazon.region', 'eu')).toLowerCase();
    const hosts = REGION_HOSTS[region] ?? REGION_HOSTS.eu;
    return this.environment === 'sandbox' ? hosts.sandbox : hosts.production;
  }

  /** Marketplaces the seller wants synced; SP-API requires at least one. */
  private get marketplaceIds(): string[] {
    const configured = this.setting<string[] | string>('amazon.marketplaceIds', []);
    const list = Array.isArray(configured) ? configured : [configured];
    return list.map((id) => String(id).trim()).filter(Boolean);
  }

  private requireMarketplaceIds(): string[] {
    const ids = this.marketplaceIds;
    if (ids.length === 0) {
      throw new Error(
        'Amazon pazaryeri seçilmedi. Ayarlar > Genel altında amazon.marketplaceIds alanını doldurun.',
      );
    }
    return ids;
  }

  // --------------------------------------------------------------------------
  // Login with Amazon
  // --------------------------------------------------------------------------

  /**
   * Exchanges the long-lived refresh token for an access token. This call is
   * deliberately not routed through `send()`: LWA wants form encoding and must
   * not carry the SP-API auth header we are in the middle of building.
   */
  private async fetchAccessToken(): Promise<string> {
    const { clientId, clientSecret, refreshToken } = this.requireCredentials(
      'clientId',
      'clientSecret',
      'refreshToken',
    );

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    let response: LwaTokenResponse;
    try {
      response = await this.httpClient.request<LwaTokenResponse>(LWA_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (error: any) {
      // A refused exchange is nearly always a stale refresh token, and saying so
      // saves the seller from re-checking the other three fields.
      throw new Error(
        `Amazon oturum anahtarı alınamadı. Refresh Token süresi dolmuş veya LWA ` +
          `istemci bilgileri hatalı olabilir. ${error?.message ?? ''}`.trim(),
      );
    }

    if (!response?.access_token) {
      throw new Error('Amazon oturum anahtarı alınamadı: yanıt access_token içermiyor.');
    }

    const lifetimeMs = (Number(response.expires_in) || 3600) * 1000;
    this.accessToken = {
      value: response.access_token,
      expiresAt: Date.now() + lifetimeMs - TOKEN_SAFETY_MARGIN_MS,
    };

    return this.accessToken.value;
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    const cached = this.accessToken;
    const token = cached && cached.expiresAt > Date.now() ? cached.value : await this.fetchAccessToken();
    return { 'x-amz-access-token': token };
  }

  private call<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    return this.send<T>(`${this.baseUrl}${path}`, options);
  }

  /**
   * SP-API pages with an opaque NextToken instead of page numbers: the cursor
   * has to be echoed back and every other parameter dropped.
   */
  private async fetchAllPages<T>(
    path: string,
    query: Record<string, string | number | undefined>,
    read: (payload: any) => { rows: T[]; nextToken?: string },
  ): Promise<T[]> {
    const collected: T[] = [];
    let nextToken: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<{ payload?: any; NextToken?: string }>(path, {
        query: nextToken ? { NextToken: nextToken } : query,
      });

      const { rows, nextToken: cursor } = read(result?.payload ?? result);
      collected.push(...rows);

      if (!cursor) break;
      nextToken = cursor;
    }

    return collected;
  }

  // --------------------------------------------------------------------------
  // Connector surface
  // --------------------------------------------------------------------------

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('sellerId', 'clientId', 'clientSecret', 'refreshToken');
      const marketplaceIds = this.requireMarketplaceIds();

      // Narrow window on purpose: this proves the token, the region and the
      // marketplace id without pulling a real order backlog.
      const createdAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await this.call<{ payload?: { Orders?: unknown[] } }>(PATHS.orders(), {
        query: {
          MarketplaceIds: marketplaceIds.join(','),
          CreatedAfter: createdAfter,
          MaxResultsPerPage: 1,
        },
      });

      return `Amazon bağlantısı doğrulandı (${this.setting<string>('amazon.region', 'eu').toUpperCase()} bölgesi, ${marketplaceIds.length} pazaryeri).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('sellerId', 'clientId', 'clientSecret', 'refreshToken');
    const marketplaceIds = this.requireMarketplaceIds();

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const createdAfter = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const rawOrders = await this.fetchAllPages<Record<string, any>>(
      PATHS.orders(),
      {
        MarketplaceIds: marketplaceIds.join(','),
        CreatedAfter: createdAfter.toISOString(),
      },
      (payload) => ({ rows: payload?.Orders ?? [], nextToken: payload?.NextToken }),
    );

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    const selected = rawOrders.filter(
      (order) =>
        wantedSet.size === 0 || wantedSet.has(this.normaliseStatus(order.OrderStatus)),
    );

    // SP-API does not return line items with the order, so each surviving order
    // costs one extra call. Filtering first keeps that cost proportional to what
    // will actually be imported.
    const orders: AmazonOrder[] = [];
    for (const raw of selected) {
      const items = await this.fetchOrderItems(String(raw.AmazonOrderId ?? ''));
      orders.push(this.toAmazonOrder(raw, items));
    }

    return orders.map((order) => AmazonMapper.toUnifiedOrder(order));
  }

  private async fetchOrderItems(orderId: string): Promise<AmazonOrderItem[]> {
    if (!orderId) return [];

    const result = await this.call<{ payload?: { OrderItems?: Record<string, any>[] } }>(
      PATHS.orderItems(orderId),
    );

    return (result?.payload?.OrderItems ?? []).map((item) => ({
      ASIN: item.ASIN ?? '',
      SellerSKU: item.SellerSKU ?? '',
      Title: item.Title ?? '',
      QuantityOrdered: Number(item.QuantityOrdered) || 0,
      ItemPrice: {
        Amount: String(item.ItemPrice?.Amount ?? '0'),
        CurrencyCode: item.ItemPrice?.CurrencyCode ?? 'USD',
      },
    }));
  }

  /**
   * Reads FBA inventory. Merchant-fulfilled listings are only retrievable in
   * bulk through the asynchronous Reports API, so an FBM-only seller will get an
   * empty list here rather than a wrong one.
   */
  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('sellerId', 'clientId', 'clientSecret', 'refreshToken');
    const marketplaceIds = this.requireMarketplaceIds();

    const raw = await this.fetchAllPages<Record<string, any>>(
      PATHS.inventorySummaries(),
      {
        details: 'true',
        granularityType: 'Marketplace',
        granularityId: marketplaceIds[0],
        marketplaceIds: marketplaceIds.join(','),
      },
      (payload) => ({
        rows: payload?.inventorySummaries ?? [],
        nextToken: payload?.nextToken ?? payload?.NextToken,
      }),
    );

    return raw.map((product) => AmazonMapper.toUnifiedProduct(this.toAmazonProduct(product)));
  }

  /**
   * Listings API patches one SKU at a time. `productType` is mandatory; the
   * generic PRODUCT type is used because stock is a type-independent attribute.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      const { sellerId } = this.requireCredentials(
        'sellerId',
        'clientId',
        'clientSecret',
        'refreshToken',
      );
      const marketplaceIds = this.requireMarketplaceIds();

      await this.call<unknown>(PATHS.listingsItem(sellerId, sku), {
        method: 'PATCH',
        query: { marketplaceIds: marketplaceIds.join(',') },
        body: {
          productType: 'PRODUCT',
          patches: [
            {
              op: 'replace',
              path: '/attributes/fulfillment_availability',
              value: [{ fulfillment_channel_code: 'DEFAULT', quantity }],
            },
          ],
        },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'Amazon stok güncellemesi başarısız',
      };
    }
  }

  /**
   * Amazon has no category tree in the sense the Turkish marketplaces use; the
   * closest equivalent a seller picks from is the product type list.
   */
  async getCategories(): Promise<any[]> {
    const marketplaceIds = this.requireMarketplaceIds();
    const result = await this.call<{ productTypes?: any[] }>(PATHS.productTypes(), {
      query: { marketplaceIds: marketplaceIds.join(',') },
    });
    return result?.productTypes ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    const marketplaceIds = this.requireMarketplaceIds();
    return this.call<any>(PATHS.productTypeDefinition(categoryId), {
      query: { marketplaceIds: marketplaceIds.join(','), requirements: 'LISTING' },
    });
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  private normaliseStatus(status: unknown): string {
    switch (String(status ?? '').toLowerCase()) {
      case 'pending':
      case 'unshipped':
      case 'partiallyshipped':
        return 'created';
      case 'shipped':
        return 'shipped';
      case 'canceled':
      case 'cancelled':
        return 'cancelled';
      case 'invoiceunconfirmed':
        return 'invoiced';
      default:
        return String(status ?? '').toLowerCase();
    }
  }

  private toAmazonOrder(raw: Record<string, any>, items: AmazonOrderItem[]): AmazonOrder {
    const buyer = raw.BuyerInfo ?? {};
    return {
      AmazonOrderId: raw.AmazonOrderId ?? '',
      PurchaseDate: raw.PurchaseDate ?? '',
      BuyerInfo: {
        BuyerName: buyer.BuyerName,
        BuyerEmail: buyer.BuyerEmail,
        BuyerPhone: buyer.BuyerPhone,
      },
      ShippingAddress: raw.ShippingAddress,
      OrderStatus: raw.OrderStatus ?? 'Pending',
      OrderTotal: {
        Amount: String(raw.OrderTotal?.Amount ?? '0'),
        CurrencyCode: raw.OrderTotal?.CurrencyCode ?? 'USD',
      },
      OrderItems: items,
    };
  }

  private toAmazonProduct(raw: Record<string, any>): AmazonProduct {
    const quantity =
      Number(raw.totalQuantity ?? raw.inventoryDetails?.fulfillableQuantity ?? raw.quantity) || 0;

    return {
      asin: raw.asin ?? '',
      sku: raw.sellerSku ?? raw.sku ?? '',
      attributes: {
        title: [{ value: raw.productName ?? raw.title ?? '' }],
      },
      price: {
        amount: Number(raw.price?.amount ?? 0),
        currency: raw.price?.currency ?? 'USD',
      },
      quantity,
      imageUrl: raw.imageUrl,
    };
  }
}
