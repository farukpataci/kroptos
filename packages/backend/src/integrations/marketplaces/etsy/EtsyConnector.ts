import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { EtsyMapper } from './EtsyMapper';
import { EtsyListing, EtsyMoney, EtsyReceipt, EtsyTransaction } from './EtsyTypes';

/**
 * Etsy's OAuth token endpoint and its API live on different hosts, and there is
 * no sandbox: both environments resolve to the same live shop.
 *
 * DOĞRULANAMADI: hosts, paths and payload keys are written from Etsy's Open API
 * v3 documentation and have not been exercised against a real shop.
 */
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const BASE_URL = 'https://openapi.etsy.com/v3/application';

const PATHS = {
  shop: (shopId: string) => `/shops/${shopId}`,
  receipts: (shopId: string) => `/shops/${shopId}/receipts`,
  listings: (shopId: string) => `/shops/${shopId}/listings`,
  listingInventory: (listingId: number | string) => `/listings/${listingId}/inventory`,
  taxonomyNodes: () => '/seller-taxonomy/nodes',
  taxonomyProperties: (taxonomyId: string) => `/seller-taxonomy/nodes/${taxonomyId}/properties`,
};

const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

/** Refresh a minute early so a token cannot expire mid-request. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

interface EtsyTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface EtsyPage<T> {
  count?: number;
  results?: T[];
}

export class EtsyConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  protected get displayName(): string {
    return 'Etsy';
  }

  private accessToken?: { value: string; expiresAt: number };

  /**
   * Etsy hands back a refresh token with every exchange. It is kept here for
   * the rest of this instance's calls and also recorded for the caller to
   * persist — previously it lived only in memory, so every process restart went
   * back to the token the seller originally pasted and the integration died the
   * moment Etsy stopped honouring it.
   */
  private rotatedRefreshToken?: string;

  /** sku -> listing id, built once per instance; see updateStock. */
  private listingIndex?: Map<string, number>;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('ETSY', credentials, httpClient, rateLimiter, settings);
  }

  // --------------------------------------------------------------------------
  // OAuth2 refresh grant
  // --------------------------------------------------------------------------

  /**
   * Not routed through `send()`: the token call is form encoded and must not
   * carry the bearer we are about to build.
   */
  private async fetchAccessToken(): Promise<string> {
    const { keystring, refreshToken } = this.requireCredentials('keystring', 'refreshToken');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: keystring,
      refresh_token: this.rotatedRefreshToken ?? refreshToken,
    });

    let response: EtsyTokenResponse;
    try {
      response = await this.httpClient.request<EtsyTokenResponse>(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (error: any) {
      throw new Error(
        `Etsy oturum anahtarı alınamadı. Refresh Token süresi dolmuş olabilir; ` +
          `Etsy hesabınızdan yeni bir token alıp ayarlara yapıştırın. ${error?.message ?? ''}`.trim(),
      );
    }

    if (!response?.access_token) {
      throw new Error('Etsy oturum anahtarı alınamadı: yanıt access_token içermiyor.');
    }

    if (response.refresh_token) {
      const previous = this.rotatedRefreshToken ?? this.credentials.refreshToken;
      this.rotatedRefreshToken = response.refresh_token;

      // Only report an actual change: Etsy returning the same token is not a
      // rotation, and persisting it would rewrite the row on every sync.
      if (response.refresh_token !== previous) {
        this.recordRotatedCredentials({ refreshToken: response.refresh_token });
      }
    }

    const lifetimeMs = (Number(response.expires_in) || 3600) * 1000;
    this.accessToken = {
      value: response.access_token,
      expiresAt: Date.now() + lifetimeMs - TOKEN_SAFETY_MARGIN_MS,
    };

    return this.accessToken.value;
  }

  /** Etsy wants the app key on every call in addition to the bearer token. */
  protected async authHeaders(): Promise<Record<string, string>> {
    const { keystring } = this.requireCredentials('keystring', 'refreshToken');
    const cached = this.accessToken;
    const token = cached && cached.expiresAt > Date.now() ? cached.value : await this.fetchAccessToken();

    return { 'x-api-key': keystring, Authorization: `Bearer ${token}` };
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

  private get shopId(): string {
    const { shopId } = this.requireCredentials('shopId');
    return shopId;
  }

  /** Etsy pages with limit/offset and reports the full size in `count`. */
  private async fetchAllPages<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined>,
  ): Promise<T[]> {
    const collected: T[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<EtsyPage<T>>(path, {
        query: { ...query, limit: PAGE_LIMIT, offset },
      });

      const rows = result?.results ?? [];
      collected.push(...rows);
      offset += PAGE_LIMIT;

      if (rows.length < PAGE_LIMIT) break;
      const count = Number(result?.count);
      if (Number.isFinite(count) && offset >= count) break;
    }

    return collected;
  }

  /** Scales Etsy's integer-plus-divisor money into a plain number. */
  private toAmount(money: EtsyMoney | number | undefined): number {
    if (typeof money === 'number') return money;
    if (!money) return 0;
    const divisor = Number(money.divisor) || 100;
    return Number(money.amount ?? 0) / divisor;
  }

  private currencyOf(money: EtsyMoney | undefined, fallback = 'USD'): string {
    return money?.currency_code ?? fallback;
  }

  // --------------------------------------------------------------------------
  // Connector surface
  // --------------------------------------------------------------------------

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('keystring', 'refreshToken', 'shopId');
      const shop = await this.call<{ shop_name?: string; listing_active_count?: number }>(
        PATHS.shop(this.shopId),
      );

      const name = shop?.shop_name ?? this.shopId;
      const count = Number(shop?.listing_active_count);
      return Number.isFinite(count)
        ? `Etsy bağlantısı doğrulandı. ${name} mağazasında ${count} aktif ilan görüldü.`
        : `Etsy bağlantısı doğrulandı (${name}).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('keystring', 'refreshToken', 'shopId');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    // Etsy filters receipts by unix seconds, not milliseconds.
    const minCreated = Math.floor(
      (Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000) / 1000,
    );

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.receipts(this.shopId), {
      min_created: minCreated,
    });

    const wanted = this.setting<string[]>('orders.importStatuses', ['created', 'picking', 'shipped']);
    const wantedSet = new Set(wanted.map((status) => status.toLowerCase()));

    return raw
      .map((receipt) => this.toEtsyReceipt(receipt))
      .filter((receipt) => wantedSet.size === 0 || wantedSet.has(this.settingsStatus(receipt)))
      .map((receipt) => EtsyMapper.toUnifiedOrder(receipt));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    this.requireCredentials('keystring', 'refreshToken', 'shopId');

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.listings(this.shopId), {
      state: this.setting<string>('etsy.listingState', 'active'),
    });

    return raw.map((listing) => EtsyMapper.toUnifiedProduct(this.toEtsyListing(listing)));
  }

  /**
   * Etsy keys inventory by listing, not by SKU, and the inventory endpoint only
   * accepts a whole document. So this is a read-modify-write: find the listing
   * holding the SKU, fetch its inventory, change the quantity of the matching
   * offerings, and put the document back untouched otherwise.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      this.requireCredentials('keystring', 'refreshToken', 'shopId');

      const listingId = await this.findListingId(sku);
      if (!listingId) {
        return {
          sku,
          quantity,
          success: false,
          error: `Etsy'de ${sku} stok koduna sahip ilan bulunamadı.`,
        };
      }

      const inventory = await this.call<Record<string, any>>(PATHS.listingInventory(listingId));
      const products = (inventory?.products ?? []).map((product: Record<string, any>) => {
        if (product.sku && product.sku !== sku) return product;
        return {
          ...product,
          offerings: (product.offerings ?? []).map((offering: Record<string, any>) => ({
            ...offering,
            quantity,
          })),
        };
      });

      await this.call<unknown>(PATHS.listingInventory(listingId), {
        method: 'PUT',
        body: { products },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'Etsy stok güncellemesi başarısız',
      };
    }
  }

  /**
   * Builds the SKU index once per instance. A sync updates many SKUs in a row,
   * so walking the shop's listings once beats one search per SKU.
   */
  private async findListingId(sku: string): Promise<number | undefined> {
    if (!this.listingIndex) {
      const raw = await this.fetchAllPages<Record<string, any>>(PATHS.listings(this.shopId), {
        state: 'active',
      });

      this.listingIndex = new Map();
      for (const listing of raw) {
        const parsed = this.toEtsyListing(listing);
        if (parsed.sku) this.listingIndex.set(parsed.sku, parsed.listing_id);
      }
    }

    return this.listingIndex.get(sku);
  }

  /** Etsy's equivalent of a category tree is the seller taxonomy. */
  async getCategories(): Promise<any[]> {
    const result = await this.call<{ results?: any[] }>(PATHS.taxonomyNodes());
    return result?.results ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.taxonomyProperties(categoryId));
  }

  // --------------------------------------------------------------------------
  // Response normalisation
  // --------------------------------------------------------------------------

  /** Folds Etsy's payment status plus the shipped flag onto our vocabulary. */
  private settingsStatus(receipt: EtsyReceipt): string {
    if (receipt.status === 'canceled') return 'cancelled';
    if (receipt.status === 'completed') return 'delivered';
    if (receipt.is_shipped) return 'shipped';
    return 'created';
  }

  private toEtsyReceipt(raw: Record<string, any>): EtsyReceipt {
    const transactions: EtsyTransaction[] = (raw.transactions ?? []).map(
      (transaction: Record<string, any>) => ({
        sku: transaction.sku ?? '',
        title: transaction.title ?? '',
        quantity: Number(transaction.quantity) || 0,
        price: this.toAmount(transaction.price),
      }),
    );

    return {
      receipt_id: Number(raw.receipt_id) || 0,
      name: raw.name ?? raw.buyer_name ?? '',
      buyer_email: raw.buyer_email,
      first_line: raw.first_line,
      city: raw.city,
      state: raw.state,
      country_iso: raw.country_iso,
      status: String(raw.status ?? 'open').toLowerCase(),
      is_shipped: Boolean(raw.is_shipped),
      total: this.toAmount(raw.grandtotal ?? raw.total_price),
      currency: this.currencyOf(raw.grandtotal ?? raw.total_price),
      transactions,
    };
  }

  private toEtsyListing(raw: Record<string, any>): EtsyListing {
    const image = raw.images?.[0]?.url_570xN ?? raw.images?.[0]?.url ?? raw.image;

    return {
      listing_id: Number(raw.listing_id) || 0,
      sku: Array.isArray(raw.skus) ? (raw.skus[0] ?? '') : (raw.sku ?? ''),
      title: raw.title ?? '',
      description: raw.description,
      price: this.toAmount(raw.price),
      quantity: Number(raw.quantity) || 0,
      image,
    };
  }
}
