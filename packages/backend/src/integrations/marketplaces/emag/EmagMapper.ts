import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { RawEmagCustomer, RawEmagOrder, RawEmagOrderProduct, RawEmagProduct } from './EmagTypes';

/**
 * eMAG is a single provider (`emag`) serving four markets through one
 * settings field (`country: RO | BG | HU | PL`). Currency and timezone are
 * not guessable from the payload — RON/BGN/HUF/PLN each belong to exactly
 * one of these countries — so the mapper takes them as an explicit context
 * rather than defaulting to one market the way `TrendyolMapperContext` can
 * default to Türkiye.
 */
export type EmagCountry = 'RO' | 'BG' | 'HU' | 'PL';

export interface EmagMapperContext {
  country: EmagCountry;
  /** Written to `MarketplaceOrder.currency`. Never left empty — an empty
   * currency here would silently fall back to TRY in the sync worker. */
  currency: string;
  /** IANA zone name. Consumed only by `parseEmagDateToUtc`, not by
   * `toUnifiedOrder` itself — see the note on that function. */
  timezone: string;
}

export const EMAG_COUNTRY_CONTEXT: Record<EmagCountry, EmagMapperContext> = {
  RO: { country: 'RO', currency: 'RON', timezone: 'Europe/Bucharest' },
  BG: { country: 'BG', currency: 'BGN', timezone: 'Europe/Sofia' },
  HU: { country: 'HU', currency: 'HUF', timezone: 'Europe/Budapest' },
  PL: { country: 'PL', currency: 'PLN', timezone: 'Europe/Warsaw' },
};

/**
 * Thrown by `toUnifiedOrder` when an order line's SKU cannot be determined
 * at all: `part_number` is blank AND `product_id` does not resolve through
 * the caller-supplied `productOfferLookup`. The mapper must stay pure (no
 * logging, no partial writes), so this is the explicit signal the connector
 * layer is expected to catch and use to mark the whole order as failed/needs
 * review rather than importing it with an invented or blank SKU.
 */
export class EmagUnresolvedSkuError extends Error {
  constructor(
    public readonly orderId: number,
    public readonly orderLineId: number,
    public readonly productId: number,
  ) {
    super(
      `eMAG order ${orderId}, line ${orderLineId}: part_number boş ve product_id=${productId} ` +
        `product_offer listesinde eşlenemedi; sipariş içe aktarılamaz.`,
    );
    this.name = 'EmagUnresolvedSkuError';
  }
}

/**
 * Result of mapping one eMAG order. `order` is the pure `MarketplaceOrder`
 * shape shared with every other provider; `skuWarnings` is an eMAG-specific
 * side channel for anomalies that were *recovered from* rather than fatal —
 * currently only "part_number was blank but product_id resolved it". The
 * mapper cannot log, so this is the explicit field the connector layer reads
 * to decide whether to log/flag the order even though it imported fine.
 */
export interface EmagOrderMappingResult {
  order: MarketplaceOrder;
  skuWarnings: string[];
}

/**
 * eMAG order statuses are 0..5, numeric. The map is kept explicit and closed;
 * an unlisted value never gets silently guessed into a different bucket — see
 * `toOrderStatus`.
 */
const EMAG_ORDER_STATUS_MAP: Record<string, string> = {
  '0': 'cancelled', // canceled
  '1': 'pending', // new
  '2': 'processing', // in progress
  '3': 'processing', // prepared for shipping
  '4': 'shipped', // finalized
  // eMAG status 5 = returned. `MarketplaceOrder.status` bir birleşim (union)
  // tipi değil, `string`; oradaki beş değerlik liste yalnızca yorumdur. Prisma
  // tarafında da `Order.status` kısıtsız `String`. ZalandoMapper ve
  // Hepsiburada zaten 'returned' üretiyor, `base.settings.ts` bunu seçenek
  // listesinde taşıyor. Bu yüzden iade, iptale indirgenmiyor — indirgense
  // raporlama iki farklı finansal olayı tek kova olarak okurdu.
  '5': 'returned',
};

