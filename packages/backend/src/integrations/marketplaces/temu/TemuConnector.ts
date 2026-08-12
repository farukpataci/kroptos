import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { buildTemuPayload } from './TemuSignature';
import { TemuEnvelope } from './TemuTypes';

/**
 * Temu Open Platform.
 *
 * WHAT IS VERIFIED: the transport. Every call is a POST carrying one common
 * envelope (`type`, `app_key`, `access_token`, `timestamp`, `data_type`, `sign`)
 * whose signature is an MD5 over the sorted parameters wrapped in the app
 * secret. Operations are named RPC-style rather than addressed by path.
 *
 * WHAT IS NOT VERIFIED, and is therefore not invented here:
 *
 *  - **The gateway host.** Temu's documentation sits behind an ISV login and
 *    the host could not be confirmed from any public source. It is a required
 *    credential (`apiUrl`) the seller copies from their own partner account
 *    instead of a value guessed in this file. A wrong host fails every call.
 *
 *  - **Every operation name.** Not one has been confirmed, so every operation
 *    refuses with a message naming the constant to fill in. A guessed RPC name
 *    would come back as an opaque error code on every sync, which is far harder
 *    to diagnose than an explicit refusal.
 *
 * So this class currently makes no outbound request at all. The transport is
 * built and covered by tests through `call`, ready for the day a name is
 * confirmed; nothing about it is speculative.
 */

/**
 * Every entry is `null`: not one Temu operation name has been verified.
 *
 * An orders name (`bg.order.list.v2.get`) sat here for a while, taken from a
 * documentation page *title* in a search index — its parameters and response
 * were never seen. Four further names arrived later from exactly the same kind
 * of source and were deliberately kept out of this file. Holding one to a
 * weaker standard than the others is how a guess acquires the appearance of a
 * fact, so it was removed too.
 *
 * The candidates are recorded in docs/plans/temu-integration.md. Confirming one
 * against the ISV documentation and writing it here is a one-line change.
 */
const METHODS: Record<'orders' | 'products' | 'stock' | 'categories', string | null> = {
  orders: null,
  products: null,
  stock: null,
  categories: null,
};

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
  protected async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
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

  /**
   * Checks everything that can be checked without contacting Temu: that the
   * credentials are present and that the gateway is a usable URL. Separated so
   * `testConnection` can tell "your details are malformed" apart from "there is
   * nothing we are able to call".
   */
  private assertConfigured(): void {
    this.requireCredentials('apiUrl', 'appKey', 'appSecret', 'accessToken');
    // Getter; throws when the pasted address is not a URL.
    void this.gateway;
  }

  /**
   * Cannot reach Temu: every request is addressed by an RPC name in `type`, and
   * none is confirmed. Rather than sending a guessed method and reporting the
   * marketplace's rejection as a connection problem, this says plainly what is
   * missing — and only after confirming the credentials themselves are sound,
   * so the seller is not sent looking for a mistake they did not make.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.assertConfigured();

      throw new Error(
        'Temu kimlik bilgileri ve API adresi biçimsel olarak geçerli, ancak bağlantı ' +
          'test edilemedi: doğrulanmış hiçbir Temu API metot adı yok. ' +
          'Metot adlarını TemuConnector içindeki METHODS sabitine yazın ' +
          '(adaylar: docs/plans/temu-integration.md).',
      );
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    if (!METHODS.orders) this.unconfirmed('orders');
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
}
