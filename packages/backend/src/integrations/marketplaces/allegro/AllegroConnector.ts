import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
// TEMPORARY (live-verification round): remove with IntegrationTrace.
import { trace } from '../core/IntegrationTrace';
import { AllegroMapper } from './AllegroMapper';
import {
  AllegroCheckoutFormsPage,
  AllegroOffer,
  AllegroOffersPage,
  AllegroTokenResponse,
} from './AllegroTypes';

/**
 * Allegro (Poland).
 *
 * Better documented than the other recent additions: hosts, the token endpoint,
 * the media type and the order and offer paths are all confirmed from Allegro's
 * own developer portal.
 *
 * Two things shape this class:
 *
 *  1. **Seller data needs a user token.** `client_credentials` only reaches
 *     public data such as the category tree; orders and offers require a token
 *     obtained through the authorization-code or device flow. So the seller
 *     pastes a refresh token, exactly as for eBay and Etsy — this connector
 *     never performs the consent flow itself.
 *
 *  2. **The refresh token rotates on every refresh.** Allegro returns a new
 *     access token *and* a new refresh token each time, the old one staying
 *     valid for only about 60 more seconds. The access token lives 12 hours and
 *     the refresh token 3 months, so without persisting the rotation the
 *     integration would break for good within three months. This is the first
 *     provider here where rotation is confirmed rather than defensive — the
 *     rotated value is reported so the caller can store it.
 */

/** Auth and API live on different hosts, and both differ per environment. */
const AUTH_HOSTS: Record<string, string> = {
  production: 'https://allegro.pl',
  sandbox: 'https://allegro.pl.allegrosandbox.pl',
};

const API_HOSTS: Record<string, string> = {
  production: 'https://api.allegro.pl',
  sandbox: 'https://api.allegro.pl.allegrosandbox.pl',
};

const PATHS = {
  token: () => '/auth/oauth/token',
  /** Allegro models an order as a "checkout form". */
  checkoutForms: () => '/order/checkout-forms',
  offers: () => '/sale/offers',
  productOffer: (offerId: string) => `/sale/product-offers/${offerId}`,
  /**
   * DOĞRULANAMADI: the category paths are derived from Allegro's documented
   * resource naming rather than read from a spec. A wrong path here fails
   * visibly in the category-mapping screen rather than silently during a sync.
   */
  categories: () => '/sale/categories',
  categoryParameters: (categoryId: string) => `/sale/categories/${categoryId}/parameters`,
};

/** Allegro's versioned media type; requests without it are rejected. */
const MEDIA_TYPE = 'application/vnd.allegro.public.v1+json';

