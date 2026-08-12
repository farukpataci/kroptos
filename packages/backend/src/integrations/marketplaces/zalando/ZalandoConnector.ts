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
  ZalandoOrder,
  ZalandoOrderPage,
  ZalandoTokenResponse,
} from './ZalandoTypes';

/**
 * Zalando zDirect (the partner platform, formerly the Merchant Platform).
 *
 * WHAT IS VERIFIED, from Zalando's own published Authentication OpenAPI spec:
 *  - hosts: api.merchants.zalando.com and api-sandbox.merchants.zalando.com
 *  - `POST /auth/token`, form encoded, Basic auth over client id and secret,
 *    `grant_type=client_credentials`, response carries access_token/expires_in
 *  - `GET /auth/me`, which reports the caller's identity and granted scopes
 *
 * That is enough for a connection test that genuinely proves the credentials,
 * which is why `testConnection` deliberately uses `/auth/me` rather than a
 * business endpoint: the seller gets a truthful answer even where the rest is
 * still unconfirmed.
 *
 * WHAT IS NOT VERIFIED: the business paths. Zalando serves only the
 * authentication spec publicly; the orders, stock and price specs answer 403.
 * The orders path below is derived from the operation id Zalando publishes
 * (`get-merchants-by-id-orders`) together with their RESTful guidelines, and is
 * marked accordingly. Stock and price are left unset and refuse loudly.
 *
 * ⚠️ TWO DIFFERENT ZALANDO MODELS EXIST. This connector targets the zDirect
 * partner programme. Zalando Connected Retail is a separate product with a
 * different, file-based protocol (PUT of a stock file to a connector-importer
 * host with an `x-api-key` header). They are not interchangeable — see
 * docs/plans/zalando-integration.md before extending this class.
 */

const HOSTS: Record<string, string> = {
  production: 'https://api.merchants.zalando.com',
  sandbox: 'https://api-sandbox.merchants.zalando.com',
};

const PATHS = {
  /** Verified against the published Authentication OpenAPI spec. */
  token: () => '/auth/token',
  identity: () => '/auth/me',
  /**
   * DOĞRULANAMADI. Derived from the published operation id
   * `get-merchants-by-id-orders` plus Zalando's RESTful guidelines. Correct it
   * here if the ISV documentation says otherwise — it is the only place it
   * appears.
   */
  orders: (merchantId: string) => `/merchants/${merchantId}/orders`,
};

/** No confirmed path; calling these refuses instead of guessing. */
const UNCONFIRMED_PATHS = {
  products: null as string | null,
  stock: null as string | null,
  categories: null as string | null,
};

/** Refresh a minute early so a token cannot expire mid-request. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export class ZalandoConnector extends MarketplaceConnector {
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
    return { Authorization: `Bearer ${await this.bearer()}` };
  }

  private call<T>(
    path: string,
    options: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown } = {},
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
   * Uses the identity endpoint rather than a business call: it is the one path
   * confirmed from Zalando's published spec, so a pass here really does mean
   * the credentials, the environment and the scopes line up.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('clientId', 'clientSecret');

      const identity = await this.call<ZalandoIdentity>(PATHS.identity());

      const where = this.environment === 'sandbox' ? 'sandbox' : 'production';
      const scopes = identity?.scopes ?? (identity?.scope ? identity.scope.split(' ') : []);
      const merchant = identity?.merchant_id ?? identity?.merchantId;

      return [
        `Zalando bağlantısı doğrulandı (${where}).`,
        merchant ? `Satıcı: ${merchant}.` : null,
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

    const collected: MarketplaceOrder[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<ZalandoOrderPage>(PATHS.orders(merchantId), {
        query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE, created_after: since },
      });

      const orders: ZalandoOrder[] = result?.items ?? result?.content ?? [];
      collected.push(...orders.map((order) => ZalandoMapper.toUnifiedOrder(order, this.fallbackCurrency)));

      if (orders.length < PAGE_SIZE) break;
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

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    if (!UNCONFIRMED_PATHS.stock) {
      // Reported rather than thrown: the sync walks SKUs and one unsupported
      // operation must not abort the whole run.
      return {
        sku,
        quantity,
        success: false,
        error:
          'Zalando stok güncelleme yolu doğrulanmadı. UNCONFIRMED_PATHS.stock doldurulmadan ' +
          'stok gönderilmez. Ayrıca zDirect ile Connected Retail stok protokolleri farklıdır.',
      };
    }
    return { sku, quantity, success: false, error: 'unreachable' };
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
