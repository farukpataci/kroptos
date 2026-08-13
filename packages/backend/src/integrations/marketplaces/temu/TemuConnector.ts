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
import { TemuEnvelope, TemuOrder, TemuSku } from './TemuTypes';
import { TemuMapper } from './TemuMapper';

/**
 * Temu Open Platform.
 *
 * Every call is a POST to one router endpoint carrying a common envelope
 * (`type`, `app_key`, `access_token`, `timestamp`, `data_type`, `sign`) whose
 * signature is an MD5 over the sorted parameters wrapped in the app secret.
 * Operations are named RPC-style in `type` rather than addressed by path.
 *
 * EVIDENCE TIERS — read before trusting anything here.
 *
 *  TIER 1, corroborated by two independent unofficial SDKs that implement the
 *  protocol (a Python and a TypeScript one), agreeing with each other and with
 *  this file's pre-existing transport:
 *    - the signing algorithm and the envelope field names,
 *    - the request path `/openapi/router`,
 *    - the operation names in METHODS below, each with its full request
 *      parameter list.
 *
 *  TIER 2, still unverified — nobody has run one live call:
 *    - every RESPONSE field name (see TemuTypes), including which key holds the
 *      page of results,
 *    - the minor-unit (cents) assumption on amounts (TemuMapper),
 *    - the numeric order status codes,
 *    - whether this account is a `local` seller at all (see below),
 *    - the gateway host for regions other than the US.
 *
 * Because response shapes are Tier 2, the list readers below REFUSE rather than
 * return an empty page when they cannot find the array they expect. A sync that
 * silently imports nothing looks like "the seller has no orders" and can go
 * unnoticed for weeks; a loud failure naming the keys actually received cannot.
 *
 * SELLER MODEL WARNING: three of the four names are `bg.local.*`, which belongs
 * to Temu's local-to-local seller model (the seller holds and ships their own
 * stock). A fully-managed account may not have these operations at all, in
 * which case Temu answers with its own error and it surfaces verbatim. Confirm
 * the account's model before reading a failure here as a bug in this file.
 */

/**
 * Operation names, Tier 1 (see above).
 *
 * These sat at `null` for a while, and deliberately so: they had come from
 * documentation page *titles* in a search index, with their parameters and
 * responses never seen. That objection no longer holds — each name below now
 * comes with the full request parameter list from working SDK source, and two
 * independent implementations agree. The names are the verified part; the
 * response shapes are not (Tier 2).
 *
 * `getCategoryAttributes` has no entry: `bg.local.goods.property.get` exists in
 * the same method tree but its parameters were not established, so it is not
 * written here on a weaker standard than its neighbours.
 */
const METHODS = {
  /** Params: page_number, page_size, parent_order_status, create_after, create_before, … */
  orders: 'bg.order.list.v2.get',
  /** Params: page_no, page_size, sku_search_type, search_text, sku_id_list, … */
  products: 'bg.local.goods.sku.list.query',
  /** Params: goods_id (required), sku_stock_change_list | sku_stock_target_list, request_unique_key */
  stock: 'bg.local.goods.stock.edit',
  /** Params: parent_cat_id (0 = root), language */
  categories: 'bg.local.goods.cats.get',
} as const;

/**
 * Note the pagination fields differ per family and are NOT interchangeable:
 * orders page with `page_number`, goods with `page_no`. Both take `page_size`.
 * Sending the wrong one silently returns page 1 forever.
 */
const ORDER_PAGE_PARAM = 'page_number';
const GOODS_PAGE_PARAM = 'page_no';

/** DOĞRULANAMADI: the maximum Temu accepts. Conservative until measured. */
const PAGE_SIZE = 50;

/** Stops a mis-read response shape from paging forever. */
const MAX_PAGES = 20;