/** Refresh a minute early so a token cannot expire mid-request. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export class AllegroConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  private accessToken?: { value: string; expiresAt: number };
  /** Latest refresh token for this instance; starts as the pasted one. */
  private currentRefreshToken?: string;
  /** sku -> offer id, built on demand; see updateStock. */
  private offerIndex?: Map<string, string>;
  /** TEMPORARY (live-verification round): how many refreshes this instance did. */
  private refreshCount = 0;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('ALLEGRO', credentials, httpClient, rateLimiter, settings);
  }

  protected get displayName(): string {
    return 'Allegro';
  }

  /** Sandbox and production are separate tenants with separate quotas. */
  protected get rateLimitKey(): string {
    return `ALLEGRO:${this.environment}`;
  }

  private get authHost(): string {
    return AUTH_HOSTS[this.environment] ?? AUTH_HOSTS.production;
  }

  private get apiHost(): string {
    return API_HOSTS[this.environment] ?? API_HOSTS.production;
  }

  // --------------------------------------------------------------------------
  // OAuth2 refresh grant
  // --------------------------------------------------------------------------

  /**
   * Not routed through `send()`: the token call is form encoded, lives on the
   * auth host rather than the API host, authenticates with Basic, and must not
   * carry the bearer it is about to produce.
   */
  private async fetchAccessToken(): Promise<string> {
    const { clientId, clientSecret, refreshToken } = this.requireCredentials(
      'clientId',
      'clientSecret',
      'refreshToken',
    );

    const inUse = this.currentRefreshToken ?? refreshToken;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: inUse,
    });

    let response: AllegroTokenResponse;
    try {
      response = await this.httpClient.request<AllegroTokenResponse>(
        `${this.authHost}${PATHS.token()}`,
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
        'Allegro oturum anahtarı yenilenemedi. Refresh token 3 ay geçerlidir ve süresi ' +
          'dolmuş olabilir; Allegro hesabınızdan yeni bir token alıp ayarlara yapıştırın. ' +
          `${error?.message ?? ''}`.trim(),
      );
    }

    if (!response?.access_token) {
      throw new Error('Allegro oturum anahtarı alınamadı: yanıt access_token içermiyor.');
    }

    // TEMPORARY (live-verification round): the two facts that decide whether the
    // rotation machinery is exercised at all.
    trace('ALLEGRO token refreshed', {
      refreshCount: ++this.refreshCount,
      expires_in: response.expires_in,
      returnedNewRefreshToken: Boolean(
        response.refresh_token && response.refresh_token !== inUse,
      ),
    });

    // Allegro rotates the refresh token on every exchange and the previous one
    // stops working within about a minute. Reporting it is what keeps the
    // integration alive past the next process restart.
    if (response.refresh_token && response.refresh_token !== inUse) {
      this.currentRefreshToken = response.refresh_token;
      this.recordRotatedCredentials({ refreshToken: response.refresh_token });
    }

    const lifetimeMs = (Number(response.expires_in) || 43_200) * 1000;
    this.accessToken = {
      value: response.access_token,
      expiresAt: Date.now() + lifetimeMs - TOKEN_SAFETY_MARGIN_MS,
    };

    return response.access_token;
  }

  private async bearer(): Promise<string> {
    // TEMPORARY (live-verification round): the access token lives 12 hours, so
    // waiting for a natural refresh is not practical. With
    // ALLEGRO_FORCE_REFRESH=1 the cached token is treated as already expired,
    // which exercises the refresh and the rotation path on every call.
    if (process.env.ALLEGRO_FORCE_REFRESH === '1') {
      trace('ALLEGRO forcing token refresh (ALLEGRO_FORCE_REFRESH=1)');
      return this.fetchAccessToken();
    }

    if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
      return this.accessToken.value;
    }
    return this.fetchAccessToken();
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.bearer()}`,
      // Allegro rejects a request that does not name the API version it expects.
      Accept: MEDIA_TYPE,
    };
  }

  private call<T>(
    path: string,
    options: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    return this.send<T>(`${this.apiHost}${path}`, {
      ...options,
      // Writes must declare the same versioned media type on the way in.
      headers: options.body !== undefined ? { 'Content-Type': MEDIA_TYPE } : undefined,
    });
  }

  // --------------------------------------------------------------------------
  // Contract
  // --------------------------------------------------------------------------

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('clientId', 'clientSecret', 'refreshToken');

      // Cheapest authenticated read that also proves the token carries seller
      // context: checkout forms are not reachable with an application token.
      const result = await this.call<AllegroCheckoutFormsPage>(PATHS.checkoutForms(), {
        query: { limit: 1 },
      });

      const total = Number(result?.totalCount);
      const where = this.environment === 'sandbox' ? 'sandbox' : 'production';
      return Number.isFinite(total)
        ? `Allegro bağlantısı doğrulandı (${where}). Hesapta ${total} sipariş görüldü.`
        : `Allegro bağlantısı doğrulandı (${where}).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const backfillDays = Number(this.setting<number>('orders.backfillDays', 7));
    const since = new Date(Date.now() - Math.max(0, backfillDays) * 86_400_000).toISOString();

    const collected: MarketplaceOrder[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<AllegroCheckoutFormsPage>(PATHS.checkoutForms(), {
        query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE, 'updatedAt.gte': since },
      });

      const forms = result?.checkoutForms ?? [];
      collected.push(...forms.map((form) => AllegroMapper.toUnifiedOrder(form, this.fallbackCurrency)));

      if (forms.length < PAGE_SIZE) break;
    }

    const wanted = this.setting<string[]>('orders.importStatuses', []);
    if (wanted.length === 0) return collected;

    const wantedSet = new Set(wanted.map((s) => s.toLowerCase()));
    return collected.filter((order) => wantedSet.has(order.status.toLowerCase()));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    return (await this.fetchOffers()).map((offer) => AllegroMapper.toUnifiedProduct(offer));
  }

  private async fetchOffers(): Promise<AllegroOffer[]> {
    const collected: AllegroOffer[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.call<AllegroOffersPage>(PATHS.offers(), {
        query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      });

      const offers = result?.offers ?? [];
      collected.push(...offers);

      if (offers.length < PAGE_SIZE) break;
    }

    return collected;
  }

  /**
   * Allegro addresses stock by *offer id*, while the shared contract passes a
   * SKU. The seller's SKU is the offer's `external.id`, so the mapping is built
   * once per connector instance and reused — resolving it per SKU would spend a
   * full offer listing on every row of a sync.
   */
  private async resolveOfferId(sku: string): Promise<string | undefined> {
    if (!this.offerIndex) {
      const offers = await this.fetchOffers();
      this.offerIndex = new Map(
        offers
          .filter((offer) => offer.external?.id && offer.id)
          .map((offer) => [offer.external!.id!, offer.id!]),
      );
    }
    return this.offerIndex.get(sku);
  }

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      const offerId = await this.resolveOfferId(sku);
      if (!offerId) {
        return {
          sku,
          quantity,
          success: false,
          error:
            `Allegro'da '${sku}' koduna karşılık gelen ilan bulunamadı. ` +
            'İlanın dış kimliği (external id) bu SKU ile eşleşmiyor olabilir.',
        };
      }

      await this.call<unknown>(PATHS.productOffer(offerId), {
        method: 'PATCH',
        body: { stock: { available: quantity } },
      });

      return { sku, quantity, success: true };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'Allegro stok güncellemesi başarısız',
      };
    }
  }

  async getCategories(): Promise<any[]> {
    const result = await this.call<{ categories?: any[] }>(PATHS.categories());
    return result?.categories ?? [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return this.call<any>(PATHS.categoryParameters(categoryId));
  }

  /**
   * Allegro states the currency on every amount it sends, so nothing needs to
   * be assumed. Left empty rather than defaulting to PLN: a guessed currency
   * silently mislabels money on the international sites.
   */
  private get fallbackCurrency(): string {
    return '';
  }
}
