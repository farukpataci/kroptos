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
  OpencartRawOrder,
  OpencartRawOrderProduct,
  OpencartRawProduct,
} from './OpencartTypes';

export class OpencartMapper {
  /**
   * Safely parses monetary values from string or number representations.
   */
  public static parseAmount(val: unknown): number {
    if (typeof val === 'number') {
      return Number.isFinite(val) ? val : 0;
    }
    if (!val) return 0;

    let s = String(val).trim();
    s = s.replace(/[^0-9.,-]/g, '');

    if (s.includes('.') && s.includes(',')) {
      if (s.indexOf('.') < s.indexOf(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Normalizes Turkish characters and lowercases safely.
   */
  public static normalizeTurkishText(val: string): string {
    return val
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase();
  }

  /**
   * Maps OpenCart order status ID or textual name into unified status keyword.
   */
  public static mapToKroptosStatus(
    statusId?: string | number,
    statusName?: string,
  ): 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' {
    const id = Number(statusId);

    // Standard OpenCart Status IDs
    switch (id) {
      case 1:
        return 'pending'; // Pending
      case 2:
      case 15:
        return 'processing'; // Processing / Processed
      case 3:
        return 'shipped'; // Shipped
      case 5:
        return 'delivered'; // Complete
      case 7:
      case 9:
      case 14:
      case 16:
        return 'cancelled'; // Canceled / Expired / Voided
      case 11:
      case 12:
        return 'returned'; // Refunded / Reversed
      case 10:
        return 'cancelled'; // Failed
    }

    if (!statusName) return 'pending';

    const s = this.normalizeTurkishText(statusName);

    if (s.includes('iptal') || s.includes('cancel') || s.includes('void')) {
      return 'cancelled';
    }
    if (s.includes('iade') || s.includes('refund') || s.includes('reverse')) {
      return 'returned';
    }
    if (s.includes('teslim') || s.includes('tamam') || s.includes('delivered') || s.includes('complete')) {
      return 'delivered';
    }
    if (s.includes('kargo') || s.includes('shipped') || s.includes('sevk')) {
      return 'shipped';
    }
    if (s.includes('bekliyor') || s.includes('pending') || s.includes('beklemede')) {
      return 'pending';
    }
    if (
      s.includes('onay') ||
      s.includes('hazır') ||
      s.includes('işlen') ||
      s.includes('processing') ||
      s.includes('confirmed')
    ) {
      return 'processing';
    }

    return 'pending';
  }

  public static mapOrderStatus(
    statusId?: string | number,
    statusName?: string,
  ): EcommerceOrderStatus {
    const unified = this.mapToKroptosStatus(statusId, statusName);
    if (unified === 'cancelled') return 'cancelled';
    if (unified === 'delivered' || unified === 'returned') return 'closed';
    return 'open';
  }

  public static mapFulfillmentStatus(
    statusId?: string | number,
    statusName?: string,
  ): EcommerceFulfillmentStatus {
    const unified = this.mapToKroptosStatus(statusId, statusName);
    if (unified === 'delivered') return 'delivered';
    if (unified === 'shipped') return 'fulfilled';
    if (unified === 'cancelled') return 'cancelled';
    if (unified === 'returned') return 'restocked';
    return 'unfulfilled';
  }

  public static mapFinancialStatus(
    statusId?: string | number,
    statusName?: string,
  ): EcommerceFinancialStatus {
    const id = Number(statusId);
    if (id === 11 || id === 12) return 'refunded';
    if (id === 7 || id === 9 || id === 14 || id === 16 || id === 10) return 'voided';
    if (id === 2 || id === 3 || id === 5 || id === 15) return 'paid';

    const s = this.normalizeTurkishText(statusName || '');
    if (s.includes('iade') || s.includes('refund')) return 'refunded';
    if (s.includes('iptal') || s.includes('cancel')) return 'voided';
    if (
      s.includes('ödendi') ||
      s.includes('paid') ||
      s.includes('onay') ||
      s.includes('kargo') ||
      s.includes('teslim')
    ) {
      return 'paid';
    }

    return 'pending';
  }

  /**
   * Transforms raw OpenCart order into unified EcommerceOrder.
   */
  public static toUnifiedOrder(raw: OpencartRawOrder): EcommerceOrder {
    const orderId = String(raw.order_id);
    const invoiceNumber =
      raw.invoice_prefix && raw.invoice_no
        ? `${raw.invoice_prefix}${raw.invoice_no}`
        : orderId;

    const totalPrice = this.parseAmount(raw.total);
    const currency = (raw.currency_code || 'TRY').toUpperCase();

    const createdAt = raw.date_added ? new Date(raw.date_added) : new Date();
    const updatedAt = raw.date_modified ? new Date(raw.date_modified) : createdAt;

    const shippingAddress: EcommerceAddress | undefined = raw.shipping_address_1
      ? {
          firstName: raw.shipping_firstname || raw.firstname,
          lastName: raw.shipping_lastname || raw.lastname,
          fullName: `${raw.shipping_firstname || raw.firstname || ''} ${raw.shipping_lastname || raw.lastname || ''}`.trim() || undefined,
          company: raw.shipping_company,
          address1: raw.shipping_address_1,
          address2: raw.shipping_address_2,
          city: raw.shipping_zone || raw.shipping_city || '',
          province: raw.shipping_city,
          postalCode: raw.shipping_postcode,
          country: raw.shipping_country || 'Türkiye',
          countryCode: raw.shipping_zone_code,
          phone: raw.telephone,
        }
      : undefined;

    const billingAddress: EcommerceAddress | undefined = raw.payment_address_1
      ? {
          firstName: raw.payment_firstname || raw.firstname,
          lastName: raw.payment_lastname || raw.lastname,
          fullName: `${raw.payment_firstname || raw.firstname || ''} ${raw.payment_lastname || raw.lastname || ''}`.trim() || undefined,
          company: raw.payment_company,
          address1: raw.payment_address_1,
          address2: raw.payment_address_2,
          city: raw.payment_zone || raw.payment_city || '',
          province: raw.payment_city,
          postalCode: raw.payment_postcode,
          country: raw.payment_country || 'Türkiye',
          countryCode: raw.payment_zone_code,
          phone: raw.telephone,
        }
      : shippingAddress;

    const rawProducts = raw.products || [];
    const items: EcommerceOrderItem[] = rawProducts.map((p, idx) => {
      const quantity = typeof p.quantity === 'number' ? p.quantity : parseInt(String(p.quantity), 10) || 1;
      const unitPrice = this.parseAmount(p.price);
      const total = p.total ? this.parseAmount(p.total) : unitPrice * quantity;

      return {
        id: String(p.order_product_id || `${orderId}_${idx + 1}`),
        productId: String(p.product_id),
        sku: p.model || String(p.product_id),
        title: p.name || 'Ürün',
        quantity,
        unitPrice,
        totalPrice: total,
        currency,
        taxAmount: p.tax ? this.parseAmount(p.tax) : 0,
        variantTitle:
          p.options && p.options.length > 0
            ? p.options.map((o) => `${o.name}: ${o.value}`).join(', ')
            : undefined,
      };
    });

    return {
      id: orderId,
      provider: 'OPENCART',
      orderNumber: invoiceNumber,
      orderStatus: this.mapOrderStatus(raw.order_status_id, raw.order_status),
      financialStatus: this.mapFinancialStatus(raw.order_status_id, raw.order_status),
      fulfillmentStatus: this.mapFulfillmentStatus(raw.order_status_id, raw.order_status),
      currency,
      totalPrice,
      subtotalPrice: totalPrice,
      totalTax: 0,
      totalShipping: 0,
      totalDiscounts: 0,
      createdAt,
      updatedAt,
      customer: {
        id: raw.customer_id ? String(raw.customer_id) : undefined,
        firstName: raw.firstname,
        lastName: raw.lastname,
        fullName: `${raw.firstname || ''} ${raw.lastname || ''}`.trim() || undefined,
        email: raw.email,
        phone: raw.telephone,
      },
      shippingAddress,
      billingAddress,
      items,
      notes: raw.comment || undefined,
      rawPayload: raw as unknown as Record<string, unknown>,
    };
  }

  /**
   * Transforms raw OpenCart product into unified EcommerceProduct.
   */
  public static toUnifiedProduct(raw: OpencartRawProduct, baseUrl?: string): EcommerceProduct {
    const id = String(raw.product_id);
    const title = raw.name || 'İsimsiz Ürün';
    const sku = raw.sku || raw.model || id;
    const barcode = raw.ean || raw.upc || undefined;
    const price = this.parseAmount(raw.special || raw.price);
    const compareAtPrice = raw.special ? this.parseAmount(raw.price) : undefined;
    const quantity = typeof raw.quantity === 'number' ? raw.quantity : parseInt(String(raw.quantity), 10) || 0;

    let imageUrl: string | undefined;
    if (raw.image) {
      if (raw.image.startsWith('http://') || raw.image.startsWith('https://')) {
        imageUrl = raw.image;
      } else if (baseUrl) {
        imageUrl = `${baseUrl.replace(/\/+$/, '')}/image/${raw.image.replace(/^\/+/, '')}`;
      } else {
        imageUrl = raw.image;
      }
    }

    const variants: EcommerceProductVariant[] = [];
    if (raw.options && raw.options.length > 0) {
      for (const opt of raw.options) {
        if (opt.product_option_value && opt.product_option_value.length > 0) {
          for (const val of opt.product_option_value) {
            const varQty = typeof val.quantity === 'number' ? val.quantity : parseInt(String(val.quantity), 10) || 0;
            const extraPrice = val.price ? this.parseAmount(val.price) : 0;
            const varPrice = val.price_prefix === '-' ? Math.max(0, price - extraPrice) : price + extraPrice;

            variants.push({
              id: String(val.product_option_value_id),
              productId: id,
              title: `${opt.name}: ${val.name}`,
              sku: val.sku || `${sku}-${val.product_option_value_id}`,
              price: varPrice,
              compareAtPrice,
              currency: 'TRY',
              inventoryQuantity: varQty,
            });
          }
        }
      }
    }

    if (variants.length === 0) {
      variants.push({
        id,
        productId: id,
        sku,
        barcode,
        title,
        price,
        compareAtPrice,
        currency: 'TRY',
        inventoryQuantity: quantity,
      });
    }

    return {
      id,
      provider: 'OPENCART',
      title,
      description: raw.description,
      status: String(raw.status) === '1' ? 'active' : 'draft',
      variants,
      images: imageUrl ? [imageUrl] : [],
      createdAt: raw.date_added ? new Date(raw.date_added) : new Date(),
      updatedAt: raw.date_modified ? new Date(raw.date_modified) : new Date(),
      rawPayload: raw as unknown as Record<string, unknown>,
    };
  }
}