function toOrderStatus(rawStatus: number): string {
  const mapped = EMAG_ORDER_STATUS_MAP[String(rawStatus)];
  if (mapped) return mapped;
  // TODO(emag): order.status eşleme tablosunda olmayan bir değer taşıyordu
  // (dokümana göre 0-5 dışı beklenmez). Sessizce farklı bir duruma
  // yuvarlamak yerine pending'e düşürülüyor; connector bu satırı ayrıca
  // işaretlemeli/loglamalı çünkü bu durum doğrulanmadı.
  return 'pending';
}

/**
 * Payment status depends on two raw fields together (`payment_mode_id` and,
 * only for online card, `payment_status`), so — unlike the order-status
 * table — this is a small decision function rather than a flat `Record`;
 * a single-key lookup cannot express "payment_status only matters when
 * payment_mode_id===3".
 */
function toPaymentStatus(order: RawEmagOrder): string {
  if (order.payment_mode_id === 1) return 'pending'; // kapıda ödeme (COD)
  if (order.payment_mode_id === 2) return 'pending'; // havale/EFT
  if (order.payment_mode_id === 3) {
    return order.payment_status === 1 ? 'paid' : 'pending';
  }
  // TODO(emag): payment_mode_id beklenmeyen bir değer taşıyordu (1|2|3 dışı,
  // doğrulanmadı). Sessizce 'paid' varsaymak yerine pending'e düşürülüyor.
  return 'pending';
}

/**
 * `shipping_street, shipping_city, shipping_suburb, shipping_postal_code,
 * shipping_country`, boş olanlar atlanarak birleştirilir. `shipping_suburb`
 * adından farklı olarak aslında ilçe/il (county) anlamına gelir — eMAG
 * dokümanındaki "suburb" (mahalle) açıklaması yanıltıcıdır, burada sırf
 * brief'teki alan adı ve sıra korunuyor. `shipping_locality_id` bilinçli
 * olarak dışarıda bırakıldı: sayısal bir eMAG iç referansıdır, insan-okunur
 * adrese ait değildir.
 */
function buildShippingAddress(customer: RawEmagCustomer): string | undefined {
  const parts = [
    customer.shipping_street,
    customer.shipping_city,
    customer.shipping_suburb,
    customer.shipping_postal_code,
    customer.shipping_country,
  ];
  const joined = parts
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .join(', ');
  return joined || undefined;
}

/**
 * Toplam tutar KDV DAHİLDİR — müşterinin ödediği, muhasebenin beklediği
 * tutar budur. `sale_price` her zaman KDV hariç geldiği için satır bazında
 * `vat` ile büyütülüp `shipping_tax` eklenir.
 *
 * TODO(emag): 'vat' oran (ör. 0.19) varsayıldı; tutar olma ihtimali
 * dokümanda net değil, ilk gerçek siparişte doğrulanacak.
 * TODO(emag): shipping_tax KDV dahil mi doğrulanacak.
 */
function computeTotalAmount(order: RawEmagOrder): number {
  const itemsTotal = (order.products ?? []).reduce((sum, line) => {
    const vatRate = Number(line.vat) || 0;
    const linePrice = Number(line.sale_price) || 0;
    const quantity = Number(line.quantity) || 0;
    return sum + linePrice * quantity * (1 + vatRate);
  }, 0);

  const shippingTax = Number(order.shipping_tax) || 0;
  return itemsTotal + shippingTax;
}

/**
 * Resolves one order line's SKU.
 *
 * Sequence (per plan): (1) `part_number` is the SKU when present. (2) When
 * it is blank, that is itself a warning-worthy anomaly — a warning string is
 * produced even if the fallback below succeeds, because the connector should
 * still know it happened. (3) The fallback tries `product_id` against a
 * caller-supplied `product_offer.id -> part_number` lookup. (4) If neither
 * resolves, returns `null` and `toUnifiedOrder` escalates to
 * `EmagUnresolvedSkuError` — a blank/invented SKU is worse than a hard
 * failure because it would corrupt inventory matching downstream.
 */
