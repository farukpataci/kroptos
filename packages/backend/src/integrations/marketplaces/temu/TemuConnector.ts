import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TemuMapper } from './TemuMapper';
import { buildTemuPayload } from './TemuSignature';
import { TemuEnvelope, TemuOrder, TemuOrderListResult } from './TemuTypes';

/**
 * Temu Open Platform.
 *
 * WHAT IS VERIFIED: the transport. Every call is a POST carrying one common
 * envelope (`type`, `app_key`, `access_token`, `timestamp`, `data_type`, `sign`)
 * whose signature is an MD5 over the sorted parameters wrapped in the app
 * secret. Operations are named RPC-style — `bg.order.list.v2.get` and friends —
 * rather than addressed by path.
 *
 * WHAT IS NOT VERIFIED, and is therefore not invented here:
 *
 *  - **The gateway host.** Temu's documentation sits behind an ISV login and
 *    the host could not be confirmed from any public source. It is a required
 *    credential (`apiUrl`) the seller copies from their own partner account
 *    instead of a value guessed in this file. A wrong host fails every call.
 *
 *  - **Most operation names.** Only the orders method appeared in Temu's own
 *    documentation navigation. The product, stock and category methods are
 *    left unset, and calling them raises a clear error naming what is missing.
 *    A guessed RPC name would fail as an opaque error code on every sync.
 *
 * The effect is a connector that is honest about its own state: what is known
 * works and is tested, and what is unknown announces itself instead of failing
 * silently somewhere inside a marketplace's error catalogue.
 */

/**
 * Operation names. `null` means "not confirmed" — the connector refuses the
 * operation rather than calling a made-up method. Filling one in is a one-line
 * change once the ISV documentation is at hand.
 */
const METHODS: Record<'orders' | 'products' | 'stock' | 'categories', string | null> = {
  // Seen in Temu's published documentation index.
  orders: 'bg.order.list.v2.get',
  // DOĞRULANAMADI — no confirmed method name.
  products: null,
  stock: null,
  categories: null,
};

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export class TemuConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('TEMU', credentials, httpClient, rateLimiter, settings);
  }

  protected get displayName(): string {
    return 'Temu';
  }

  /**
   * The gateway host doubles as the region discriminator — a US and an EU
   * integration hit different hosts — so throttling by it keeps one region's
   * traffic from stalling another's.
   */
  protected get rateLimitKey(): string {
    const host = String(this.credentials.apiUrl ?? '').trim();
    return host ? `TEMU:${host}` : 'TEMU';
  }

  /** Normalised gateway origin, without a trailing slash or a path. */
  private get gateway(): string {
    const { apiUrl } = this.requireCredentials('apiUrl');

    let parsed: URL;
    try {
      parsed = new URL(apiUrl.includes('://') ? apiUrl : `https://${apiUrl}`);
    } catch {
      throw new Error(
        `Temu API adresi geçerli bir URL değil: '${apiUrl}'. ` +
          'Adresi Temu partner hesabınızdaki API bilgilerinden kopyalayın.',
      );
    }

    return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  }

  /**
   * Temu answers with HTTP 200 even for business failures, carrying the outcome
   * in the body. Treating that as success is how a sync silently imports
   * nothing, so the envelope is unwrapped and checked here.
   */
  private async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const { appKey, appSecret, accessToken } = this.requireCredentials(
      'appKey',
      'appSecret',
      'accessToken',
    );

    const payload = buildTemuPayload({ method, appKey, appSecret, accessToken, params });

    const response = await this.send<TemuEnvelope<T>>(this.gateway, {
      method: 'POST',
      body: payload,
    });

    if (response?.success === false) {
      throw new Error(
        `Temu isteği reddedildi (${method}): ${response.errorMsg ?? 'bilinmeyen hata'}` +
          (response.errorCode !== undefined ? ` [kod ${response.errorCode}]` : ''),
      );
    }

    return (response?.result ?? response) as T;
  }

  /**
   * Raised for an operation whose RPC name was never confirmed. Naming the
   * exact constant to fill in means whoever has the documentation can act on
   * the message without reading this file first.
   */
  private unconfirmed(operation: keyof typeof METHODS): never {
    throw new Error(
      `Temu '${operation}' işlemi için API metot adı doğrulanmadı. ` +
        `Temu ISV dokümanındaki metot adını TemuConnector içindeki METHODS.${operation} ` +
        'sabitine yazın; connector bu bilgi olmadan tahmini bir çağrı yapmaz.',
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiUrl', 'appKey', 'appSecret', 'accessToken');

      // The orders method is the only confirmed one, so it doubles as the
      // cheapest proof that the host, the signature and the token all line up.
      const result = await this.call<TemuOrderListResult>(METHODS.orders!, {
        page_number: 1,
        page_size: 1,
      });

      const total = Number(result?.totalCount);
      return Number.isFinite(total)
        ? `Temu bağlantısı doğrulandı. Hesapta ${total} sipariş görüldü.`
        : 'Temu bağlantısı doğrulandı.';
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const since = Math.floor((Date.now() - Math.max(0, backfillDays) * 86_400_000) / 1000);

    const collected: MarketplaceOrder[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await this.call<TemuOrderListResult>(METHODS.orders!, {
        page_number: page,
        page_size: PAGE_SIZE,
        create_after: since,
      });

      const orders: TemuOrder[] = result?.pageItems ?? [];
      collected.push(...orders.map((order) => TemuMapper.toUnifiedOrder(order, this.fallbackCurrency)));

      if (orders.length < PAGE_SIZE) break;
    }

    const wanted = this.setting<string[]>('orders.importStatuses', []);
    if (wanted.length === 0) return collected;

    const wantedSet = new Set(wanted.map((s) => s.toLowerCase()));
    return collected.filter((order) => wantedSet.has(order.status.toLowerCase()));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    if (!METHODS.products) this.unconfirmed('products');
    return [];
  }

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    if (!METHODS.stock) {
      // Reported rather than thrown: the sync walks SKUs and one unsupported
      // operation must not abort the whole run.
      return {
        sku,
        quantity,
        success: false,
        error:
          "Temu stok güncelleme metodu doğrulanmadı; TemuConnector içindeki METHODS.stock " +
          'sabitini doldurmadan stok gönderilmez.',
      };
    }
    return { sku, quantity, success: false, error: 'unreachable' };
  }

  async getCategories(): Promise<any[]> {
    if (!METHODS.categories) this.unconfirmed('categories');
    return [];
  }

  async getCategoryAttributes(_categoryId: string): Promise<any> {
    if (!METHODS.categories) this.unconfirmed('categories');
    return {};
  }

  /**
   * DOĞRULANAMADI: which currency each Temu region settles in. The payload
   * states it where it can; nothing is substituted, because a guessed currency
   * silently mislabels money.
   */
  private get fallbackCurrency(): string {
    return '';
  }
}
