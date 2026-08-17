import { Logger } from '@nestjs/common';
import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import {
  EMAG_COUNTRY_CONTEXT,
  EmagCountry,
  EmagMapper,
  EmagMapperContext,
  EmagUnresolvedSkuError,
  parseEmagDateParts,
} from './EmagMapper';
import {
  RawEmagApiResponse,
  RawEmagCategory,
  RawEmagOrder,
  RawEmagProduct,
  RawEmagStock,
} from './EmagTypes';

/**
 * eMAG Marketplace API v4.4.4.
 *
 * One provider serving four markets (RO/BG/HU/PL). The market is fixed at
 * construction by the `country` credential — never a method parameter, because
 * every call this connector makes belongs to exactly one market and threading
 * it through the signatures would invite a call that forgets it.
 *
 * `country` sits in `credentials` rather than in a settings section for the same
 * reason it does on `trendyol_global`: settings are saved *after* the
 * integration exists, but the base URL, the throttling bucket and the currency
 * are all needed on the very first call — the connection test.
 *
 * TRANSPORT: every operation is `POST {base}/{resource}/{action}` with HTTP
 * Basic auth. eMAG answers HTTP 200 for business failures and puts the outcome
 * in the envelope (`isError`, `messages[]`, `results[]`), so the status code
 * alone is never trusted — see `unwrap`.
 *
 * DOĞRULANAMADI: no call in this file has been exercised against a real eMAG
 * seller account. Documentation used is v4.4.4; the three places where v4.5.1
 * could change the design carry the `emag-v4.5.1` TODO marker and are meant to
 * be revised in one pass when that document arrives.
 */

/** Per-market API host. The path prefix `/api-3` is the same everywhere. */
const BASE_URLS: Record<EmagCountry, string> = {
  RO: 'https://marketplace-api.emag.ro/api-3',
  BG: 'https://marketplace-api.emag.bg/api-3',
  HU: 'https://marketplace-api.emag.hu/api-3',
  PL: 'https://marketplace-api.emag.pl/api-3',
};

/** Every eMAG resource/action pair in one place, so a version bump lands here. */
const PATHS = {
  productOfferRead: { resource: 'product_offer', action: 'read' },
  productOfferSave: { resource: 'product_offer', action: 'save' },
  orderRead: { resource: 'order', action: 'read' },
  categoryRead: { resource: 'category', action: 'read' },
  vatRead: { resource: 'vat', action: 'read' },
} as const;

/** eMAG caps a page at 100 rows; asking for more is rejected, not trimmed. */
const PAGE_SIZE = 100;

/** Stops a response that never shortens from turning one sync into a loop. */
const MAX_PAGES = 50;

/**
 * eMAG's stock field is an unsigned 16-bit integer. A larger number is an
 * *invalid* request, and invalid requests count against the hourly 180 penalty
 * window — so the value is clamped rather than sent and rejected.
 */
const MAX_STOCK_VALUE = 65535;

/**
 * Minimum spacing between two `product_offer/save` calls, per market.
 *
 * The quota that matters here is not requests-per-minute (that one is handled
 * by the shared `MarketplaceRateLimiter`) but eMAG's documented minimum
 * interval between two offer writes.
 */
export const EMAG_MIN_OFFER_SAVE_INTERVAL_MS = 3000;

/**
 * Last `product_offer/save` timestamp per throttling bucket.
 *
 * MODULE scope, deliberately: `MarketplaceConnectorFactory.create()` returns a
 * NEW connector on every call (the worker builds one per job, the service one
 * per request), so an instance field would be reset before it ever fired and
 * the interval would never be honoured.
 *
 * NOT: bellek içi damga tek pod varsayar; çok pod'lu dağıtımda yetersiz —
 * gerçek koruma için paylaşımlı bir kilit gerekir, o ayrı iş olarak açıldı.
 */
const lastOfferSaveAt = new Map<string, number>();

