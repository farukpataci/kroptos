import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { PazaramaMapper } from './PazaramaMapper';
import { PazaramaOrder, PazaramaOrderItem, PazaramaProduct } from './PazaramaTypes';

/**
 * Pazarama issues access tokens from a separate identity host and serves the
 * merchant API from another. There is no public sandbox, so both environments
 * resolve to the same pair.
 *
 * DOĞRULANAMADI: hosts, paths and payload keys are written from Pazarama's
 * merchant API documentation and have not been exercised against a real
 * seller account.
 */
const TOKEN_URL = 'https://isortagimgiris.pazarama.com/connect/token';
const BASE_URL = 'https://isortagimapi.pazarama.com';

/** The only scope Pazarama grants to merchant integrations. */
const TOKEN_SCOPE = 'merchantgatewayapi.fullaccess';

const PATHS = {
  orders: () => '/order/getOrdersForApi',
  products: () => '/product/products',
  stockUpdate: () => '/product/updateStock',
  categories: () => '/category/getCategoryTree',
  categoryAttributes: () => '/category/getCategoryWithAttributes',
};

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/** Refresh a minute early so a token cannot expire mid-request. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

interface PazaramaTokenResponse {
  data?: { accessToken?: string; expiresIn?: number };
  access_token?: string;
  expires_in?: number;
}

interface PazaramaEnvelope<T> {
  data?: T[] | { items?: T[]; totalCount?: number };
  totalCount?: number;
  success?: boolean;
  message?: string;
}

export class PazaramaConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  /**
   * The hosts and payload keys below come from the documentation only, so the
   * shapes this connector parses are unproven. Simulation keeps those guesses
   * out of tenant tables until a real seller account confirms them.
   */
  protected readonly defaultMode = 'simulation' as const;

  protected get displayName(): string {
    return 'Pazarama';
  }

  /**
   * Pazarama meters per merchant, so the bucket is keyed by the account rather
   * than the provider — otherwise one agency's sync stalls every other agency
   * inside the same 60/min.
   */
  protected get rateLimitKey(): string {
    return `PAZARAMA:${this.credentials.apiKey ?? ''}`;
  }

  /** Cached per connector instance, like the other token-based marketplaces. */
  private accessToken?: { value: string; expiresAt: number };

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('PAZARAMA', credentials, httpClient, rateLimiter, settings);
  }

  // --------------------------------------------------------------------------
  // OAuth2 client credentials
  // --------------------------------------------------------------------------

  /**
   * Not routed through `send()`: the token call is form encoded, authenticates
   * with Basic rather than the bearer we are about to build, and lives on a
   * different host.
   */
  private async fetchAccessToken(): Promise<string> {
    const { apiKey, secretKey } = this.requireCredentials('apiKey', 'secretKey');

    const basic = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: TOKEN_SCOPE });

    let response: PazaramaTokenResponse;
    try {
      response = await this.httpClient.request<PazaramaTokenResponse>(TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (error: any) {
      // Only 401/403 is evidence about the key pair. Blaming it for a 429, a
      // 5xx or a DNS failure sends the seller to re-enter credentials that were
      // never wrong, and drops the OAuth body that says `invalid_scope`.
      const described = this.describeError(error);
      throw new Error(`Pazarama oturum anahtarı alınamadı. ${described.message}`);
    }

    const token = response?.data?.accessToken ?? response?.access_token;
    if (!token) {
      throw new Error('Pazarama oturum anahtarı alınamadı: yanıt access token içermiyor.');
    }

    const lifetimeMs = (Number(response?.data?.expiresIn ?? response?.expires_in) || 3600) * 1000;
    this.accessToken = { value: token, expiresAt: Date.now() + lifetimeMs - TOKEN_SAFETY_MARGIN_MS };

    return token;
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    const cached = this.accessToken;
    const token = cached && cached.expiresAt > Date.now() ? cached.value : await this.fetchAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Pazarama answers 200 even when it refuses the operation; the refusal only
   * appears as `success:false` in the envelope. Every request goes through
   * here, so the check belongs here rather than at each call site.
   */
  private async call<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const response = await this.send<T>(`${BASE_URL}${path}`, options);

    const envelope = response as PazaramaEnvelope<unknown> | undefined;
    if (envelope?.success === false) {
      throw new Error(envelope.message?.trim() || `Pazarama isteği reddetti: ${path}`);
    }

    return response;
  }

  /** Pazarama wraps every payload in `data`, sometimes with a nested `items`. */
  private rows<T>(envelope: PazaramaEnvelope<T> | undefined): T[] {
    const data = envelope?.data;
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  }

  private total(envelope: PazaramaEnvelope<unknown> | undefined): number | undefined {
    const data = envelope?.data;
    const nested = Array.isArray(data) ? undefined : data?.totalCount;
    const value = Number(nested ?? envelope?.totalCount);
    return Number.isFinite(value) ? value : undefined;
  }

  private async fetchAllPages<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: Record<string, unknown>;
    },
  ): Promise<T[]> {
    const collected: T[] = [];
    let previousFirstRow: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const envelope = await this.call<PazaramaEnvelope<T>>(path, {
        method: options.method,
        query: options.query ? { ...options.query, Page: page, Size: PAGE_SIZE } : undefined,
        body: options.body ? { ...options.body, page, size: PAGE_SIZE } : undefined,
      });

      const rows = this.rows(envelope);

      // The query and body dialects below are both unverified. If Pazarama
      // ignores whichever one it is handed, every page comes back identical and
      // the loop would otherwise collect the same rows MAX_PAGES times.
      const firstRow = rows.length ? JSON.stringify(rows[0]) : undefined;
      if (firstRow !== undefined && firstRow === previousFirstRow) {
        throw new Error(
          `Pazarama sayfalaması ilerlemiyor: ${path} ${page}. sayfada da aynı kaydı döndürdü.`,
        );
      }
      previousFirstRow = firstRow;

      collected.push(...rows);

      // A short page ends the walk; totalCount is advisory and sometimes absent.
      if (rows.length < PAGE_SIZE) return collected;

      const total = this.total(envelope);
      if (total !== undefined && collected.length >= total) return collected;
    }

    // Falling out of the loop means the walk was cut short. Returning quietly
    // would report a partial catalogue as a complete sync.
    throw new Error(
      `Pazarama ${path} için sayfa sınırına ulaşıldı (${MAX_PAGES}×${PAGE_SIZE}). ` +
        'Senkron eksik kalacağı için durduruldu.',
    );
  }

  // --------------------------------------------------------------------------
  // Connector surface
  // --------------------------------------------------------------------------

  /** Seller-facing toggle from the catalogue tab; drives both probe and sync. */
  private get onlyApproved(): boolean {
    return this.setting<boolean>('pazarama.onlyApprovedProducts', true) !== false;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiKey', 'secretKey');
      const envelope = await this.call<PazaramaEnvelope<unknown>>(PATHS.products(), {
        query: { Approved: this.onlyApproved, Page: 0, Size: 1 },
      });

      const total = this.total(envelope);
      return total !== undefined
        ? `Pazarama bağlantısı doğrulandı. Satıcı hesabında ${total} ürün görüldü.`
        : 'Pazarama bağlantısı doğrulandı.';
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('apiKey', 'secretKey');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const startDate = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.orders(), {
      method: 'POST',
      body: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    });

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((order) => this.observeUnmapped('orders', order, (row) => this.toPazaramaOrder(row)))
      .filter((order) => wantedSet.size === 0 || wantedSet.has(this.settingsStatus(order.status)))
      .map((order) => {
        const unified = PazaramaMapper.toUnifiedOrder(order);
        // Both are seller-visible settings, and `orders.numberPrefix` even has
        // a 'PZR-' default set for this provider; neither did anything until
        // they were applied here.
        unified.status = this.mapOrderStatus(order.status, unified.status);
        unified.orderNumber = this.prefixOrderNumber(unified.orderNumber);
        return unified;
      });
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('apiKey', 'secretKey');

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.products(), {
      query: { Approved: this.onlyApproved },
    });

    return raw.map((product) =>
      PazaramaMapper.toUnifiedProduct(
        this.observeUnmapped('products', product, (row) => this.toPazaramaProduct(row)),
      ),
    );
  }

  /** Pazarama addresses inventory by the seller's stock code. */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      this.requireCredentials('apiKey', 'secretKey');

      await this.call<unknown>(PATHS.stockUpdate(), {
        method: 'POST',
        body: { items: [{ code: sku, stockCount: quantity }] },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'Pazarama stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const envelope = await this.call<PazaramaEnvelope<any>>(PATHS.categories());
    return this.rows(envelope);
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryAttributes(), { query: { id: categoryId } });
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  /**
   * PazaramaMapper compares against capitalised names, so incoming values are
   * folded to that spelling rather than widening the mapper.
   */
  private toStatusName(raw: unknown): string {
    switch (String(raw ?? '').toLowerCase()) {
      case 'preparing':
      case 'picking':
        return 'Preparing';
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

  /** Inverse view used to match the settings vocabulary. */
  private settingsStatus(status: string): string {
    switch (status) {
      case 'Preparing':
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

  private toPazaramaOrder(raw: Record<string, any>): PazaramaOrder {
    const items: PazaramaOrderItem[] = (raw.items ?? raw.orderItems ?? raw.products ?? []).map(
      (item: Record<string, any>) => ({
        stockCode: item.stockCode ?? item.code ?? item.sku ?? '',
        productName: item.productName ?? item.name ?? '',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price ?? item.salePrice ?? 0),
      }),
    );

    const address = raw.shippingAddress ?? raw.deliveryAddress ?? raw.address ?? {};
    const addressLine = typeof address === 'string' ? address : address.address ?? address.fullAddress ?? '';

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

  private toPazaramaProduct(raw: Record<string, any>): PazaramaProduct {
    const image = Array.isArray(raw.images)
      ? typeof raw.images[0] === 'string'
        ? raw.images[0]
        : raw.images[0]?.url ?? raw.images[0]?.imageUrl
      : raw.image ?? raw.imageUrl;

    return {
      code: raw.code ?? raw.stockCode ?? raw.sku ?? '',
      name: raw.name ?? raw.displayName ?? raw.productName ?? '',
      description: raw.description,
      salePrice: Number(raw.salePrice ?? raw.price ?? 0),
      stockCount: Number(raw.stockCount ?? raw.stock ?? raw.quantity) || 0,
      image,
      barcode: raw.barcode,
    };
  }
}
