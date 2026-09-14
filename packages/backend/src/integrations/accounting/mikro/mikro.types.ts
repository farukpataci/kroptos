/**
 * Mikro ERP (v16/v17) Desktop API — docs/mikro.agent.md §3. Yalnızca dokümandan BİREBİR okunanlar.
 * Büyük/küçük harf dokümanda tutarsızdır ve sunucunun duyarlılığı doğrulanmadı → yollar
 * dokümandaki hâliyle sabittir, NORMALİZE EDİLMEZ (§11).
 */
export const MIKRO_DEFAULT_PORT_V17 = 8094;
export const MIKRO_DEFAULT_PORT_V16 = 8084;
export const MIKRO_DEFAULT_BASE_URL = 'http://localhost';

/**
 * Sürüm eki descriptor.methodVersions'tan okunur; "en yenisini kullan" mantığı YOK (§7.5).
 * Dokümanda tam yol yalnızca iki uç için görüldü: `/Api/APIMethods/APILogin` ve
 * `/api/apimethods/SqlVeriOkuV2`. Diğer metotlar için önek APILogin'inkiyle aynı VARSAYILDI —
 * §12 bilinmeyeni #11, Faz D'de doğrulanır.
 */
export const MIKRO_PATHS = {
  APILogin: '/Api/APIMethods/APILogin',
  CariListesi: '/Api/APIMethods/CariListesi',
  CariKaydet: '/Api/APIMethods/CariKaydet',
  CariGuncelle: '/Api/APIMethods/CariGuncelle',
  StokListesi: '/Api/APIMethods/StokListesi',
  StokKaydet: '/Api/APIMethods/StokKaydet',
  DahiliStokHareketKaydet: '/Api/APIMethods/DahiliStokHareketKaydet',
  FaturaKaydet: '/Api/APIMethods/FaturaKaydet',
  AlimSatimEvragiKaydet: '/Api/APIMethods/AlimSatimEvragiKaydet',
  AlimSatimEvragiDuzelt: '/Api/APIMethods/AlimSatimEvragiDuzelt',
  /** K12: SİLMEDİR, iptal değil — connector kendiliğinden ÇAĞIRMAZ */
  AlimSatimEvragiSil: '/Api/APIMethods/AlimSatimEvragiSil',
  SiparistenFaturaOlusturma: '/Api/APIMethods/SiparistenFaturaOlusturma',
  KullaniciListesi: '/Api/APIMethods/KullaniciListesi',
  KullaniciParametreleri: '/Api/APIMethods/KullaniciParametreleri',
  VergiListesi: '/Api/APIMethods/VergiListesi',
  /** Dokümanda küçük harfle: `/api/apimethods/SqlVeriOkuV2` — olduğu gibi */
  SqlVeriOku: '/api/apimethods/SqlVeriOku',
} as const;

export type MikroMethod = keyof typeof MIKRO_PATHS;

/** §3.3 envanterindeki sürüm ekleri — dokümandan birebir. */
export const MIKRO_METHOD_VERSIONS: Record<MikroMethod, string> = {
  APILogin: '',
  CariListesi: 'V2', // V3 de var; seçim açık, otomatik "en yeni" yok
  CariKaydet: 'V2',
  CariGuncelle: 'V2',
  StokListesi: 'V2',
  StokKaydet: 'V2',
  DahiliStokHareketKaydet: 'V2',
  FaturaKaydet: 'V2', // V3 de var; seçim açık
  AlimSatimEvragiKaydet: 'V2',
  AlimSatimEvragiDuzelt: 'V2',
  AlimSatimEvragiSil: 'V2',
  SiparistenFaturaOlusturma: 'V2',
  KullaniciListesi: 'V2',
  KullaniciParametreleri: 'V2',
  VergiListesi: 'V2',
  SqlVeriOku: 'V2',
};

/**
 * K1 — bu anahtarlar backend'de üretilen HİÇBİR gövdede bulunmaz; `Mikro` nesnesini Agent takar.
 * (`Mikro: { ApiKey, KullaniciKodu, Sifre, FirmaKodu, CalismaYili }` — §3.2)
 */
export const MIKRO_FORBIDDEN_BODY_KEYS = ['Mikro', 'ApiKey', 'Sifre', 'KullaniciKodu', 'password', 'apiKey', 'sifre'] as const;

/** Evrak numarası — §3.4. `cha_evrakno_sira` GÖNDERİLMEZ; sırayı Mikro üretir (§7.4). */
export interface MikroEvrakNo {
  cha_evrakno_seri: string;
}

/** §3.4: `user_tablo` özel kullanıcı tablosu harici referans taşır. Kolonun kurulumda var olup olmadığı DOĞRULANMADI (§12/5). */
export interface MikroUserTablo {
  KROPTOS_REF: string;
}

/**
 * Kimliksiz fatura gövdesi. Alan adı eşlemesi DOĞRULANMADI (§12/3) — burada yalnızca §3.4'te
 * görülen alanlar ve KroptOS'un kendi kalem modeli vardır; Mikro kalem alan adları uydurulmaz.
 */
export interface MikroInvoiceBody extends MikroEvrakNo {
  user_tablo: MikroUserTablo;
  /** ISO YYYY-MM-DD — Mikro alan adı doğrulanana kadar KroptOS adıyla taşınır */
  issueDate: string;
  currency: string;
  partnerKey: MikroPartnerKey;
  lines: MikroInvoiceLine[];
  totals: { subtotal: number; vatTotal: number; grandTotal: number; discountTotal?: number };
  notes?: string;
}

export interface MikroInvoiceLine {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount?: number;
  totalAmount: number;
}

/** Cari eşleştirme anahtarı: VKN/TCKN → ERP cari kodu; İSİM ASLA ANAHTAR DEĞİL (§7.5). */
export type MikroPartnerKey =
  | { kind: 'taxNumber'; value: string }
  | { kind: 'erpCode'; value: string };

export interface MikroPartnerBody {
  key: MikroPartnerKey;
  name: string;
  taxOffice?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  isCompany: boolean;
}

/** StokListesi isteği — `changedSince` YOK: stockDelta NOT_SUPPORTED (§7.1/§11). */
export interface MikroStockListBody {
  depoNo?: number;
  limit?: number;
  offset?: number;
}

export interface MikroReceiptBody {
  invoiceExternalId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  user_tablo: MikroUserTablo;
  notes?: string;
}

/** Mikro cevap zarfı DOĞRULANMADI (§12/2) — response mapper tanımadığı şekilde HATA fırlatır. */
export type MikroUnknownEnvelope = Record<string, unknown>;