/** Test-only: the module-level stamp outlives a single test by design. */
export function resetEmagOfferSaveThrottle(): void {
  lastOfferSaveAt.clear();
}

/**
 * Overlap on the incremental window. An order created in the same second the
 * previous cursor was taken would otherwise fall between two syncs.
 */
const ORDER_WINDOW_OVERLAP_MINUTES = 5;

function isEmagCountry(value: string): value is EmagCountry {
  return Object.prototype.hasOwnProperty.call(EMAG_COUNTRY_CONTEXT, value);
}

/**
 * A transport failure that still knows the upstream status.
 *
 * `MarketplaceConnector.describeError` returns a plain `Error`, which loses the
 * status — and `testConnection` has to tell 401 (credentials *or* IP whitelist)
 * from 403 (authenticated, but not entitled to that one resource) to give the
 * seller the right instruction.
 */
export class EmagRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EmagRequestError';
  }
}

/** What `getOrders` carries across one sync; see `resolveWithLookup`. */
interface EmagOrderSyncState {
  lookup: Map<number, string>;
  /** Whether the full-catalogue read was already attempted this sync. */
  catalogAttempted: boolean;
}

export class EmagConnector extends MarketplaceConnector {
  private readonly logger = new Logger(EmagConnector.name);

  /** eMAG documents 20 requests/minute per resource. */
  protected readonly defaultRateLimit = 20;

  private readonly country: EmagCountry;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('EMAG', credentials, httpClient, rateLimiter, settings);

    const raw = String(credentials?.country ?? '').trim().toUpperCase();
    if (!raw) {
      throw new Error(
        'eMAG entegrasyonu için ülke seçilmedi. Entegrasyon ayarlarından pazarı (RO/BG/HU/PL) seçin.',
      );
    }
    // An unsupported code must fail here rather than reaching a host that does
    // not exist — or, worse, another market's catalogue.
    if (!isEmagCountry(raw)) {
      throw new Error(
        `eMAG için desteklenmeyen ülke kodu: '${raw}'. Desteklenen pazarlar: ` +
          `${Object.keys(EMAG_COUNTRY_CONTEXT).join(', ')}.`,
      );
    }

