import {
  TicimaxRawOrder,
  TicimaxRawProduct,
  TicimaxRawVariation,
  TicimaxRawOrderItem,
} from './TicimaxTypes';

export class TicimaxParser {
  /**
   * Helper to ensure array form from XML elements that can be either single object or array.
   */
  public static ensureArray<T>(item: T | T[] | undefined | null): T[] {
    if (item === undefined || item === null) return [];
    if (Array.isArray(item)) return item;
    return [item];
  }

  /**
   * Extracts products array from SelectUrunler result.
   */
  public static parseProducts(rawResult: any): TicimaxRawProduct[] {
    if (!rawResult) return [];

    const container =
      rawResult.Urunler ||
      rawResult.UrunKarti ||
      rawResult.Urun ||
      rawResult;

    const list =
      container.UrunKarti ||
      container.Urun ||
      container;

    return this.ensureArray(list).map((p: any) => {
      const rawVars = p.Varyasyonlar || p.Varyasyon;
      const varList = rawVars?.Varyasyon || rawVars;
      const variations: TicimaxRawVariation[] = this.ensureArray(varList).map((v: any) => ({
        ID: v.ID ?? v.VaryasyonID,
        VaryasyonID: v.VaryasyonID ?? v.ID,
        StokKodu: v.StokKodu ?? p.StokKodu,
        Barkod: v.Barkod ?? p.Barkod,
        StokAdedi: v.StokAdedi ?? v.Stok,
        SatisFiyati: v.SatisFiyati ?? v.Fiyat ?? p.SatisFiyati,
        AlisFiyati: v.AlisFiyati,
        IndirimliFiyati: v.IndirimliFiyati,
        KdvOrani: v.KdvOrani ?? p.KdvOrani,
        Aktif: v.Aktif,
        Tanim: v.Tanim,
      }));

      return {
        UrunKartiID: p.UrunKartiID ?? p.ID,
        KartAktif: p.KartAktif ?? p.Aktif,
        UrunAdi: p.UrunAdi ?? p.Baslik ?? p.Ad,
        Aciklama: p.Aciklama,
        OnYazi: p.OnYazi,
        KategoriID: p.KategoriID,
        KategoriAdi: p.KategoriAdi,
        MarkaID: p.MarkaID,
        MarkaAdi: p.MarkaAdi,
        TedarikciKodu: p.TedarikciKodu,
        Varyasyonlar: variations.length > 0 ? variations : [
          {
            StokKodu: p.StokKodu,
            Barkod: p.Barkod,
            StokAdedi: p.StokAdedi ?? p.Stok,
            SatisFiyati: p.SatisFiyati ?? p.Fiyat,
          },
        ],
      };
    });
  }

  /**
   * Extracts orders array from SelectSiparis result.
   */
  public static parseOrders(rawResult: any): TicimaxRawOrder[] {
    if (!rawResult) return [];

    const container =
      rawResult.Siparisler ||
      rawResult.Siparis ||
      rawResult;

    const list =
      container.Siparis ||
      container;

    return this.ensureArray(list).map((o: any) => {
      const rawItems = o.Urunler || o.Urun || o.SiparisUrunleri;
      const itemsList = rawItems?.SiparisUrun || rawItems?.Urun || rawItems;

      const items: TicimaxRawOrderItem[] = this.ensureArray(itemsList).map((i: any) => ({
        ID: i.ID ?? i.UrunID,
        UrunID: i.UrunID ?? i.ID,
        UrunAdi: i.UrunAdi ?? i.Baslik ?? i.Ad,
        StokKodu: i.StokKodu,
        Barkod: i.Barkod,
        Adet: i.Adet ?? i.Miktar ?? 1,
        BirimFiyat: i.BirimFiyat ?? i.Fiyat,
        ToplamTutar: i.ToplamTutar ?? i.Tutar,
        KdvOrani: i.KdvOrani,
        VaryasyonTanim: i.VaryasyonTanim ?? i.Ozellik,
      }));

      const shipping = o.TeslimatAdresi || o.Adres || {};
      const billing = o.FaturaAdresi || shipping;

      return {
        ID: o.ID ?? o.SiparisID,
        SiparisID: o.SiparisID ?? o.ID,
        SiparisNo: String(o.SiparisNo ?? o.ID ?? ''),
        SiparisTarihi: o.SiparisTarihi ?? o.Tarih,
        Durum: o.Durum ?? o.SiparisDurumu,
        DurumID: o.DurumID,
        OdemeTipi: o.OdemeTipi,
        OdemeDurumu: o.OdemeDurumu,
        ToplamTutar: o.ToplamTutar ?? o.GenelToplam ?? o.Tutar,
        GenelToplam: o.GenelToplam ?? o.ToplamTutar ?? o.Tutar,
        KargoUcreti: o.KargoUcreti,
        ParaBirimi: o.ParaBirimi ?? 'TRY',
        MusteriID: o.MusteriID ?? o.UyeID,
        MusteriAdi: o.MusteriAdi ?? shipping.AliciAdi,
        MusteriSoyadi: o.MusteriSoyadi ?? shipping.AliciSoyadi,
        MusteriEmail: o.MusteriEmail ?? o.UyeEmail,
        MusteriTelefon: o.MusteriTelefon ?? o.MusteriGsm ?? shipping.Telefon,
        MusteriGsm: o.MusteriGsm ?? shipping.Gsm,
        TeslimatAdresi: {
          AliciAdi: shipping.AliciAdi,
          AliciSoyadi: shipping.AliciSoyadi,
          Adres: shipping.Adres ?? shipping.AdresSatir1,
          Il: shipping.Il ?? shipping.Sehir,
          Ilce: shipping.Ilce,
          PostaKodu: shipping.PostaKodu,
          Ulke: shipping.Ulke,
          Telefon: shipping.Telefon,
          Gsm: shipping.Gsm,
          TCKimlikNo: shipping.TCKimlikNo,
        },
        FaturaAdresi: {
          AliciAdi: billing.AliciAdi,
          AliciSoyadi: billing.AliciSoyadi,
          Adres: billing.Adres ?? billing.AdresSatir1,
          Il: billing.Il ?? billing.Sehir,
          Ilce: billing.Ilce,
          PostaKodu: billing.PostaKodu,
          Ulke: billing.Ulke,
          Telefon: billing.Telefon,
          TCKimlikNo: billing.TCKimlikNo,
          VergiNo: billing.VergiNo,
          VergiDairesi: billing.VergiDairesi,
        },
        KargoFirmasi: o.KargoFirmasi,
        KargoTakipNo: o.KargoTakipNo,
        KargoTakipUrl: o.KargoTakipUrl,
        Urunler: items,
      };
    });
  }

  /**
   * Extracts category tree from SelectKategoriler result.
   */
  public static parseCategories(rawResult: any): any[] {
    if (!rawResult) return [];
    const container = rawResult.Kategoriler || rawResult.Kategori || rawResult;
    const list = container.Kategori || container;
    return this.ensureArray(list).map((k: any) => ({
      id: String(k.ID ?? k.KategoriID ?? ''),
      name: k.Tanim ?? k.KategoriAdi ?? k.Ad ?? '',
      parentId: k.UstKategoriID ? String(k.UstKategoriID) : undefined,
    }));
  }
}
