import { randomUUID } from 'node:crypto';
import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { ZalandoMapper } from './ZalandoMapper';
import {
  ZalandoIdentity,
  ZalandoOrdersDocument,
  ZalandoStockUpdatesRequest,
  ZalandoStockUpdatesResponse,
  ZalandoTokenResponse,
} from './ZalandoTypes';

/**
 * Zalando zDirect (the partner platform, formerly the Merchant Platform).
 *
 * ⚠️ TWO DIFFERENT ZALANDO MODELS EXIST. This connector targets the zDirect
 * partner programme. Zalando Connected Retail is a separate product with a
 * different, file-based protocol (PUT of a stock file to a connector-importer
 * host with an `x-api-key` header). They are not interchangeable — see
 * docs/plans/zalando-integration.md before extending this class.
 *
 * PROVENANCE of what is implemented here — the detail is in ZalandoTypes.ts:
 *
 *  - Authentication is first-party verified. Zalando serves its Authentication
 *    OpenAPI spec publicly and it was fetched directly: the hosts, the form
 *    encoded `POST /auth/token` under Basic auth, and `GET /auth/me` reporting
 *    `bpids` / `groups` / `scopes`.
 *
 *  - Orders and stocks come from the zDirect OpenAPI documents for those APIs,
 *    obtained from a public mirror rather than from Zalando, whose own host
 *    answers 403 for every spec but authentication. Strongly corroborated,
 *    not first-party proof, and NOT yet exercised against a live account.
 *
 *  - Products, categories and attributes have no spec at all and still refuse.
 *
 * The registry deliberately does not list this provider yet, so none of this is
 * reachable from the catalogue until a real account confirms it.
 */

const HOSTS: Record<string, string> = {
  production: 'https://api.merchants.zalando.com',
  sandbox: 'https://api-sandbox.merchants.zalando.com',
};

const PATHS = {
  /** Verified against the published Authentication OpenAPI spec. */
  token: () => '/auth/token',
  identity: () => '/auth/me',
  /** From the mirrored Orders spec; matches the operation id Zalando publishes. */
  orders: (merchantId: string) => `/merchants/${merchantId}/orders`,
  /** From the mirrored Stocks spec. */
  stocks: (merchantId: string) => `/merchants/${merchantId}/stocks`,
};

/** Still no spec of any kind; calling these refuses instead of guessing. */
const UNCONFIRMED_PATHS = {
  products: null as string | null,
  categories: null as string | null,
};

/** The Orders API is JSON:API, so it neither sends nor accepts plain JSON. */
const JSON_API = 'application/vnd.api+json';

/**
 * Prices, order items and order lines are separate resources. Without pulling
 * them in, an order comes back with no line detail and no money on it at all.
 */
const ORDER_INCLUDES = 'order_items,order_lines';

/** Refresh a minute early so a token cannot expire mid-request. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

/**
 * The spec states a default page size of 50 and never states a maximum, so the
 * documented default is used rather than a guessed ceiling. Costs requests, but
 * a rejected page size would cost the whole sync.
 */
const PAGE_SIZE = 50;
const MAX_PAGES = 200;

/** Zalando keys stock and prices on GTIN-13, never on a merchant SKU. */
const GTIN_13 = /^[0-9]{13}$/;

export class ZalandoConnector extends MarketplaceConnector {
  /** DOĞRULANAMADI: Zalando publishes no quota figure. */
  protected readonly defaultRateLimit = 60;