    this.country = raw;
  }

  protected get displayName(): string {
    return 'eMAG';
  }

  /**
   * Quota is per market account, so each market gets its own bucket. Sharing
   * one would let a busy market stall a quiet one.
   */
  protected get rateLimitKey(): string {
    return `emag:${this.country}`;
  }

  /** Currency and timezone for this market; the mapper takes them explicitly. */
  private get context(): EmagMapperContext {
    return EMAG_COUNTRY_CONTEXT[this.country];
  }

  private get baseUrl(): string {
    return BASE_URLS[this.country];
  }

  protected authHeaders(): Record<string, string> {
    const { username, password } = this.requireCredentials('username', 'password');
    return {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    };
  }

  // --------------------------------------------------------------- transport

  /**
   * One eMAG call, envelope already unwrapped.
   *
   * Returns `results[]`; every eMAG list answer is wrapped the same way, and a
   * caller that wants a single row takes the first element.
   */
  private async call<T>(
    path: { resource: string; action: string },
    body: unknown = {},
  ): Promise<T[]> {
    const response = await this.send<RawEmagApiResponse<T>>(
      `${this.baseUrl}/${path.resource}/${path.action}`,
      { method: 'POST', body },
    );

    return this.unwrap<T>(response, `${path.resource}/${path.action}`);
  }

  /**
   * The single place `isError` is read.
   *
   * eMAG answers HTTP 200 with `isError: true` for business failures — a
   * rejected offer, an unknown filter, a revoked permission. Treating the
   * status code as the verdict is how a sync silently imports nothing, so
   * anything that is not an explicit `isError: false` is a failure here.
   * `messages[]` is quoted verbatim; credentials never enter this string.
   */
  private unwrap<T>(response: RawEmagApiResponse<T> | undefined, operation: string): T[] {
    if (!response || typeof response !== 'object') {
      throw new EmagRequestError(
        `eMAG '${operation}' yanıtı beklenen zarf değil (${typeof response}).`,
      );
    }

    if (response.isError !== false) {
      throw new EmagRequestError(
        `eMAG '${operation}' isteği reddedildi: ${this.formatMessages(response.messages)}`,
      );
    }

    return Array.isArray(response.results) ? response.results : [];
  }

  /** `messages[]` is documented as strings; an object is stringified, not dropped. */
  private formatMessages(messages: unknown): string {
    if (!Array.isArray(messages) || messages.length === 0) return 'ayrıntı verilmedi';
    return messages
      .map((message) => (typeof message === 'string' ? message : JSON.stringify(message)))
      .filter((message) => message && message !== '""')
      .join('; ');
  }

  /**
   * eMAG-specific error text, and the status kept alongside it.
   *
   * 401 names BOTH possible causes on purpose: eMAG rejects a request from an
   * IP the seller never registered with exactly the same status as a wrong
   * password, and telling the seller only "credentials are wrong" sends them to
   * rotate a password that was never the problem.
   */
  protected describeError(error: any): Error {
    const status = error instanceof MarketplaceHttpError ? error.upstreamStatus : undefined;

    if (status === 401) {
      return new EmagRequestError(
        'eMAG kimlik doğrulaması reddedildi (401). İki olası neden var: ' +
          '(1) kullanıcı adı/parola hatalı, (2) sunucunuzun çıkış IP adresi eMAG tarafında ' +
          'beyaz listeye alınmamış. IP beyaz listesi bir kimlik bilgisi değil, dağıtım şartıdır — ' +
          'eMAG hesap yöneticinize sunucu IP adreslerinizi bildirin.',
        status,
      );
    }

    if (status === 403) {
      return new EmagRequestError(
        'eMAG isteği yetkilendirilmedi (403). Kimlik doğrulaması geçti, ancak hesabın bu kaynağa ' +
          'erişim izni yok. eMAG hesap yöneticinizden ilgili kaynak izinlerini isteyin.',
        status,
      );
    }

    if (status === undefined) {
      // No status means the request never got an answer: DNS, TLS, timeout.
      // Blaming credentials here would send the seller looking in the wrong place.
      return new EmagRequestError(
        `eMAG sunucusuna ulaşılamadı (ağ hatası veya zaman aşımı): ${error?.message ?? 'ayrıntı yok'}. ` +
          'Bu bir kimlik bilgisi sorunu değildir; ağ erişimini ve eMAG servis durumunu kontrol edin.',
      );
    }

    // Everything else keeps the shared wording (404 / 429 / 5xx) and gains the status.
    return new EmagRequestError(super.describeError(error).message, status);
  }

  /** Walks a paged eMAG collection to the end, honouring the page cap. */
  private async fetchAllPages<T>(
    path: { resource: string; action: string },
    filters: Record<string, unknown> = {},
  ): Promise<T[]> {
    const collected: T[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const rows = await this.call<T>(path, {
        ...filters,
        currentPage: page,
        itemsPerPage: PAGE_SIZE,
      });

      collected.push(...rows);

      if (rows.length < PAGE_SIZE) return collected;

      if (page === MAX_PAGES) {
        this.logger.warn(
          `eMAG '${path.resource}/${path.action}' ${MAX_PAGES} sayfa sınırına ulaştı ` +
            `(${collected.length} kayıt). Kalan sayfalar okunmadı.`,
        );
      }
    }

    return collected;
  }

  // ---------------------------------------------------------- testConnection

  /**
   * `vat/read` is the cheapest authenticated read there is: small, static, no
   * write, and harmless against the quota.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.requireCredentials('username', 'password');

      try {
        await this.call<unknown>(PATHS.vatRead);
        return `eMAG bağlantısı doğrulandı (${this.country} pazarı).`;
      } catch (error: any) {
        // 403 is NOT a failed connection: the credentials were accepted and
        // only this one resource is off limits. eMAG grants permissions per
        // resource, so a second, differently-permissioned read decides it.
        if (error?.status !== 403) throw error;

        try {
          await this.call<unknown>(PATHS.categoryRead, { currentPage: 1, itemsPerPage: 1 });
          return (
            `eMAG bağlantısı doğrulandı (${this.country} pazarı). ` +
            'Not: vat/read kaynağına erişim izni yok (403), doğrulama category/read ile yapıldı.'
          );
        } catch (fallbackError: any) {
          throw new EmagRequestError(
            `eMAG bağlantısı doğrulanamadı. vat/read 403 döndü, category/read de başarısız oldu: ` +
              `${fallbackError?.message ?? 'ayrıntı yok'}`,
            fallbackError?.status,
          );
        }
      }
    });
  }

  // ----------------------------------------------------------------- catalog

  async getProducts(): Promise<MarketplaceProduct[]> {
    const offers = await this.fetchAllPages<RawEmagProduct>(PATHS.productOfferRead);

    return offers.map((offer) => EmagMapper.toUnifiedProduct(offer));
  }

  // ------------------------------------------------------------------ orders

  /**
   * Incremental read.
   *
   * TODO(emag): pencere backfillDays'ten kuruluyor; runtime.lastSyncAt
   * enjeksiyonu sync-flow-builder adımında gelince gerçek imlece geçilecek.
   * Not: backfillDays penceresiyle her senkron aynı aralığı yeniden çeker.
   * Upsert idempotent olduğu için veri bozulmaz, ama kota tüketir.
   */
  async getOrders(): Promise<MarketplaceOrder[]> {
    this.requireCredentials('username', 'password');

    const backfillDays = Math.max(0, Number(this.setting<number>('orders.backfillDays', 7)) || 0);
    const since = new Date(
      Date.now() -
        backfillDays * 24 * 60 * 60 * 1000 -
        ORDER_WINDOW_OVERLAP_MINUTES * 60 * 1000,
    );

    // TODO(emag-v4.5.1): order/read'in tam filtre listesi v4.4.4 dokümanında
    // doğrulanamadı. Yalnızca `createdAfter` gönderiliyor; `modifiedAfter` de
    // belgelenmiş ama ikisinin birlikte AND mi OR mu değerlendirildiği ve
    // hiç değiştirilmemiş bir siparişin `modified` alanının dolu olup olmadığı
    // bilinmiyor — modifiedAfter tek başına kullanılsaydı hiç dokunulmamış yeni
    // siparişler kaçabilirdi. status/id gibi başka bir filtre VARSAYILMIYOR.
    const orders = await this.fetchAllPages<RawEmagOrder>(PATHS.orderRead, {
      createdAfter: this.toEmagDate(since),
    });

    const state: EmagOrderSyncState = { lookup: new Map(), catalogAttempted: false };
    const mapped: MarketplaceOrder[] = [];
    const failed: number[] = [];

    for (const raw of orders) {
      // Per-order, not per-batch: `toUnifiedOrder` throws EmagUnresolvedSkuError
      // for a line whose SKU cannot be determined, and one unimportable order
      // must not take the whole sync down with it.
      try {
        const result = await this.mapOrder(raw, state);

        // The mapper is pure and cannot log; these are anomalies it recovered
        // from (a blank part_number resolved through product_id), so the order
        // imported fine and the warning still has to be visible.
        if (result.skuWarnings.length > 0) {
          this.logger.warn(
            `eMAG sipariş ${raw?.id} SKU uyarıları: ${result.skuWarnings.join(' | ')}`,
          );
        }

        mapped.push(result.order);
      } catch (error: any) {
        failed.push(raw?.id);
        this.logger.error(
          `eMAG sipariş ${raw?.id} içe aktarılamadı, atlanıyor: ${error?.message ?? error}`,
        );
      }
    }

    if (failed.length > 0) {
      this.logger.warn(
        `eMAG (${this.country}): ${orders.length} siparişten ${failed.length} tanesi ` +
          `içe aktarılamadı. Sipariş id'leri: ${failed.join(', ')}`,
      );
    }

    return mapped;
  }

  /**
   * Maps one order, resolving SKUs through the shared lookup when a line's
   * `part_number` came back blank.
   *
   * The prefix is applied HERE, on the mapper's output: `EmagMapper` writes the
   * bare `String(order.id)` and says so — prefixing is a settings concern, not a
   * mapping one. This is a deliberate mutation of the mapper's result, and the
   * default is an empty string: a single-market install needs no prefix, while
   * an operator running two eMAG markets sets `EMG-RO-` / `EMG-PL-` themselves
   * so the order numbers cannot collide.
   */
  private async mapOrder(raw: RawEmagOrder, state: EmagOrderSyncState) {
    let result: ReturnType<typeof EmagMapper.toUnifiedOrder>;

    try {
      result = EmagMapper.toUnifiedOrder(raw, this.context, state.lookup);
    } catch (error) {
      if (!(error instanceof EmagUnresolvedSkuError) || state.catalogAttempted) throw error;

      await this.loadProductOfferLookup(state);
      // One retry, with the lookup now populated. If it still cannot resolve,
      // the error escapes to the per-order handler and only this order fails.
      result = EmagMapper.toUnifiedOrder(raw, this.context, state.lookup);
    }

    const prefix = this.setting<string>('orders.numberPrefix', '');
    if (prefix) {
      result.order.orderNumber = `${prefix}${result.order.orderNumber}`;
    }

    return result;
  }

  /**
   * Fills `product_offer.id -> part_number` for this sync.
   *
   * TODO(emag-v4.5.1): B PLANI. `product_offer/read`'in `id` filtresini kabul
   * ettiği v4.4.4 dokümanında doğrulanamadı, bu yüzden hedefli (tembel, tek
   * ürünlük) okuma YAPILMIYOR. Onun yerine ilk EmagUnresolvedSkuError
   * tetiklendiğinde SENKRON BAŞINA TEK SEFER tam katalog okunuyor ve o senkron
   * boyunca kullanılıyor — her sipariş turunda asla. v4.5.1 `id` filtresini
   * doğrularsa burası hedefli tembel okumaya iner ve tam katalog maliyeti kalkar.
   *
   * Marked as attempted even when the read fails, so a broken catalogue call
   * cannot be retried once per order for the rest of the sync.
   */
  private async loadProductOfferLookup(state: EmagOrderSyncState): Promise<void> {
    state.catalogAttempted = true;

    this.logger.warn(
      `eMAG (${this.country}): bir sipariş satırında part_number boş geldi. ` +
        'product_offer eşlemesi için tam katalog bir kez okunuyor.',
    );

    const offers = await this.fetchAllPages<RawEmagProduct>(PATHS.productOfferRead);

    for (const offer of offers) {
      const partNumber = typeof offer?.part_number === 'string' ? offer.part_number.trim() : '';
      if (offer?.id !== undefined && partNumber) {
        state.lookup.set(Number(offer.id), partNumber);
      }
    }
  }

  /**
   * UTC instant -> the market's wall clock -> eMAG's `Y-m-d H:i:s`.
   *
   * The reverse of `parseEmagDateToUtc`. That function's own zone formatter is
   * private to EmagMapper, so the parts are read here — but the result is
   * validated with the mapper's exported `parseEmagDateParts`, which is the one
   * definition of the accepted shape. A string that fails that check is never
   * sent: an unparsable filter would silently widen the window to everything.
   */
  private toEmagDate(instant: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.context.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(instant);

    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    // Intl renders midnight as hour 24 in some ICU builds; eMAG expects 00.
    const hour = get('hour') === '24' ? '00' : get('hour');

    const formatted =
      `${get('year')}-${get('month')}-${get('day')} ` +
      `${hour}:${get('minute')}:${get('second')}`;

    if (!parseEmagDateParts(formatted)) {
      throw new EmagRequestError(
        `eMAG tarih filtresi 'Y-m-d H:i:s' biçiminde üretilemedi: '${formatted}'.`,
      );
    }

    return formatted;
  }

  // ------------------------------------------------------------------- stock

  /**
   * Never throws. The stock worker walks a list of SKUs and treats a rejected
   * result as one failed row; an exception here would abort the whole run.
   */
  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    try {
      // Single-element list on purpose: the whole flow lives in
      // `writeOfferStock`, which is list-shaped so that opening a bulk path
      // changes the caller and not the method.
      const [result] = await this.writeOfferStock([{ sku, quantity }]);
      return result ?? { sku, quantity, success: false, error: 'eMAG stok güncellemesi sonuç döndürmedi.' };
    } catch (error: any) {
      // Defence in depth: writeOfferStock already converts failures into
      // results, so reaching here means something unforeseen. Still not a throw.
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'eMAG stok güncellemesi başarısız',
      };
    }
  }

  /**
   * Reads each offer's own documentation back and returns it unchanged except
   * for the stock line.
   *
   * TODO(emag-v4.5.1): v4.4.4'te `offer_stock` / Light Offer API doğrulanamadı,
   * bu yüzden yol `product_offer/read` + `product_offer/save`. v4.5.1 Light
   * Offer API'yi doğrularsa bu metot tek PATCH çağrısına iner ve
   * product_offer/save kotası hiç harcanmaz.
   * MALİYET (mevcut yol): SKU başına 2 istek (read + save) + save'e 3 sn
   * min-interval + 20/dk kotası. 1000 SKU ≈ 50 dk. Gerçek mağaza ölçeğinde
   * kullanılamaz.
   *
   * Product documentation is deliberately NOT sent back: no `name`,
   * `description`, `images` or `characteristics`. Echoing content we did not
   * author is how a catalogue gets silently rewritten by a stock sync.
   */
  private async writeOfferStock(
    items: Array<{ sku: string; quantity: number }>,
  ): Promise<StockUpdateResult[]> {
    const results: StockUpdateResult[] = [];

    for (const item of items) {
      const sku = String(item.sku ?? '').trim();
      const requested = Number(item.quantity);

      if (!sku) {
        results.push({
          sku: item.sku,
          quantity: item.quantity,
          success: false,
          error: 'eMAG stok güncellemesi için SKU (part_number) boş olamaz.',
        });
        continue;
      }

      if (!Number.isFinite(requested)) {
        results.push({
          sku,
          quantity: item.quantity,
          success: false,
          error: `eMAG stok değeri sayı değil: '${item.quantity}'.`,
        });
        continue;
      }

      const quantity = this.clampStock(sku, requested);

      try {
        const offers = await this.call<RawEmagProduct>(PATHS.productOfferRead, {
          part_number: sku,
          currentPage: 1,
          itemsPerPage: PAGE_SIZE,
        });

        // The filter is verified locally too: if eMAG ignored `part_number`, the
        // first row of the catalogue would otherwise be written by mistake.
        const offer = offers.find(
          (candidate) => String(candidate?.part_number ?? '').trim() === sku,
        );

        if (!offer) {
          results.push({
            sku,
            quantity,
            success: false,
            error: `eMAG'de '${sku}' part_number değerine sahip teklif bulunamadı (${this.country} pazarı).`,
          });
          continue;
        }

        const stock: RawEmagStock[] = Array.isArray(offer.stock) ? offer.stock : [];

        if (stock.length === 0) {
          // The warehouse id is NOT guessed. Assuming 1 would write a real
          // number into a warehouse the seller may not even own.
          results.push({
            sku,
            quantity,
            success: false,
            error:
              `eMAG panelinde '${sku}' teklifi için depo (warehouse) tanımlı değil, ` +
              'stok yazılamaz. eMAG satıcı panelinden teklife bir depo tanımlayın.',
          });
          continue;
        }

        if (stock.length > 1) {
          this.logger.warn(
            `eMAG '${sku}' teklifi ${stock.length} depoya dağıtılmış. Tek sayı ilk depoya ` +
              `(warehouse_id=${stock[0]?.warehouse_id}) yazılıyor, diğerlerine dokunulmuyor — ` +
              'toplam stok panelde beklenenden farklı görünebilir.',
          );
        }

        // Only the first entry changes; the rest travel back exactly as read, so
        // a save cannot zero a warehouse this sync never meant to touch.
        const nextStock = stock.map((entry, index) =>
          index === 0 ? { ...entry, value: quantity } : entry,
        );

        await this.throttleOfferSave();

        // eMAG expects an array of entities on save (bulk limit 50). Sending one
        // element keeps the read/save pairing that the cost note above describes.
        await this.call<unknown>(PATHS.productOfferSave, [
          {
            id: offer.id,
            status: offer.status,
            sale_price: offer.sale_price,
            vat_id: offer.vat_id,
            handling_time: offer.handling_time,
            stock: nextStock,
          },
        ]);

        results.push({ sku, quantity, success: true });
      } catch (error: any) {
        results.push({
          sku,
          quantity,
          success: false,
          error: error?.message || 'eMAG stok güncellemesi başarısız',
        });
      }
    }

    return results;
  }

  /** Clamps to eMAG's unsigned 16-bit stock field and says so out loud. */
  private clampStock(sku: string, quantity: number): number {
    const whole = Math.trunc(quantity);

    if (whole > MAX_STOCK_VALUE) {
      this.logger.warn(
        `eMAG '${sku}' için istenen stok ${whole}, üst sınır ${MAX_STOCK_VALUE}. ` +
          'Değer kırpıldı — geçersiz istek göndermek saatlik ceza penceresini tüketir.',
      );
      return MAX_STOCK_VALUE;
    }

    if (whole < 0) {
      this.logger.warn(`eMAG '${sku}' için negatif stok (${whole}) 0 olarak gönderiliyor.`);
      return 0;
    }

    return whole;
  }

  /** Spaces two offer writes on the same market by the documented minimum. */
  private async throttleOfferSave(): Promise<void> {
    const key = this.rateLimitKey;
    const last = lastOfferSaveAt.get(key);

    if (last !== undefined) {
      const waitMs = last + EMAG_MIN_OFFER_SAVE_INTERVAL_MS - Date.now();
      if (waitMs > 0) await this.sleep(waitMs);
    }

    lastOfferSaveAt.set(key, Date.now());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // -------------------------------------------------------------- categories

  async getCategories(): Promise<any[]> {
    return this.fetchAllPages<RawEmagCategory>(PATHS.categoryRead);
  }

  /**
   * eMAG addresses a category by numeric id. A non-numeric value is a caller
   * mistake, and reading the whole tree instead would quietly return the wrong
   * category's characteristics.
   */
  async getCategoryAttributes(categoryId: string): Promise<any> {
    const id = Number(categoryId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `eMAG kategori kimliği pozitif bir tam sayı olmalı, gelen değer: '${categoryId}'.`,
      );
    }

    const [category] = await this.call<RawEmagCategory>(PATHS.categoryRead, {
      id,
      currentPage: 1,
      itemsPerPage: 1,
    });

    // Empty list rather than a throw: the mapping screen renders "no
    // attributes" and a NotImplemented would break it.
    return category?.characteristics ?? [];
  }
}