function resolveOrderItemSku(
  line: RawEmagOrderProduct,
  productOfferLookup: Map<number, string>,
): { sku: string; warning?: string } | null {
  const partNumber = typeof line.part_number === 'string' ? line.part_number.trim() : '';
  if (partNumber) {
    return { sku: partNumber };
  }

  const warning =
    `eMAG order line id=${line.id}: part_number boş geldi, ` +
    `product_id=${line.product_id} üzerinden product_offer eşlemesi denendi.`;

  const resolvedSku = productOfferLookup.get(line.product_id);
  if (resolvedSku) {
    return { sku: resolvedSku, warning };
  }

  return null;
}

// ------------------------------------------------------------------------ tarih

export interface EmagParsedDateParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * eMAG tarihleri 'Y-m-d H:i:s' biçimindedir (ör. '2014-07-24 12:16:47') —
 * ISO DEĞİLDİR, `T` ayracı ve ofset yoktur. `new Date(dateString)`
 * KULLANILMAZ: bu biçim RFC-standart olmadığı için motor-bağımlı farklı
 * sonuçlar doğurur (bazı çalışma zamanları kabul eder, bazıları geçersiz
 * sayıp `Invalid Date` döner). Bunun yerine parçalar düzenli ifadeyle
 * ayıklanır ve sayısal argümanlarla (motor-bağımsız) birleştirilir.
 */
export function parseEmagDateParts(raw: string): EmagParsedDateParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec((raw ?? '').trim());
  if (!match) return undefined;

  const [, y, mo, d, h, mi, s] = match;
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
    second: Number(s),
  };
}

function formatInZone(epochMs: number, timeZone: string): EmagParsedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(epochMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * TODO(emag): order.date saat dilimi dokümanda yazmıyor; pazarın yerel
 * saati varsayıldı (context.timezone), ilk gerçek siparişte doğrulanacak.
 * UTC VARSAYILMADI.
 *
 * eMAG'ın gönderdiği wall-clock zamanı (pazarın yerel saati olduğu
 * varsayımıyla) gerçek bir UTC ana çevirir. Saf/deterministik: yalnızca
 * Node çalışma zamanına gömülü IANA tz veritabanına bağlıdır — `Date.now()`
 * veya herhangi bir I/O kullanmaz.
 *
 * `MarketplaceOrder`'a bu turda BAĞLANMADI: o tip bu turda hiç tarih alanı
 * taşımıyor (bkz. MarketplaceTypes.ts). Bağlayıcı (connector) katmanı için
 * saklı tutuluyor — ör. artımlı senkronizasyon imleci — böylece tarih
 * ayrıştırma mantığı her çağıran tarafından yeniden icat edilmez.
 */