  private accessToken?: { value: string; expiresAt: number };

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('ZALANDO', credentials, httpClient, rateLimiter, settings);
  }

  protected get displayName(): string {
    return 'Zalando';
  }

  /**
   * Sandbox and production are separate tenants with separate quotas, and a
   * merchant is the unit Zalando rate limits, so both go into the key.
   */
  protected get rateLimitKey(): string {
    return `ZALANDO:${this.environment}:${String(this.credentials.merchantId ?? '')}`;
  }

  private get host(): string {
    return HOSTS[this.environment] ?? HOSTS.production;
  }

  // --------------------------------------------------------------------------
  // OAuth2 client credentials
  // --------------------------------------------------------------------------

  /**
   * Not routed through `send()`: the token call is form encoded, authenticates
   * with Basic rather than the bearer, and must not carry the token it is
   * about to produce.
   */
  private async fetchAccessToken(): Promise<string> {
    const { clientId, clientSecret } = this.requireCredentials('clientId', 'clientSecret');

    const body = new URLSearchParams({ grant_type: 'client_credentials' });

    let response: ZalandoTokenResponse;
    try {
      response = await this.httpClient.request<ZalandoTokenResponse>(
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
        'Zalando oturum anahtarı alınamadı. Client ID veya Client Secret hatalı olabilir, ' +
          'ya da uygulama hâlâ sandbox modunda olabilir. ' +
          `${error?.message ?? ''}`.trim(),
      );
    }

    if (!response?.access_token) {
      throw new Error('Zalando oturum anahtarı alınamadı: yanıt access_token içermiyor.');
    }

    // The spec states expires_in in seconds but does not fix a value, so the
    // response is trusted and only defaulted when it is missing entirely.
    const lifetimeMs = (Number(response.expires_in) || 3600) * 1000;
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
      // Zalando's documented troubleshooting handle. Sending one per request
      // means a failure can be quoted back to their support verbatim.
      'X-Flow-Id': randomUUID(),
    };
  }

  private call<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    return this.send<T>(`${this.host}${path}`, options);
  }

  private unconfirmed(operation: keyof typeof UNCONFIRMED_PATHS): never {
    throw new Error(
      `Zalando '${operation}' işlemi için API yolu doğrulanmadı. ` +
        `Yolu ZalandoConnector içindeki UNCONFIRMED_PATHS.${operation} sabitine yazın; ` +
        'connector bu bilgi olmadan tahmini bir çağrı yapmaz. ' +
        'Ayrıca hangi Zalando modelinde olduğunuzu teyit edin (zDirect / Connected Retail).',
    );
  }

  // --------------------------------------------------------------------------
  // Contract
  // --------------------------------------------------------------------------

  /**
   * Uses the identity endpoint rather than a business call: it is the path
   * verified first-hand from Zalando's published spec, so a pass here really
   * does mean the credentials, the environment and the scopes line up.
   *
   * It also cross-checks the configured merchant id against the `bpids` the
   * token actually carries. A merchant id that is merely mistyped otherwise
   * surfaces much later as a 403 or 404 on the first sync, which reads like a
   * permissions problem rather than a typo.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('clientId', 'clientSecret');

      const identity = await this.call<ZalandoIdentity>(PATHS.identity());

      const where = this.environment === 'sandbox' ? 'sandbox' : 'production';
      const scopes = identity?.scopes ?? [];
      const bpids = identity?.bpids ?? [];
      const configured = String(this.credentials.merchantId ?? '').trim();

      if (configured && bpids.length > 0 && !bpids.includes(configured)) {
        throw new Error(
          `Zalando kimlik doğrulaması başarılı, ancak girilen Satıcı ID (${configured}) ` +
            `bu uygulamanın yetkili olduğu satıcılar arasında değil. ` +
            `Yetkili satıcı kimlikleri: ${bpids.join(', ')}.`,
        );
      }

      return [
        `Zalando bağlantısı doğrulandı (${where}).`,
        bpids.length > 0 ? `Satıcı: ${bpids.join(', ')}.` : null,
        scopes.length > 0 ? `${scopes.length} yetki tanımlı.` : null,
      ]
        .filter(Boolean)
        .join(' ');
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const { merchantId } = this.requireCredentials('merchantId');

    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const since = new Date(Date.now() - Math.max(0, backfillDays) * 86_400_000).toISOString();
    const salesChannelId = String(this.credentials.salesChannelId ?? '').trim();

    const collected: MarketplaceOrder[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const document = await this.call<ZalandoOrdersDocument>(PATHS.orders(merchantId), {
        headers: { Accept: JSON_API },
        query: {
          // JSON:API bracket parameters, not the limit/offset pair a REST API
          // would use. URLSearchParams percent-encodes the brackets, which is
          // what the spec's own examples show.
          'page[number]': page,
          'page[size]': PAGE_SIZE,
          include: ORDER_INCLUDES,
          created_after: since,
          sales_channel_id: salesChannelId || undefined,
        },
      });

      const returned = document?.data?.length ?? 0;
      collected.push(...ZalandoMapper.toUnifiedOrders(document, this.fallbackCurrency));

      if (returned < PAGE_SIZE) break;
    }

    const wanted = this.setting<string[]>('orders.importStatuses', []);
    if (wanted.length === 0) return collected;

    const wantedSet = new Set(wanted.map((s) => s.toLowerCase()));
    return collected.filter((order) => wantedSet.has(order.status.toLowerCase()));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    if (!UNCONFIRMED_PATHS.products) this.unconfirmed('products');
    return [];
  }

  /**
   * Zalando identifies stock by **EAN plus sales channel**, never by a merchant
   * SKU — so this cannot simply forward what the sync worker passes in.
   *
   * Failures are reported rather than thrown: the sync walks SKUs one at a
   * time, and a single unmappable article must not abort the whole run.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    const merchantId = String(this.credentials.merchantId ?? '').trim();
    const salesChannelId = String(this.credentials.salesChannelId ?? '').trim();

    if (!merchantId || !salesChannelId) {
      return {
        sku,
        quantity,
        success: false,
        error:
          'Zalando stok gönderimi için Satıcı ID ve Satış Kanalı ID gereklidir. ' +
          'Entegrasyon kimlik bilgilerinde eksik olan alanı doldurun.',
      };
    }

    if (!GTIN_13.test(sku)) {
      return {
        sku,
        quantity,
        success: false,
        error:
          `Zalando stoğu EAN (GTIN-13) ile eşler, SKU ile değil; '${sku}' 13 haneli bir EAN değil. ` +
          'Ürünün barkod alanına GTIN-13 girin veya ürün eşleştirmesinde EAN tanımlayın.',
      };
    }

    const body: ZalandoStockUpdatesRequest = {
      items: [{ sales_channel_id: salesChannelId, ean: sku, quantity }],
    };

    try {
      const response = await this.call<ZalandoStockUpdatesResponse>(PATHS.stocks(merchantId), {
        method: 'POST',
        body,
      });

      // A 207 means the call succeeded and each item carries its own verdict,
      // so the outcome has to be read out of the body. An empty results array
      // is treated as a failure: nothing confirmed the update.
      const result = response?.results?.[0]?.result;
      const status = String(result?.status ?? '').toUpperCase();

      if (status === 'ACCEPTED') {
        return { sku, quantity, success: true };
      }

      return {
        sku,
        quantity,
        success: false,
        error:
          result?.description ||
          `Zalando stok güncellemesini kabul etmedi (durum: ${status || 'bilinmiyor'}` +
            `${result?.code !== undefined ? `, kod: ${result.code}` : ''}).`,
      };
    } catch (error: any) {
      return { sku, quantity, success: false, error: error?.message ?? 'Zalando stok isteği başarısız' };
    }
  }

  async getCategories(): Promise<any[]> {
    if (!UNCONFIRMED_PATHS.categories) this.unconfirmed('categories');
    return [];
  }

  async getCategoryAttributes(_categoryId: string): Promise<any> {
    if (!UNCONFIRMED_PATHS.categories) this.unconfirmed('categories');
    return {};
  }

  /**
   * DOĞRULANAMADI: which currency each Zalando sales channel settles in. The
   * payload states it where it can; nothing is substituted, because a guessed
   * currency silently mislabels money.
   */
  private get fallbackCurrency(): string {
    return '';
  }
}
