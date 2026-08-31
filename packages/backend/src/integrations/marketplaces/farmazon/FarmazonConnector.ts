import { MarketplaceConnector } from '../core/MarketplaceConnector';
import {
  ConnectionTestResult,
  MarketplaceOrder,
  MarketplaceProduct,
  StockUpdateResult,
} from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { FarmazonMapper } from './FarmazonMapper';
import { FarmazonListing, FarmazonOrder, FarmazonOrderItem } from './FarmazonTypes';

/**
 * Farmazon — eczaneler arası pazaryeri.
 *
 * DOĞRULANAMADI: host'lar, yollar ve alan adları Farmazon'un resmi API
 * dokümanından (yardim.farmazon.com.tr) alındı; gerçek bir satıcı hesabında
 * hiç çalıştırılmadı. Bu yüzden `defaultMode = 'simulation'` — worker
 * simülasyon modunda hiçbir satırı kiracı tablolarına yazmaz.
 *
 * Staging hafta içi 08:00-20:00 arası açık; dışında bağlantı testi başarısız
 * olur ve bu bir yapılandırma hatası değildir.
 */
const HOSTS = {
  production: 'https://lab.farmazon.com.tr',
  sandbox: 'https://staging.lab.farmazon.com.tr',
};

const PATHS = {
  signin: '/api/v1/account/signin',
  soldOrders: '/api/v1/orders/getsoldorders',
  listings: '/api/v2/listings/getlistings',
  updateStock: '/api/v2/listings/UpdateListingsStockOnly',
};

/**
 * Farmazon'un bit değerli sipariş durumları, `orders.importStatuses` ve
 * `orders.statusMap`'in konuştuğu sözlüğe çevrilmiş hali. İki tablo da bu
 * kelimelerle yazıldığı için eşleşme Kroptos durumları üzerinden değil buradan
 * yapılır — aksi halde varsayılan seçim ('created','picking','shipped') hiçbir
 * siparişle eşleşmez ve senkron sessizce boş döner.
 */
const ORDER_STATE_WORD: Record<number, string> = {
  1: 'created', // satıcı onayı bekliyor
  2: 'picking', // kargoya verilmeyi bekliyor
  4: 'shipped', // yolda
  32: 'delivered', // tamamlandı
  64: 'cancelled',
  512: 'created', // alıcı onayı bekliyor
  1024: 'created', // ön sipariş
};

/** Aynı tablonun tersi: dokümandaki `orderState` sorgu parametresi; 0 = hepsi. */
const ORDER_STATE_FILTER: Record<string, number> = {
  created: 1,
  picking: 2,
  shipped: 4,
  delivered: 32,
  cancelled: 64,
};

const PAGE_SIZE = 50;
const MAX_PAGES = 50;

/** Doküman: token ~1 hafta geçerli. Bir gün erken yenilenir. */
const TOKEN_TTL_MS = 6 * 24 * 60 * 60 * 1000;

interface FarmazonEnvelope<T> {
  statusCode?: number;
  statusMessage?: string;
  result?: T;
  errors?: unknown;
}

interface FarmazonPage<T> {
  page?: number;
  pageSize?: number;
  totalPageCount?: number;
  items?: T[];
}

export class FarmazonConnector extends MarketplaceConnector {
  /** Doküman: dakikada en fazla 10 istek. */
  protected readonly defaultRateLimit = 10;

  protected readonly defaultMode = 'simulation' as const;

  protected get displayName(): string {
    return 'Farmazon';
  }

  /**
   * 10/dk kotası satıcı hesabı başına işliyor; kova kullanıcı adıyla
   * anahtarlanmazsa bir ajansın senkronu diğerlerini de bekletir.
   */
  protected get rateLimitKey(): string {
    return `FARMAZON:${this.credentials.username ?? ''}`;
  }

