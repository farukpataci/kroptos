/**
 * eMAG Marketplace API (v4.4.4) raw response shapes, narrowed to what
 * `EmagMapper` reads. Field names and their meaning are as specified in the
 * task brief for this integration (product_offer/read, order/read,
 * category/read). Where the brief gave a field name but not its exact
 * shape/type, the field is typed loosely (`unknown`) and flagged with
 * `TODO(emag)` rather than guessed — see CLAUDE.md "Tahmin etme" rule.
 *
 * Every eMAG list response is wrapped in the same envelope; see
 * `RawEmagApiResponse<T>`.
 */

// ------------------------------------------------------------- Response envelope

export interface RawEmagApiResponse<T> {
  isError: boolean;
  messages: string[];
  results: T[];
}

// ------------------------------------------------------------------ product_offer

export interface RawEmagImage {
  /** 1 = ana görsel (main), 2 = ikincil (secondary), 0 = diğer (other). */
  display_type: 0 | 1 | 2;
  url: string;
}

export interface RawEmagStock {
  warehouse_id: number;
  /** Tamsayı, 0..65535 aralığında. */
  value: number;
}

/**
 * `product_offer/read` sonucundaki bir kalem.
 *
 * `id` SATICININ eMAG'daki ürün teklifi (offer) id'sidir — 1..16777215
 * aralığında integer. `part_number_key` eMAG'ın katalog eşleme anahtarıdır;
 * satıcının kendi SKU'su DEĞİLDİR (bkz. EmagMapper: sku = part_number).
 */
export interface RawEmagProduct {
  id: number;
  /** Satıcının kendi ürün kodu (üretici parça no / SKU). */
  part_number: string;
  /** eMAG katalog eşleme anahtarı — SKU olarak KULLANILMAZ. */
  part_number_key: string;
  name: string;
  /** HTML içerebilir; mapper temizlemez. */
  description: string;
  brand: string;
  category_id: number;
  /** KDV HARİÇ. */
  sale_price: number;
  recommended_price: number;
  min_sale_price: number;
  max_sale_price: number;
  best_offer_sale_price: number;
  currency: string;
  /** Tüm depoların toplam stoğu. */
  general_stock: number;
  /** Onaylanmamış siparişlerdeki rezervi düşen tahmini stok. */
  estimated_stock: number;
  weight: number;
  warranty: number;
  url: string;
  /** 1 = aktif, 0 = pasif. Pasifleştirme yolu status=0 gönderilmesidir. */
  status: 1 | 0;
  images: RawEmagImage[];
  /**
   * TODO(emag): product_offer.characteristics eleman şekli (id/value çiftleri
   * mi, tag mi) bu turda dokümante edilmedi — brief yalnızca alan adını verdi.
   */
  characteristics: unknown[];
  /** EAN barkod listesi. */
  ean: string[];
  /** KDV oranının kendisi değil, KDV oranı referans id'sidir. */
  vat_id: number;
  /**
   * eMAG doküman brief'i yalnızca alan adını verdi; değer kümesi (ör. 1|2)
   * bu turda doğrulanmadı.
   */
  ownership: number;
  /** TODO(emag): offer_validation_status şekli (muhtemelen {value, description}) doğrulanmadı. */
  offer_validation_status: unknown;
  /** TODO(emag): doc_errors şekli dokümante edilmedi. */
  doc_errors: unknown;
  stock: RawEmagStock[];
  /**
   * TODO(emag): handling_time eleman şekli dokümante edilmedi. Ayrıca bu tur
   * için kapsam dışı — EmagMapper bu alanı MarketplaceProduct'a taşımaz.
   */
  handling_time: unknown;
}

export type RawEmagProductOfferReadResponse = RawEmagApiResponse<RawEmagProduct>;

// ------------------------------------------------------------------------- order

export interface RawEmagCustomer {
  id: number;
  name: string;
  company?: string;
  gender?: string;
  code?: string;
  email: string;
  phone_1?: string;
  phone_2?: string;
  phone_3?: string;
  billing_name?: string;
  billing_phone?: string;
  billing_country?: string;
  billing_suburb?: string;
  billing_city?: string;
  /** Sayısal eMAG lokasyon referansı — adres string'ine KONMAZ. */
  billing_locality_id?: number;
  billing_street?: string;
  billing_postal_code?: string;
  shipping_country?: string;
  /** İsme rağmen aslında ilçe/il (county) — eMAG dokümanındaki "suburb" açıklaması hatalı. */
  shipping_suburb?: string;
  shipping_city?: string;
  /** Sayısal eMAG lokasyon referansı — adres string'ine KONMAZ. */
  shipping_locality_id?: number;
  shipping_street?: string;
  shipping_postal_code?: string;
  shipping_contact?: string;
  shipping_phone?: string;
  /** TODO(emag): tipi (0/1 mi boolean mu) brief'te belirtilmedi. */
  is_vat_payer?: unknown;
  registration_number?: string;
  bank?: string;
  iban?: string;
}

/** `order/read` sonucundaki `products[]` içindeki bir sipariş kalemi. */
export interface RawEmagOrderProduct {
  id: number;
  /** product_offer.id ile eşleşir (satıcının ürün id'si). */
  product_id: number;
  /** Boş gelebilir — bkz. EmagMapper.resolveOrderItemSku. */
  part_number: string;
  name: string;
  quantity: number;
  /** KDV HARİÇ (satır bazlı). */
  sale_price: number;
  /** Satır bazlı KDV. Oran mı (0.19) tutar mı olduğu bu turda doğrulanmadı. */
  vat: number;
}

/**
 * `order/read` sonucundaki bir sipariş.
 *
 * `date` alanı 'Y-m-d H:i:s' biçimindedir (ör. '2014-07-24 12:16:47') — ISO
 * DEĞİLDİR, `T` ayracı ve ofset yoktur. Bkz. EmagMapper.parseEmagDateParts /
 * parseEmagDateToUtc — `new Date(dateString)` KULLANILMAZ.
 */
export interface RawEmagOrder {
  id: number;
  /** 0..5 aralığında integer. Eşleme: bkz. EmagMapper EMAG_ORDER_STATUS_MAP. */
  status: 0 | 1 | 2 | 3 | 4 | 5;
  /** 1 = kapıda ödeme (COD), 2 = havale/EFT, 3 = online kart. */
  payment_mode_id: 1 | 2 | 3;
  /** Sadece online ödemede (payment_mode_id===3) dolu. 0 = ödenmedi, 1 = ödendi. */
  payment_status?: 0 | 1;
  shipping_tax: number;
  /** 'Y-m-d H:i:s' biçiminde — ISO değil. */
  date: string;
  customer: RawEmagCustomer;
  products: RawEmagOrderProduct[];
}

export type RawEmagOrderReadResponse = RawEmagApiResponse<RawEmagOrder>;

// ---------------------------------------------------------------------- category

export interface RawEmagCategoryCharacteristic {
  id: number;
  name: string;
  type_id: number;
  /** TODO(emag): boolean mu 0/1 mi brief'te belirtilmedi. */
  is_filter: unknown;
  /** TODO(emag): values[] eleman şekli dokümante edilmedi. */
  values: unknown[];
}

export interface RawEmagCategory {
  characteristics: RawEmagCategoryCharacteristic[];
  /** TODO(emag): family_types[] eleman şekli dokümante edilmedi. */
  family_types: unknown[];
}

export type RawEmagCategoryReadResponse = RawEmagApiResponse<RawEmagCategory>;