export function parseEmagDateToUtc(raw: string, timeZone: string): Date | undefined {
  const parts = parseEmagDateParts(raw);
  if (!parts) return undefined;

  const { year, month, day, hour, minute, second } = parts;
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wallClockAsUtc;

  // İki geçiş: DST sınırına denk gelen anları çözmek için yeterli.
  for (let i = 0; i < 2; i++) {
    const shown = formatInZone(guess, timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    guess += wallClockAsUtc - shownAsUtc;
  }

  return new Date(guess);
}

// --------------------------------------------------------------------- mapper

export class EmagMapper {
  /**
   * `product_offer/read` -> `MarketplaceProduct`.
   *
   * `sku` = `part_number` (satıcının kendi kodu) — `id` (eMAG'ın sayısal
   * offer id'si) veya `part_number_key` (eMAG katalog eşleme anahtarı)
   * DEĞİL; ikisi de envanter eşlemesi için yanlış anahtar olurdu.
   */
  static toUnifiedProduct(product: RawEmagProduct): MarketplaceProduct {
    const images = product.images ?? [];
    const mainImage = images.find((image) => image.display_type === 1) ?? images[0];

    return {
      sku: product.part_number,
      name: product.name,
      description: product.description,
      // eMAG sale_price KDV HARİÇTİR. KDV oranı ayrıca vat_id ile taşınır;
      // vat/read çözümü (id -> oran) bu turun kapsamı dışında bırakıldı, bu
      // yüzden fiyat burada bilinçli olarak vergisiz kalıyor.
      price: product.sale_price,
      // general_stock tüm depoların toplam stoğudur; stock[] burada AYRICA
      // toplanmıyor (iki kaynaktan aynı sayıyı iki kere üretmemek için).
      // estimated_stock, onaylanmamış siparişlerdeki rezervi düşer ve WMS
      // için daha doğru bir sinyal olabilir, ama bu turda kullanılmıyor.
      stockQuantity: product.general_stock,
      image: mainImage?.url,
      barcode: product.ean?.[0],
    };
  }

  /**
   * `order/read` -> `MarketplaceOrder` (+ eMAG'a özgü SKU uyarıları).
   *
   * `productOfferLookup`: `product_offer.id -> part_number`. Yalnızca bir
   * satırın `part_number`'ı boşsa kullanılır (bkz. `resolveOrderItemSku`).
   * Sağlanmazsa boş bir eşleme kullanılır — bu durumda boş `part_number`
   * taşıyan her satır `EmagUnresolvedSkuError` fırlatır.
   */
  static toUnifiedOrder(
    order: RawEmagOrder,
    context: EmagMapperContext,
    productOfferLookup: Map<number, string> = new Map(),
  ): EmagOrderMappingResult {
    const skuWarnings: string[] = [];

    const items: MarketplaceOrderItem[] = (order.products ?? []).map((line) => {
      const resolved = resolveOrderItemSku(line, productOfferLookup);
      if (!resolved) {
        throw new EmagUnresolvedSkuError(order.id, line.id, line.product_id);
      }
      if (resolved.warning) skuWarnings.push(resolved.warning);

      return EmagMapper.toUnifiedOrderItem(line, resolved.sku);
    });

    const marketplaceOrder: MarketplaceOrder = {
      // Prefix (mağaza/entegrasyon önekini eklemek) connector/settings
      // tarafının işi — mapper burada sadece ham id'yi string'e çevirir.
      orderNumber: String(order.id),
      customerName: order.customer.name,
      // Boş string gelirse undefined'a düşürülür; downstream "" != yok.
      customerEmail: order.customer.email ? order.customer.email : undefined,
      customerPhone: order.customer.phone_1,
      shippingAddress: buildShippingAddress(order.customer),
      status: toOrderStatus(order.status),
      paymentStatus: toPaymentStatus(order),
      totalAmount: computeTotalAmount(order),
      // Pazar sabitinden gelir, asla boş bırakılmaz — worker'daki
      // `currency || 'TRY'` fallback'ine düşerse sipariş sessizce TRY
      // yazılırdı.
      currency: context.currency,
      source: 'emag',
      items,
    };

    return { order: marketplaceOrder, skuWarnings };
  }

  /**
   * Tek bir sipariş kalemini `MarketplaceOrderItem`'a çevirir. `sku` burada
   * zaten çözülmüş olarak gelir (bkz. `resolveOrderItemSku`) — bu fonksiyon
   * SKU çözümlemesi YAPMAZ, yalnızca alan eşlemesidir.
   */
  private static toUnifiedOrderItem(line: RawEmagOrderProduct, sku: string): MarketplaceOrderItem {
    const unitPrice = line.sale_price; // KDV HARİÇ
    return {
      sku,
      name: line.name,
      quantity: line.quantity,
      unitPrice,
      totalPrice: unitPrice * line.quantity,
    };
  }
}