  private accessToken?: { value: string; expiresAt: number };

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('FARMAZON', credentials, httpClient, rateLimiter, settings);
  }

  private get baseUrl(): string {
    return this.environment === 'sandbox' ? HOSTS.sandbox : HOSTS.production;
  }

  /**
   * Doküman her isteğe bunu şart koşuyor — signin dahil. Eksikse Farmazon
   * isteği kimlik hatasıyla değil, tanımsız bir hatayla reddediyor.
   */
  private get userAgent(): string {
    return `API_${String(this.credentials.username ?? '').trim()}`;
  }

  // --------------------------------------------------------------------------
  // Oturum
  // --------------------------------------------------------------------------

  /**
   * `send()` üzerinden gitmez: gövde form-encoded, henüz kurulacak bearer'ı
   * taşımaz ve dönen zarf token'ın kendisidir.
   */
  private async signIn(): Promise<string> {
    const { username, password, clientName, clientSecretKey } = this.requireCredentials(
      'username',
      'password',
      'clientName',
      'clientSecretKey',
    );

    await this.throttle();

    const body = new URLSearchParams({ username, password, clientName, clientSecretKey });

    let response: FarmazonEnvelope<any> | string;
    try {
      response = await this.httpClient.request<FarmazonEnvelope<any>>(
        `${this.baseUrl}${PATHS.signin}`,
        {
          method: 'POST',
          headers: {
            'User-Agent': this.userAgent,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: body.toString(),
        },
      );
    } catch (error: any) {
      throw new Error(`Farmazon oturumu açılamadı. ${this.describeError(error).message}`);
    }

    // Doküman "JSON Web Token" diyor ama alanın adını vermiyor: zarf içinde de,
    // düz gövdede de gelebilir.
    const token =
      typeof response === 'string'
        ? response
        : response?.result?.token ?? response?.result?.accessToken ?? response?.result;

    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('Farmazon oturumu açılamadı: yanıt bir token içermiyor.');
    }

    this.accessToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return token;
  }

  protected async authHeaders(): Promise<Record<string, string>> {
    const cached = this.accessToken;
    const token = cached && cached.expiresAt > Date.now() ? cached.value : await this.signIn();
    return { Authorization: `Bearer ${token}`, 'User-Agent': this.userAgent };
  }

  /**
   * Farmazon HTTP 200 dönüp reddi zarfın `statusCode` alanında bildiriyor;
   * kontrol her çağrı yerinde değil burada.
   */
  private async call<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T | undefined> {
    const envelope = await this.send<FarmazonEnvelope<T>>(`${this.baseUrl}${path}`, options);

    const status = Number(envelope?.statusCode);
    // 207 = MULTI STATUS: satır bazlı sonuç, çağıranın işi.
    if (Number.isFinite(status) && status >= 400) {
      const detail = envelope?.statusMessage?.trim() || JSON.stringify(envelope?.errors ?? {});
      throw new Error(`Farmazon isteği reddetti (${status}): ${detail}`);
    }

    return envelope?.result;
  }

  /** `getsoldorders` düz dizi, `getlistings` ise `{ items, totalPageCount }` döner. */
  private async fetchAllPages<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined>,
  ): Promise<T[]> {
    const collected: T[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await this.call<T[] | FarmazonPage<T>>(path, {
        query: { ...query, page, count: PAGE_SIZE },
      });

      const rows = Array.isArray(result) ? result : result?.items ?? [];
      collected.push(...rows);

      const totalPages = Array.isArray(result) ? undefined : Number(result?.totalPageCount);
      if (rows.length < PAGE_SIZE) return collected;
      if (Number.isFinite(totalPages) && page >= (totalPages as number)) return collected;
    }

    // Sessizce dönmek, yarım kalmış bir senkronu tam senkron gibi gösterirdi.
    throw new Error(
      `Farmazon ${path} için sayfa sınırına ulaşıldı (${MAX_PAGES}×${PAGE_SIZE}). ` +
        'Senkron eksik kalacağı için durduruldu.',
    );
  }

  // --------------------------------------------------------------------------
  // Connector yüzeyi
  // --------------------------------------------------------------------------

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      // signin kimlik bilgilerini doğrular; ardından okuma yetkisi de sınanır,
      // çünkü token alınıp listing okunamayan hesap durumu mümkün.
      await this.signIn();
      await this.call<FarmazonPage<unknown> | unknown[]>(PATHS.listings, {
        query: { page: 1, count: 1, listingState: 1 },
      });

      return `Farmazon bağlantısı doğrulandı (${this.environment}). Listing okuması yanıt verdi.`;
    });
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    const backfillDays = Math.max(0, Number(this.setting<number>('orders.backfillDays', 7)));
    const day = (offsetMs: number) => new Date(Date.now() - offsetMs).toISOString().slice(0, 10);

    const wanted = this.setting<string[]>('orders.importStatuses', []);
    // Farmazon tek bir durum değeri alıyor; birden fazla seçiliyse hepsi
    // çekilip aşağıda süzülür (0 = hepsi).
    const singleState = wanted.length === 1 ? ORDER_STATE_FILTER[wanted[0]] : undefined;
    const wantedSet = new Set(wanted);

    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.soldOrders, {
      orderState: singleState ?? 0,
      startDate: day(backfillDays * 24 * 60 * 60 * 1000),
      endDate: day(0),
    });

    return raw
      .map((row) => this.observeUnmapped('orders', row, (watched) => this.toFarmazonOrder(watched)))
      .filter((order) => {
        const word = ORDER_STATE_WORD[order.orderStateId];
        return wantedSet.size === 0 || (word !== undefined && wantedSet.has(word));
      })
      .map((order) => {
        const unified = FarmazonMapper.toUnifiedOrder(order);
        // statusMap satıcı tarafında bu kelimelerle tutuluyor; ham bit değeri
        // verilirse hiçbir satır eşleşmez ve ayar sessizce yok sayılır.
        unified.status = this.mapOrderStatus(
          ORDER_STATE_WORD[order.orderStateId] ?? '',
          unified.status,
        );
        unified.orderNumber = this.prefixOrderNumber(unified.orderNumber);
        return { ...unified, ...this.modeStamp };
      });
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    const raw = await this.fetchAllPages<Record<string, any>>(PATHS.listings, { listingState: 1 });

    return raw.map((row) => ({
      ...FarmazonMapper.toUnifiedProduct(
        this.observeUnmapped('listings', row, (watched) => this.toFarmazonListing(watched)),
      ),
      ...this.modeStamp,
    }));
  }

  /**
   * Farmazon stoku listing kimliğiyle günceller, barkodla değil — o yüzden
   * önce listing'i bulmak gerekiyor. Ürün tarafında anahtar barkod olduğundan
   * arama barkod, yoksa SKU üzerinden yapılır.
   */
  async updateStock(
    sku: string,
    quantity: number,
    identifiers?: { barcode?: string | null },
  ): Promise<StockUpdateResult> {
    try {
      const key = String(identifiers?.barcode || sku).trim();
      const listingId = await this.findListingId(key);

      const result = await this.call<Array<{ success?: boolean; errors?: unknown[] }>>(
        PATHS.updateStock,
        { method: 'PUT', body: [{ id: listingId, stock: quantity, isActive: true }] },
      );

      // 207 zarfı satır bazlı cevap verir: tek satır gönderdik, tek satır okunur.
      const row = Array.isArray(result) ? result[0] : undefined;
      if (row && row.success === false) {
        const detail = (row.errors ?? []).map((e: any) => e?.message ?? String(e)).join(' ');
        return {
          sku,
          quantity,
          success: false,
          error: detail || 'Farmazon stok satırını reddetti',
          ...this.modeStamp,
        };
      }

      return { sku, quantity, success: true, ...this.modeStamp };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error?.message || 'Farmazon stok güncellemesi başarısız',
        ...this.modeStamp,
      };
    }
  }

  private async findListingId(key: string): Promise<string> {
    const listings = await this.fetchAllPages<Record<string, any>>(PATHS.listings, {
      listingState: 1,
    });
    const match = listings
      .map((row) => this.toFarmazonListing(row))
      .find((listing) => listing.barcode === key);

    if (!match?.id) {
      throw new Error(`Farmazon'da '${key}' barkoduna ait aktif bir listing bulunamadı.`);
    }
    return match.id;
  }

  /** Doküman kategori/nitelik uç noktası yayımlamıyor. */
  async getCategories(): Promise<any[]> {
    return this.notImplemented('getCategories');
  }

  async getCategoryAttributes(_categoryId: string): Promise<any> {
    return this.notImplemented('getCategoryAttributes');
  }

  // --------------------------------------------------------------------------
  // Yanıt normalleştirme
  // --------------------------------------------------------------------------

  private toFarmazonOrder(raw: Record<string, any>): FarmazonOrder {
    const items: FarmazonOrderItem[] = (raw.orderDetails ?? raw.items ?? []).map(
      (item: Record<string, any>) => ({
        barcode: String(item.barcode ?? item.productBarcode ?? item.sku ?? ''),
        productName: item.productName ?? item.name ?? '',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price ?? item.unitPrice ?? 0),
      }),
    );

    const address = raw.shipmentAddress ?? raw.deliveryAddress ?? raw.address ?? {};
    const flat = typeof address === 'string';

    return {
      orderId: String(raw.orderId ?? raw.id ?? ''),
      orderDate: raw.orderDate,
      orderStateId: Number(raw.orderStateId ?? raw.orderState) || 0,
      orderPrice: Number(raw.orderPrice ?? raw.totalPrice ?? 0),
      buyerId: raw.buyerId === undefined || raw.buyerId === null ? undefined : String(raw.buyerId),
      buyerName: raw.buyerName ?? raw.buyerTitle,
      buyerPhone: raw.buyerPhone ?? raw.phone,
      address: flat ? address : address.address ?? address.fullAddress,
      district: flat ? raw.district : address.district ?? raw.district,
      city: flat ? raw.city : address.city ?? raw.city,
      postalCode: flat ? raw.postalCode : address.postalCode ?? raw.postalCode,
      shipmentCompany: raw.shipmentCompany,
      shipmentFollowUpNo:
        raw.shipmentFollowUpNo === undefined || raw.shipmentFollowUpNo === null
          ? undefined
          : String(raw.shipmentFollowUpNo),
      items,
    };
  }

  private toFarmazonListing(raw: Record<string, any>): FarmazonListing {
    const product = raw.product ?? {};
    return {
      id: String(raw.id ?? ''),
      barcode: String(product.barcode ?? raw.barcode ?? ''),
      name: product.name ?? raw.name ?? '',
      price: Number(raw.price ?? 0),
      stock: Number(raw.stock) || 0,
      state: raw.state === undefined ? undefined : Number(raw.state),
      image: product.imageUrl ?? product.image ?? raw.imageUrl,
    };
  }
}
