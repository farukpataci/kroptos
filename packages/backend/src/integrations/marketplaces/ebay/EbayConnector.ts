import { ebayMarketplaceName, isEbayMarketplace } from '@kroptos/shared';
import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { EbayMapper } from './EbayMapper';
import {
  EbayInventoryPage,
  EbayOrderPage,
  EbayTokenResponse,
} from './EbayTypes';

/**
 * One eBay site, fixed at construction by the `marketplace` credential.
 *
 * eBay's model differs from the Turkish marketplaces in ways that show up in
 * the methods below:
 *  - Auth is OAuth2. The access token lives two hours, so nearly every sync
 *    exchanges the refresh token first.
 *  - Inventory is SKU-keyed records (`inventory_item`) that are published as
 *    `offer`s. Price belongs to the offer, not the item, and stock can only be
 *    pushed for a SKU eBay already knows.
 *
 * DOĞRULANAMADI: none of the calls here have been exercised against a real
 * seller account. Hosts, paths and the marketplace id list come from eBay's
 * documentation.
 */

const HOSTS: Record<string, string> = {
  production: 'https://api.ebay.com',
  sandbox: 'https://api.sandbox.ebay.com',
};

const PATHS = {
  token: () => '/identity/v1/oauth2/token',
  orders: () => '/sell/fulfillment/v1/order',
  inventoryItems: () => '/sell/inventory/v1/inventory_item',
  bulkUpdatePriceQuantity: () => '/sell/inventory/v1/bulk_update_price_quantity',
  defaultCategoryTreeId: () => '/commerce/taxonomy/v1/get_default_category_tree_id',
  categoryTree: (treeId: string) => `/commerce/taxonomy/v1/category_tree/${treeId}`,
  itemAspects: (treeId: string) =>
    `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category`,
};

/** Refresh a minute early so a token cannot expire mid-request. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

/** eBay caps a page of orders and inventory items at 200 and 100 respectively. */
const ORDER_PAGE_SIZE = 200;
const INVENTORY_PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * `bulkUpdatePriceQuantity` accepts at most 25 SKUs per call — a documented
 * hard limit, not a tuning knob.
 */
const BULK_UPDATE_LIMIT = 25;

