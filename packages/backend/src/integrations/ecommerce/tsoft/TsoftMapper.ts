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
import {
  TsoftRawAddress,
  TsoftRawOrder,
  TsoftRawOrderItem,
  TsoftRawProduct,
  TsoftRawVariation,
} from './TsoftTypes';

export class TsoftMapper {
  /**
   * Parses amounts formatted with decimals or commas.
   */
  public static parseAmount(value: unknown): number {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    const str = String(value).trim();
    if (str.includes(',') && !str.includes('.')) {
      return parseFloat(str.replace(',', '.')) || 0;
    }
    if (str.includes('.') && str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  }

  /**
   * Maps T-Soft status to KroptOS unified status.
   */
  public static mapToKroptosStatus(
    statusText?: string | number,
  ): 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' {
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

    return 'pending';
  }

  public static mapOrderStatus(statusText?: string | number): EcommerceOrderStatus {
    const unified = this.mapToKroptosStatus(statusText);
    if (unified === 'cancelled') return 'cancelled';
    if (unified === 'delivered' || unified === 'returned') return 'closed';
    return 'open';
  }

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

  public static mapAddress(addr?: TsoftRawAddress): EcommerceAddress | undefined {
    if (!addr) return undefined;
    const fullName = addr.Name?.trim() || undefined;
    return {
      fullName,
      phone: addr.Phone || addr.Mobile,
      address1: addr.Address || '',
      city: addr.City || '',
      province: addr.District,
      postalCode: addr.PostalCode,
      country: addr.Country || 'TR',
    };
  }

  /**
   * Maps TsoftRawOrder to EcommerceOrder.
   */
  public static toUnifiedOrder(raw: TsoftRawOrder): EcommerceOrder {
    const currency = (raw.Currency || 'TRY').toUpperCase();
    const rawItems = Array.isArray(raw.OrderDetails)
      ? raw.OrderDetails
      : raw.OrderDetails
      ? [raw.OrderDetails]
      : [];

    const items: EcommerceOrderItem[] = rawItems.map((item: TsoftRawOrderItem) => {
      const unitPrice = this.parseAmount(item.Price);
      const qty = parseInt(String(item.Quantity || 1), 10) || 1;
      const total = unitPrice * qty;

      return {
        id: String(item.OrderDetailId || item.ProductId || ''),
        productId: item.ProductId ? String(item.ProductId) : undefined,
        sku: item.ProductCode || String(item.ProductId || ''),
        barcode: item.Barcode,
        title: item.ProductName || 'Ürün',
        quantity: qty,
        unitPrice,
        totalPrice: total,
        currency,
      };
    });

    const shippingAddress = this.mapAddress(raw.ShippingAddress);
    const billingAddress = this.mapAddress(raw.BillingAddress) || shippingAddress;
    const totalPrice = this.parseAmount(raw.Total);
    const totalShipping = this.parseAmount(raw.CargoPrice);
    const customerFullName =
      raw.CustomerName ||
      shippingAddress?.fullName ||
      'Müşteri';

    const createdAt = raw.OrderDate ? new Date(raw.OrderDate) : new Date();

    return {
      id: String(raw.OrderId || ''),
      provider: 'TSOFT',
      orderNumber: String(raw.OrderCode || raw.OrderId || ''),
      orderStatus: this.mapOrderStatus(raw.OrderStatus),
      financialStatus: this.mapFinancialStatus(raw.PaymentStatus, raw.OrderStatus),
      fulfillmentStatus: this.mapFulfillmentStatus(raw.OrderStatus),
      currency,
      totalPrice,
      subtotalPrice: totalPrice > totalShipping ? totalPrice - totalShipping : totalPrice,
      totalTax: 0,
      totalShipping,
      totalDiscounts: 0,
      createdAt,
      updatedAt: new Date(),
      customer: {
        id: raw.CustomerId ? String(raw.CustomerId) : undefined,
        email: raw.CustomerEmail,
        fullName: customerFullName,
        phone: raw.CustomerPhone || raw.CustomerMobile || shippingAddress?.phone,
      },
      shippingAddress,
      billingAddress,
      items,
      rawPayload: raw.CargoTrackingCode
        ? { trackingNumber: raw.CargoTrackingCode, trackingCompany: raw.CargoCompany }
        : undefined,
    };
  }

  /**
   * Maps TsoftRawProduct to EcommerceProduct.
   */
  public static toUnifiedProduct(raw: TsoftRawProduct): EcommerceProduct {
    const productId = String(raw.ProductId || '');
    let variations: TsoftRawVariation[] = [];

    if (Array.isArray(raw.SubProducts)) {
      variations = raw.SubProducts;
    } else if (raw.SubProducts && typeof raw.SubProducts === 'object') {
      variations = Object.values(raw.SubProducts);
    }

    const variants: EcommerceProductVariant[] = variations.map((v) => ({
      id: String(v.SubProductId || v.VariantId || productId),
      productId,
      sku: v.Code || raw.ProductCode || productId,
      barcode: v.Barcode || raw.Barcode,
      title: v.Property || raw.ProductName || 'Standart Varyant',
      price: this.parseAmount(v.SellingPrice ?? v.Price ?? raw.SellingPrice ?? raw.Price),
      currency: (raw.Currency || 'TRY').toUpperCase(),
      inventoryQuantity: parseInt(String(v.Stock || 0), 10) || 0,
      requiresShipping: true,
    }));

    return {
      id: productId,
      provider: 'TSOFT',
      title: raw.ProductName || 'Ürün',
      description: raw.Description || raw.ShortDescription,
      vendor: raw.Brand,
      productType: raw.CategoryName,
      status: raw.IsActive === true || raw.IsActive === '1' || raw.IsActive === 1 ? 'active' : 'draft',
      variants: variants.length > 0 ? variants : [
        {
          id: productId,
          productId,
          sku: raw.ProductCode || productId,
          barcode: raw.Barcode,
          title: 'Standart',
          price: this.parseAmount(raw.SellingPrice ?? raw.Price),
          currency: (raw.Currency || 'TRY').toUpperCase(),
          inventoryQuantity: parseInt(String(raw.Stock || 0), 10) || 0,
          requiresShipping: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
