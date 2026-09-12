import {
  EcommerceAddress,
  EcommerceFinancialStatus,
  EcommerceFulfillmentStatus,
  EcommerceOrder,
  EcommerceOrderItem,
  EcommerceOrderStatus,
  EcommerceProduct,
  EcommerceProductVariant,
} from '../core/EcommerceTypes';
import { TicimaxRawOrder, TicimaxRawProduct } from './TicimaxTypes';

export class TicimaxMapper {
  /**
   * Safe numeric amount parser supporting string with commas or decimals.
   */
  public static parseAmount(value: unknown): number {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    const str = String(value).trim();
    if (str.includes(',') && !str.includes('.')) {
      return parseFloat(str.replace(',', '.')) || 0;
    }
    if (str.includes('.') && str.includes(',')) {
      // European format: 1.250,50
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  }

  /**
   * Maps Ticimax order status to KroptOS unified status.
   */
  public static mapToKroptosStatus(statusText?: string | number): 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' {
    const s = String(statusText || '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase()
      .trim();

    if (s.includes('iptal') || s.includes('cancel')) {
      return 'cancelled';
    }
    if (s.includes('iade') || s.includes('refund') || s.includes('return')) {
      return 'returned';
    }
    if (s.includes('teslim') || s.includes('delivered')) {
      return 'delivered';
    }
    if (s.includes('kargo') || s.includes('shipped') || s.includes('sevk')) {
      return 'shipped';
    }
    if (s.includes('bekliyor') || s.includes('waiting') || s.includes('yeni') || s.includes('new')) {
      return 'pending';
    }
    if (
      s.includes('hazır') ||
      s.includes('onay') ||
      s.includes('tedarik') ||
      s.includes('paket') ||
      s.includes('processing')
    ) {
      return 'processing';
    }

    // Default to pending for new / payment pending orders
    return 'pending';
  }

  /**
   * Maps Ticimax status to standard EcommerceOrderStatus.
   */
  public static mapOrderStatus(statusText?: string | number): EcommerceOrderStatus {
    const unified = this.mapToKroptosStatus(statusText);
    if (unified === 'cancelled') return 'cancelled';
    if (unified === 'delivered' || unified === 'returned') return 'closed';
    return 'open';
  }

  /**
   * Maps Ticimax status to standard EcommerceFulfillmentStatus.
   */
  public static mapFulfillmentStatus(statusText?: string | number): EcommerceFulfillmentStatus {
    const s = String(statusText || '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase()
      .trim();
    if (s.includes('teslim') || s.includes('delivered')) return 'delivered';
    if (s.includes('kargo') || s.includes('shipped') || s.includes('sevk')) return 'fulfilled';
    if (s.includes('iptal') || s.includes('cancel')) return 'cancelled';
    if (s.includes('iade') || s.includes('refund')) return 'restocked';
    return 'unfulfilled';
  }

  /**
   * Maps Ticimax payment status to standard EcommerceFinancialStatus.
   */
  public static mapFinancialStatus(
    paymentStatus?: string | number,
    orderStatus?: string | number,
  ): EcommerceFinancialStatus {
    const ps = String(paymentStatus || '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase()
      .trim();
    const os = String(orderStatus || '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase()
      .trim();

    if (os.includes('iade') || ps.includes('iade')) return 'refunded';
    if (os.includes('iptal') || ps.includes('iptal')) return 'voided';

    if (
      ps.includes('ödendi') ||
      ps.includes('odendi') ||
      ps.includes('paid') ||
      ps.includes('onay') ||
      ps === '1' ||
      os.includes('onay') ||
      os.includes('kargo') ||
      os.includes('teslim')
    ) {
      return 'paid';
    }

    return 'pending';
  }

  /**
   * Maps address fields to EcommerceAddress.
   */
  public static mapAddress(addr?: any): EcommerceAddress | undefined {
    if (!addr) return undefined;
    const fullName = [addr.AliciAdi, addr.AliciSoyadi].filter(Boolean).join(' ').trim() || undefined;
    return {
      fullName,
      firstName: addr.AliciAdi,
      lastName: addr.AliciSoyadi,
      phone: addr.Telefon || addr.Gsm,
      address1: addr.Adres || '',
      city: addr.Il || '',
      province: addr.Ilce,
      postalCode: addr.PostaKodu,
      country: addr.Ulke || 'TR',
    };
  }

  /**
   * Maps a TicimaxRawOrder to KroptOS unified EcommerceOrder.
   */
  public static toUnifiedOrder(raw: TicimaxRawOrder): EcommerceOrder {
    const currency = (raw.ParaBirimi || 'TRY').toUpperCase();
    const items: EcommerceOrderItem[] = (Array.isArray(raw.Urunler) ? raw.Urunler : raw.Urunler ? [raw.Urunler] : []).map(
      (item) => {
        const unitPrice = this.parseAmount(item.BirimFiyat);
        const qty = parseInt(String(item.Adet || 1), 10) || 1;
        const total = this.parseAmount(item.ToplamTutar) || unitPrice * qty;

        return {
          id: String(item.ID || item.UrunID || ''),
          productId: item.UrunID ? String(item.UrunID) : undefined,
          sku: item.StokKodu || String(item.UrunID || ''),
          barcode: item.Barkod,
          title: item.UrunAdi || 'Ürün',
          quantity: qty,
          unitPrice,
          totalPrice: total,
          currency,
        };
      },
    );

    const shippingAddress = this.mapAddress(raw.TeslimatAdresi);
    const billingAddress = this.mapAddress(raw.FaturaAdresi) || shippingAddress;
    const totalPrice = this.parseAmount(raw.GenelToplam || raw.ToplamTutar);
    const totalShipping = this.parseAmount(raw.KargoUcreti);
    const customerFullName = [raw.MusteriAdi, raw.MusteriSoyadi].filter(Boolean).join(' ').trim() ||
      shippingAddress?.fullName ||
      'Müşteri';

    const createdAt = raw.SiparisTarihi ? new Date(raw.SiparisTarihi) : new Date();
    const updatedAt = new Date();

    return {
      id: String(raw.ID || raw.SiparisID || ''),
      provider: 'TICIMAX',
      orderNumber: String(raw.SiparisNo || raw.ID || ''),
      orderStatus: this.mapOrderStatus(raw.Durum),
      financialStatus: this.mapFinancialStatus(raw.OdemeDurumu, raw.Durum),
      fulfillmentStatus: this.mapFulfillmentStatus(raw.Durum),
      currency,
      totalPrice,
      subtotalPrice: totalPrice > totalShipping ? totalPrice - totalShipping : totalPrice,
      totalTax: 0,
      totalShipping,
      totalDiscounts: 0,
      createdAt,
      updatedAt,
      customer: {
        id: raw.MusteriID ? String(raw.MusteriID) : undefined,
        email: raw.MusteriEmail,
        fullName: customerFullName,
        phone: raw.MusteriTelefon || raw.MusteriGsm || shippingAddress?.phone,
      },
      shippingAddress,
      billingAddress,
      items,
      rawPayload: raw.KargoTakipNo ? { trackingNumber: raw.KargoTakipNo, trackingCompany: raw.KargoFirmasi } : undefined,
    };
  }

  /**
   * Maps a TicimaxRawProduct to KroptOS unified EcommerceProduct.
   */
  public static toUnifiedProduct(raw: TicimaxRawProduct): EcommerceProduct {
    const rawVars = Array.isArray(raw.Varyasyonlar)
      ? raw.Varyasyonlar
      : raw.Varyasyonlar
      ? [raw.Varyasyonlar]
      : [];

    const productId = String(raw.UrunKartiID || '');
    const variants: EcommerceProductVariant[] = rawVars.map((v) => ({
      id: String(v.ID || v.VaryasyonID || productId),
      productId,
      sku: v.StokKodu || productId,
      barcode: v.Barkod,
      title: v.Tanim || raw.UrunAdi || 'Standart Varyant',
      price: this.parseAmount(v.SatisFiyati),
      currency: 'TRY',
      inventoryQuantity: parseInt(String(v.StokAdedi || 0), 10) || 0,
      requiresShipping: true,
    }));

    return {
      id: productId,
      provider: 'TICIMAX',
      title: raw.UrunAdi || 'Ürün',
      description: raw.Aciklama || raw.OnYazi,
      vendor: raw.MarkaAdi,
      productType: raw.KategoriAdi,
      status: raw.KartAktif === true || raw.KartAktif === '1' || raw.KartAktif === 1 ? 'active' : 'draft',
      variants: variants.length > 0 ? variants : [
        {
          id: productId,
          productId,
          sku: raw.TedarikciKodu || productId,
          title: 'Standart',
          price: 0,
          currency: 'TRY',
          inventoryQuantity: 0,
          requiresShipping: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