/** Every Temu operation is POSTed to this path on the seller's gateway host. */
const TEMU_ROUTER_PATH = '/openapi/router';

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

  /**
   * Normalised gateway URL.
   *
   * The host is the seller's (it varies by region and is not guessed in this
   * file), but the path is not: every Temu call goes to `/openapi/router` on
   * that host. A seller who pastes the bare host used to have their requests
   * POSTed to `/`, which answers with an HTML error page rather than the
   * envelope — so the router path is appended when the pasted value carries no
   * path of its own. A pasted path is left alone.
   */
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

    const path = parsed.pathname === '/' ? TEMU_ROUTER_PATH : parsed.pathname.replace(/\/$/, '');
    return `${parsed.protocol}//${parsed.host}${path}`;
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
   * Finds the page of rows inside a result whose exact shape is unverified.
   *
   * Returning `[]` on an unrecognised shape would report "no orders" for what is
   * really a parsing failure, so this throws and names the keys that actually
   * came back — that message is what turns a silent no-op into a five-minute
   * fix once someone sees a real payload.
   */
  private readPage<T>(result: unknown, operation: string): T[] {
    if (Array.isArray(result)) return result as T[];

    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>;
      // `pageItems` is what the shape in TemuTypes expects; the others are the
      // spellings used elsewhere in the same API family.
      for (const key of ['pageItems', 'pageItemList', 'list', 'dataList', 'subOrderList']) {
        if (Array.isArray(record[key])) return record[key] as T[];
      }

      throw new Error(
        `Temu '${operation}' yanıtında liste alanı bulunamadı. ` +
          `Gelen alanlar: ${Object.keys(record).join(', ') || '(boş)'}. ` +
          'Yanıt gövdesinin şekli doğrulanmadı; TemuTypes.ts içindeki alan adlarını ' +
          'gerçek yanıta göre düzeltin.',
      );
    }

    throw new Error(
      `Temu '${operation}' yanıtı beklenen nesne değil (${typeof result}).`,
    );
  }

  /** Walks pages until a short page arrives, with a hard cap. */
  private async paginate<T>(
    method: string,
    pageParam: string,
    operation: string,
    extraParams: Record<string, unknown> = {},
  ): Promise<T[]> {
    const collected: T[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await this.call<unknown>(method, {
        ...extraParams,
        [pageParam]: page,
        page_size: PAGE_SIZE,
      });

      const rows = this.readPage<T>(result, operation);
      collected.push(...rows);

      if (rows.length < PAGE_SIZE) break;
    }

    return collected;
  }

  /**
   * Checks the credentials and the gateway shape first, then makes the cheapest
   * real call there is — one order page of size 1. Anything wrong with the
   * secret, the host or the seller model surfaces here as Temu's own message
   * rather than as a silent success.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('apiUrl', 'appKey', 'appSecret', 'accessToken');
      const gateway = this.gateway;

      await this.call<unknown>(METHODS.orders, { [ORDER_PAGE_PARAM]: 1, page_size: 1 });

      return `Temu bağlantısı doğrulandı (${gateway}).`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const orders = await this.paginate<TemuOrder>(METHODS.orders, ORDER_PAGE_PARAM, 'siparişler');
    const fallbackCurrency = this.setting<string>('orders.currency', 'USD');

    return orders.map((order) => TemuMapper.toUnifiedOrder(order, fallbackCurrency));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    const skus = await this.paginate<TemuSku>(METHODS.products, GOODS_PAGE_PARAM, 'ürünler');

    return skus.map((sku) => TemuMapper.toUnifiedProduct(sku));
  }

  /**
   * Refused on purpose, and this one is not a missing method name.
   *
   * `bg.local.goods.stock.edit` is confirmed, and so are its top-level
   * parameters — `goods_id` plus one of `sku_stock_change_list` (delta) or
   * `sku_stock_target_list` (absolute). What is NOT established is the shape of
   * the elements inside those lists, and there is no safe way to guess it: a
   * list Temu cannot parse the way we intended is how a whole catalogue gets
   * written to zero stock. Overselling is recoverable; a silent stock-out
   * across every listing is not.
   *
   * Two things are needed before this can send, both from one real payload:
   *   1. the element keys (sku id field and quantity field) of either list, and
   *   2. the `goods_id` for a SKU — Temu keys stock by goods, not by the
   *      seller's SKU code, so a lookup through METHODS.products has to resolve
   *      it first, which in turn needs that response shape confirmed.
   *
   * Reported rather than thrown: a sync walks SKUs and one unsupported
   * operation must not abort the whole run.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    return {
      sku,
      quantity,
      success: false,
      error:
        `Temu stok güncellemesi gönderilmedi: '${METHODS.stock}' metodu doğrulandı, ancak ` +
        'sku_stock_change_list / sku_stock_target_list öğelerinin alan adları ve SKU→goods_id ' +
        'eşlemesi doğrulanmadı. Yanlış biçimli bir liste tüm katalogun stoğunu sıfırlayabilir, ' +
        'bu yüzden tahminle gönderilmiyor (ayrıntı: docs/plans/temu-integration.md).',
    };
  }

  async getCategories(): Promise<any[]> {
    // parent_cat_id 0 is the root of the tree; deeper levels are fetched by
    // passing a category's own id.
    const result = await this.call<unknown>(METHODS.categories, { parent_cat_id: 0 });

    return this.readPage<any>(result, 'kategoriler');
  }

  /**
   * No verified method. `bg.local.goods.property.get` sits in the same tree but
   * its parameters were not established, and writing it here would hold it to a
   * weaker standard than every other name in METHODS.
   */
  async getCategoryAttributes(_categoryId: string): Promise<any> {
    throw new Error(
      'Temu kategori özellikleri için doğrulanmış bir API metodu yok. ' +
        'Aday: bg.local.goods.property.get — parametreleri ISV dokümanından teyit edilip ' +
        'TemuConnector içindeki METHODS sabitine eklenmeli.',
    );
  }
}