export class EbayConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  private readonly marketplaceId: string;
  private accessToken?: { value: string; expiresAt: number };
  private categoryTreeId?: string;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('EBAY', credentials, httpClient, rateLimiter, settings);

    const raw = String(credentials?.marketplace ?? '').trim().toUpperCase();
    if (!raw) {
      throw new Error(
        'eBay entegrasyonu için pazar seçilmedi. Entegrasyon ayarlarından pazarı seçin.',
      );
    }
    if (!isEbayMarketplace(raw)) {
      throw new Error(
        `eBay için desteklenmeyen pazar kodu: '${raw}'. ` +
          'Desteklenen pazarlar entegrasyon ayarlarındaki listede yer alır.',
      );
    }

    this.marketplaceId = raw;
  }

  protected get displayName(): string {
    return 'eBay';
  }

  /** Each site gets its own throttling bucket, as each has its own quota. */
  protected get rateLimitKey(): string {
    return `EBAY:${this.marketplaceId}`;
  }

  private get host(): string {
    return HOSTS[this.environment] ?? HOSTS.production;
  }

  // --------------------------------------------------------------------------
  // OAuth2 refresh grant
  // --------------------------------------------------------------------------

  /**
   * Not routed through `send()`: the token call is form encoded, authenticates
   * with the application's own Basic credentials, and must not carry the bearer
   * it is about to produce.
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
    });

    let response: EbayTokenResponse;
    try {
      response = await this.httpClient.request<EbayTokenResponse>(
        `${this.host}${PATHS.token()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          body: body.toString(),
        },
      );
    } catch (error: any) {
      throw new Error(
        'eBay oturum anahtarı yenilenemedi. Refresh token süresi dolmuş olabilir; ' +
          `eBay hesabınızdan yeni bir token alıp ayarlara yapıştırın. ${error?.message ?? ''}`.trim(),
      );
    }

    if (!response?.access_token) {
      throw new Error('eBay oturum anahtarı alınamadı: yanıt access_token içermiyor.');
    }

    // eBay may return a replacement refresh token. Reporting it lets the caller
    // persist it; without that the new value would die with this instance and
    // the integration would stop authenticating after a restart.
    if (response.refresh_token && response.refresh_token !== refreshToken) {
      this.recordRotatedCredentials({ refreshToken: response.refresh_token });
    }

    const lifetimeMs = (Number(response.expires_in) || 7200) * 1000;
    this.accessToken = {
      value: response.access_token,
      expiresAt: Date.now() + lifetimeMs - TOKEN_SAFETY_MARGIN_MS,
    };

    return response.access_token;
  }

  private async bearer(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
      return this.accessToken.value;
    }
    return this.fetchAccessToken();
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.bearer()}`,
      // Scopes every Sell API call to one site. Omitting it makes eBay fall
      // back to the account default, which silently returns another site's data.
      'X-EBAY-C-MARKETPLACE-ID': this.marketplaceId,
    };
  }

  private call<T>(
    path: string,
    options: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    return this.send<T>(`${this.host}${path}`, options);
  }

  // --------------------------------------------------------------------------
  // Contract
  // --------------------------------------------------------------------------

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('clientId', 'clientSecret', 'refreshToken');

      // Cheapest authenticated read: it exercises the token exchange, the
      // marketplace header and the seller's scopes in one call.
      const result = await this.call<EbayOrderPage>(PATHS.orders(), { query: { limit: 1 } });

      const total = Number(result?.total);
      const where = ebayMarketplaceName(this.marketplaceId);
      return Number.isFinite(total)
        ? `eBay bağlantısı doğrulandı (${where}). Hesapta ${total} sipariş görüldü.`
        : `eBay bağlantısı doğrulandı (${where}).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const since = new Date(Date.now() - Math.max(0, backfillDays) * 24 * 60 * 60 * 1000);

    const collected: MarketplaceOrder[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<EbayOrderPage>(PATHS.orders(), {
        query: {
          limit: ORDER_PAGE_SIZE,
          offset,
          // eBay's filter syntax is a bracketed range; an open end means "up to
          // now" without having to send a moving timestamp.
          filter: `creationdate:[${since.toISOString()}..]`,
        },
      });

      const orders = result?.orders ?? [];
      collected.push(
        ...orders.map((order) => EbayMapper.toUnifiedOrder(order, this.fallbackCurrency)),
      );

      if (orders.length < ORDER_PAGE_SIZE) break;
      offset += ORDER_PAGE_SIZE;
    }

    const wanted = this.setting<string[]>('orders.importStatuses', []);
    if (wanted.length === 0) return collected;

    const wantedSet = new Set(wanted.map((s) => s.toLowerCase()));
    return collected.filter((order) => wantedSet.has(order.status.toLowerCase()));
  }

  /**
   * Only returns listings created through the Inventory API. A seller whose
   * listings were made with the older Trading API will see nothing here — a
   * real limitation of this endpoint, not an error.
   */
  async getProducts(): Promise<MarketplaceProduct[]> {
    const collected: MarketplaceProduct[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<EbayInventoryPage>(PATHS.inventoryItems(), {
        query: { limit: INVENTORY_PAGE_SIZE, offset },
      });

      const items = result?.inventoryItems ?? [];
      collected.push(...items.map((item) => EbayMapper.toUnifiedProduct(item)));

      if (items.length < INVENTORY_PAGE_SIZE) break;
      offset += INVENTORY_PAGE_SIZE;
    }

    return collected;
  }

  /**
   * eBay updates stock per SKU through a bulk endpoint capped at 25 records.
   * The shared contract pushes one SKU at a time, so this sends a single-item
   * batch; `updateStockBatch` exists for callers that can group.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    const [result] = await this.updateStockBatch([{ sku, quantity }]);
    return result;
  }

  /**
   * Groups SKUs into batches of 25. Exposed separately because the sync worker
   * currently walks SKUs one by one — sending them in batches is a worker
   * change, and this is the side that has to exist first.
   */
  async updateStockBatch(
    updates: Array<{ sku: string; quantity: number }>,
  ): Promise<StockUpdateResult[]> {
    const results: StockUpdateResult[] = [];

    for (let start = 0; start < updates.length; start += BULK_UPDATE_LIMIT) {
      const batch = updates.slice(start, start + BULK_UPDATE_LIMIT);

      try {
        await this.call<unknown>(PATHS.bulkUpdatePriceQuantity(), {
          method: 'POST',
          body: {
            requests: batch.map(({ sku, quantity }) => ({
              sku,
              shipToLocationAvailability: { quantity },
            })),
          },
        });

        results.push(...batch.map(({ sku, quantity }) => ({ sku, quantity, success: true })));
      } catch (error: any) {
        // One SKU eBay does not know fails the whole batch, so the error is
        // reported against every SKU in it rather than silently against one.
        results.push(
          ...batch.map(({ sku, quantity }) => ({
            sku,
            quantity,
            success: false,
            error: error?.message || 'eBay stok güncellemesi başarısız',
          })),
        );
      }
    }

    return results;
  }

  /**
   * The category tree id is per marketplace and stable, so it is fetched once
   * per connector instance rather than on every category call.
   */
  private async resolveCategoryTreeId(): Promise<string> {
    if (this.categoryTreeId) return this.categoryTreeId;

    const result = await this.call<{ categoryTreeId?: string }>(PATHS.defaultCategoryTreeId(), {
      query: { marketplace_id: this.marketplaceId },
    });

    if (!result?.categoryTreeId) {
      throw new Error(
        `eBay kategori ağacı kimliği alınamadı (${ebayMarketplaceName(this.marketplaceId)}).`,
      );
    }

    this.categoryTreeId = result.categoryTreeId;
    return this.categoryTreeId;
  }

  async getCategories(): Promise<any[]> {
    const treeId = await this.resolveCategoryTreeId();
    const tree = await this.call<{ rootCategoryNode?: { childCategoryTreeNodes?: any[] } }>(
      PATHS.categoryTree(treeId),
    );

    return tree?.rootCategoryNode?.childCategoryTreeNodes ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    const treeId = await this.resolveCategoryTreeId();
    return this.call<any>(PATHS.itemAspects(treeId), { query: { category_id: categoryId } });
  }

  /**
   * DOĞRULANAMADI: which currency each eBay site settles in. eBay states the
   * currency on the order payload and that value is preferred; this fallback
   * only applies when a response omits it. A guessed per-site currency table
   * would silently mislabel money, so nothing is substituted.
   *
   * TODO: replace once the per-marketplace currency list is confirmed.
   */
  private get fallbackCurrency(): string {
    return '';
  }
}
