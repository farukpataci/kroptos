/**
 * Ticimax SOAP Web Service Integration Types
 */

export interface TicimaxCredentials {
  /**
   * Domain name or URL of the store (e.g. "magaza.com" or "https://www.magaza.com")
   */
  storeDomain: string;
  /**
   * WS Yetki Kodu (Auth code generated from Ticimax Panel > Ayarlar > WS Yetki Kodu Yönetimi)
   */
  uyeKodu: string;
}

export interface TicimaxRawProduct {
  UrunKartiID?: number | string;
  KartAktif?: boolean | string | number;
  UrunAdi?: string;
  Aciklama?: string;
  OnYazi?: string;
  KategoriID?: number | string;
  KategoriAdi?: string;
  MarkaID?: number | string;
  MarkaAdi?: string;
  TedarikciKodu?: string;
  SatisBirimi?: string;
  Varyasyonlar?: TicimaxRawVariation | TicimaxRawVariation[];
}

export interface TicimaxRawVariation {
  ID?: number | string;
  VaryasyonID?: number | string;
  StokKodu?: string; // SKU
  Barkod?: string;
  StokAdedi?: number | string;
  SatisFiyati?: number | string;
  AlisFiyati?: number | string;
  IndirimliFiyati?: number | string;
  KdvOrani?: number | string;
  Aktif?: boolean | string | number;
  Tanim?: string;
  Ozellikler?: Array<{ Tanim: string; Deger: string }>;
}

export interface TicimaxRawOrder {
  ID?: number | string;
  SiparisID?: number | string;
  SiparisNo?: string;
  SiparisTarihi?: string;
  Durum?: string | number;
  DurumID?: number | string;
  OdemeTipi?: string;
  OdemeDurumu?: string | number;
  ToplamTutar?: number | string;
  GenelToplam?: number | string;
  KargoUcreti?: number | string;
  ParaBirimi?: string;
  MusteriID?: number | string;
  MusteriAdi?: string;
  MusteriSoyadi?: string;
  MusteriEmail?: string;
  MusteriTelefon?: string;
  MusteriGsm?: string;
  TeslimatAdresi?: TicimaxRawAddress;
  FaturaAdresi?: TicimaxRawAddress;
  KargoFirmasi?: string;
  KargoTakipNo?: string;
  KargoTakipUrl?: string;
  Urunler?: TicimaxRawOrderItem | TicimaxRawOrderItem[];
}

export interface TicimaxRawOrderItem {
  ID?: number | string;
  UrunID?: number | string;
  UrunAdi?: string;
  StokKodu?: string;
  Barkod?: string;
  Adet?: number | string;
  BirimFiyat?: number | string;
  ToplamTutar?: number | string;
  KdvOrani?: number | string;
  VaryasyonTanim?: string;
}

export interface TicimaxRawAddress {
  AliciAdi?: string;
  AliciSoyadi?: string;
  Adres?: string;
  Il?: string;
  Ilce?: string;
  PostaKodu?: string;
  Ulke?: string;
  Telefon?: string;
  Gsm?: string;
  TCKimlikNo?: string;
  VergiNo?: string;
  VergiDairesi?: string;
}

export interface TicimaxStockUpdateItem {
  StokKodu: string;
  Barkod?: string;
  Miktar: number;
}
