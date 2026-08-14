import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { buildAliExpressPayload } from './AliExpressSignature';

/**
 * AliExpress Open Platform.
 *
 * VERIFIED: the gateway (`https://api-sg.aliexpress.com/sync` — the host is how
 * you tell the current API from the legacy `gw.api.taobao.com/router/rest`), the
 * system parameter envelope, that operations are named RPC-style rather than
 * addressed by path, and one operation name: `aliexpress.solution.order.info.get`,
 * which fetches a *single* order's detail.
 *
 * NOT VERIFIED, and therefore not invented:
 *
 *  - **How the secret enters the signature.** Two schemes are documented across
 *    the Alibaba families and public sources disagree about this gateway. Both
 *    are implemented in AliExpressSignature; ACTIVE_VARIANT selects one and is a
 *    single-line change.
 *  - **The order *list* method.** Only the single-order detail call is
 *    confirmed, and a connector that can fetch one order it has no way to
 *    discover is not a sync. `getOrders` refuses rather than guessing a name.
 *  - Product, stock and category method names.
 *  - The timestamp format this gateway wants.
 *
 * The result is a connector honest about its own state: the transport is built
 * and tested, and each unknown announces itself instead of failing inside a
 * marketplace error catalogue.
 */

const GATEWAY = 'https://api-sg.aliexpress.com/sync';

/**
 * `null` means the operation name was never confirmed. Filling one in is a
 * one-line change once the ISV documentation is at hand.
 */
const METHODS = {
  /** Confirmed: single order detail. Not a listing call. */
  orderDetail: 'aliexpress.solution.order.info.get' as string | null,
  orderList: null as string | null,
  products: null as string | null,
  stock: null as string | null,
  categories: null as string | null,
};

export class AliExpressConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 60;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('ALIEXPRESS', credentials, httpClient, rateLimiter, settings);
  }

  protected get displayName(): string {
    return 'AliExpress';
  }

  /** One gateway, one quota; the app key is the unit AliExpress meters. */
  protected get rateLimitKey(): string {
    return `ALIEXPRESS:${String(this.credentials.appKey ?? '')}`;
  }

  /**
   * AliExpress answers HTTP 200 for business failures, carrying the outcome in
   * the body — an `error_response` object. Treating that as success is how a
   * sync silently imports nothing.
   */
  private async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const { appKey, appSecret, accessToken } = this.requireCredentials(
      'appKey',
      'appSecret',
      'accessToken',
    );

    const payload = buildAliExpressPayload({
      method,
      appKey,
      appSecret,
      session: accessToken,
      params,
    });

    const response = await this.send<any>(GATEWAY, { method: 'POST', body: payload });

    const failure = response?.error_response;
    if (failure) {
      throw new Error(
        `AliExpress isteği reddedildi (${method}): ${failure.msg ?? failure.sub_msg ?? 'bilinmeyen hata'}` +
          (failure.code !== undefined ? ` [kod ${failure.code}]` : ''),
      );
    }

    return response as T;
  }

  /**
   * Raised for an operation whose RPC name was never confirmed. Naming the
   * exact constant means whoever holds the documentation can act on the message
   * without reading this file first.
   */
  private unconfirmed(operation: keyof typeof METHODS): never {
    throw new Error(
      `AliExpress '${operation}' işlemi için API metot adı doğrulanmadı. ` +
        `Metot adını AliExpressConnector içindeki METHODS.${operation} sabitine yazın; ` +
        'connector bu bilgi olmadan tahmini bir çağrı yapmaz.',
    );
  }

  /**
   * Reaches the gateway with a signed request and reports what came back.
   *
   * This deliberately does not claim success on a business error: with the
   * signature variant unconfirmed, an authentication failure here is the
   * expected first signal and the message has to carry it through rather than
   * hide it.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('appKey', 'appSecret', 'accessToken');

      if (!METHODS.orderDetail) this.unconfirmed('orderDetail');

      // The only confirmed operation. Called without an order id purely to see
      // whether the gateway accepts the signature: a parameter complaint means
      // the credentials and signing worked, which is what is being tested.
      await this.call<unknown>(METHODS.orderDetail);

      return 'AliExpress ağ geçidi imzalı isteği kabul etti.';
    });
  }

  /**
   * Refuses: only the single-order detail method is confirmed, and fetching one
   * order the connector has no way to discover is not a sync.
   */
  async getOrders(): Promise<MarketplaceOrder[]> {
    if (!METHODS.orderList) this.unconfirmed('orderList');
    return [];
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
          'AliExpress stok güncelleme metodu doğrulanmadı; AliExpressConnector içindeki ' +
          'METHODS.stock sabitini doldurmadan stok gönderilmez.',
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
}
