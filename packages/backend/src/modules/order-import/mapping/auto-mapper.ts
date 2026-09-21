import { EXPORT_COLUMNS, ExportColumnDef } from '../../order-export/columns/column-registry';

export interface AutoMappingResult {
  columnMap: Record<string, string>; // fileHeader -> canonicalKey
  confidence: Record<string, number>; // fileHeader -> 0..1 confidence score
  unmappedHeaders: string[];
  suggestedTemplateId?: string;
}

/**
 * Normalize a string for fuzzy header comparison
 * Converts Turkish characters, removes non-alphanumeric chars, lowercases
 */
export function normalizeHeader(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Synonyms dictionary mapping common Turkish and English header variants
 * to KroptOS canonical column keys.
 */
const HEADER_SYNONYMS: Record<string, string[]> = {
  orderNumber: [
    'siparisno', 'siparisnumarasi', 'siparisid', 'orderno', 'ordernumber', 'orderid',
    'sipariskodu', 'ordernum', 'sipno',
  ],
  marketplaceOrderNumber: [
    'pazaryerisiparisno', 'pazaryerino', 'marketplaceorderid', 'marketplaceordernumber',
    'haricisiparisno', 'pazaryeriid', 'externalsiparisno', 'distno',
  ],
  publicId: [
    'publicid', 'genelkimlik', 'kroptosid', 'uuid',
  ],
  orderDate: [
    'siparistarihi', 'tarih', 'orderdate', 'olusturulmatarihi', 'date', 'createdat', 'sipariszamani',
  ],
  status: [
    'durum', 'siparisdurumu', 'status', 'orderstatus', 'gunceldurum',
  ],
  paymentStatus: [
    'odemedurumu', 'paymentstatus', 'tahsildurumu',
  ],
  fulfillmentStatus: [
    'kargodurumu', 'teslimatdurumu', 'fulfillmentstatus', 'sevkiyatdurumu',
  ],
  source: [
    'kaynak', 'satiskanali', 'kanal', 'source', 'channel', 'platform', 'pazaryeri',
  ],
  currency: [
    'parabirimi', 'doviz', 'currency', 'dovizcinsi',
  ],
  totalAmount: [
    'toplamtutar', 'toplam', 'saparistutari', 'siparistutari', 'total', 'totalamount', 'geneltoplam', 'tutar',
  ],
  notes: [
    'siparisnotu', 'not', 'notlar', 'notes', 'ordernotes', 'aciklama', 'musterinotu',
  ],
  tags: [
    'etiketler', 'etiket', 'tags', 'tag',
  ],
  priority: [
    'oncelik', 'priority', 'oncelikdurumu',
  ],
  isHold: [
    'beklemedemi', 'beklemede', 'ishold', 'hold', 'askida',
  ],
  customerName: [
    'musteriadi', 'musteri', 'alici', 'aliciadi', 'customername', 'buyername', 'fullname',
    'adsoyad', 'musteriadisoyadi', 'aliciadsoyad',
  ],
  customerEmail: [
    'musterieposta', 'eposta', 'epostasi', 'email', 'mail', 'customeremail', 'alicieposta',
  ],
  customerPhone: [
    'musteritelefonu', 'telefon', 'tel', 'gsm', 'phone', 'mobile', 'customerphone', 'alicitelefonu',
  ],
  shippingLine1: [
    'teslimatadresi', 'adres', 'address', 'shippingaddress', 'addressline1', 'adres1', 'sevkadresi',
  ],
  shippingDistrict: [
    'teslimatilcesi', 'ilce', 'semt', 'district', 'town', 'shippingdistrict',
  ],
  shippingCity: [
    'teslimatili', 'sehir', 'il', 'city', 'province', 'shippingcity',
  ],
  shippingPostalCode: [
    'postakodu', 'pk', 'zip', 'postalcode', 'postcode', 'shippingpostalcode',
  ],
  shippingCountryCode: [
    'ulkekodu', 'ulke', 'country', 'countrycode', 'shippingcountry',
  ],
  carrierName: [
    'kargofirmasi', 'kargo', 'tasiyici', 'carrier', 'carriername', 'shippingcarrier', 'kargosirketi',
  ],
  trackingNumber: [
    'kargotakipno', 'takipno', 'trackingnumber', 'trackingno', 'kargokodu', 'takipkodu',
  ],
  totalDesi: [
    'toplamdesi', 'desi', 'desimiktari', 'weight', 'desiagirlik',
  ],
  itemsSummary: [
    'urunkalemleriozeti', 'urunlerozeti', 'kalemlerozeti', 'itemssummary',
  ],
  itemCount: [
    'toplamkalemadedi', 'kalemadedi', 'urunsayisi', 'toplamurunadedi', 'itemcount',
  ],
  itemName: [
    'urunadi', 'urun', 'kalemadi', 'itemname', 'productname', 'malzemeadi', 'malzeme',
  ],
  itemSku: [
    'urunkodu', 'stokkodu', 'sku', 'itemsku', 'productcode', 'kod', 'modelkodu',
  ],
  itemBarcode: [
    'barkod', 'barcode', 'gtin', 'ean', 'ean13', 'itembarcode',
  ],
  itemQuantity: [
    'kalemadedi', 'adet', 'miktar', 'quantity', 'qty', 'itemquantity', 'urunsayisi',
  ],
  itemUnitPrice: [
    'birimfiyat', 'fiyat', 'unitprice', 'price', 'itemunitprice', 'satisfiyati',
  ],
  itemTaxRate: [
    'kdvorani', 'kdv', 'vergi', 'taxrate', 'vat', 'kdvyuzdesi',
  ],
  itemDiscount: [
    'kalemindirimi', 'indirim', 'discount', 'itemdiscount', 'indirimtutari',
  ],
  itemTotal: [
    'kalemtoplami', 'satirtoplami', 'itemtotal', 'uruntoplami',
  ],
  invoiceNumber: [
    'faturanumarasi', 'faturano', 'invoicenumber', 'invoiceno',
  ],
  shippingFee: [
    'kargoucreti', 'shippingfee', 'kargobedeli', 'nakliye', 'kargofiyati',
  ],
  paymentMethod: [
    'odemeyontemi', 'paymentmethod', 'odemetipi', 'odemebicimi',
  ],
};

export class AutoMapper {
  /**
   * Guess canonical mappings for the given uploaded file headers
   */
  static mapHeaders(fileHeaders: string[]): AutoMappingResult {
    const columnMap: Record<string, string> = {};
    const confidence: Record<string, number> = {};
    const unmappedHeaders: string[] = [];
    const usedCanonicalKeys = new Set<string>();

    for (const header of fileHeaders) {
      const trimmed = header.trim();
      if (!trimmed) continue;

      const norm = normalizeHeader(trimmed);
      let matchedKey: string | null = null;
      let score = 0;

      // Tier 1: Exact label or key match in catalog
      for (const col of EXPORT_COLUMNS) {
        if (col.key.toLowerCase() === trimmed.toLowerCase() || col.label.toLowerCase() === trimmed.toLowerCase()) {
          matchedKey = col.key;
          score = 1.0;
          break;
        }
      }

      // Tier 2: Normalized label or key match
      if (!matchedKey) {
        for (const col of EXPORT_COLUMNS) {
          if (normalizeHeader(col.key) === norm || normalizeHeader(col.label) === norm) {
            matchedKey = col.key;
            score = 0.9;
            break;
          }
        }
      }

      // Tier 3: Synonyms dictionary match
      if (!matchedKey) {
        for (const [canonicalKey, syns] of Object.entries(HEADER_SYNONYMS)) {
          if (syns.includes(norm)) {
            matchedKey = canonicalKey;
            score = 0.8;
            break;
          }
        }
      }

      // Tier 4: Partial / substring match (high confidence)
      if (!matchedKey) {
        for (const [canonicalKey, syns] of Object.entries(HEADER_SYNONYMS)) {
          for (const s of syns) {
            if (norm.length >= 4 && s.length >= 4 && (norm.includes(s) || s.includes(norm))) {
              matchedKey = canonicalKey;
              score = 0.65;
              break;
            }
          }
          if (matchedKey) break;
        }
      }

      if (matchedKey && !usedCanonicalKeys.has(matchedKey)) {
        columnMap[trimmed] = matchedKey;
        confidence[trimmed] = score;
        usedCanonicalKeys.add(matchedKey);
      } else {
        unmappedHeaders.push(trimmed);
      }
    }

    return {
      columnMap,
      confidence,
      unmappedHeaders,
    };
  }

  /**
   * Check if any saved mapping template has a high header overlap with the file
   */
  static findBestTemplate(
    fileHeaders: string[],
    templates: Array<{ id: string; columnMap: Record<string, string> }>,
  ): string | undefined {
    if (!templates.length || !fileHeaders.length) return undefined;

    let bestTemplateId: string | undefined;
    let highestOverlap = 0;

    const fileHeaderSet = new Set(fileHeaders.map((h) => h.trim().toLowerCase()));

    for (const tpl of templates) {
      if (!tpl.columnMap) continue;
      const tplHeaders = Object.keys(tpl.columnMap);
      if (!tplHeaders.length) continue;

      let matched = 0;
      for (const th of tplHeaders) {
        if (fileHeaderSet.has(th.trim().toLowerCase())) {
          matched++;
        }
      }

      const overlapRatio = matched / tplHeaders.length;
      // If at least 70% of template headers match
      if (overlapRatio >= 0.7 && overlapRatio > highestOverlap) {
        highestOverlap = overlapRatio;
        bestTemplateId = tpl.id;
      }
    }

    return bestTemplateId;
  }
}
