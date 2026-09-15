import {
  EcommerceAddress,
  EcommerceCustomer,
  EcommerceFinancialStatus,
  EcommerceFulfillmentStatus,
  EcommerceOrder,
  EcommerceOrderItem,
  EcommerceOrderStatus,
  EcommerceProduct,
  EcommerceProductVariant,
} from '../core/EcommerceTypes';
import {
  IkasRawAddress,
  IkasRawCustomer,
  IkasRawOrder,
  IkasRawOrderLineItem,
  IkasRawProduct,
  IkasRawVariant,
} from './IkasTypes';

export class IkasMapper {
  public static mapOrderStatus(status: string): EcommerceOrderStatus {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'CANCELLED':
      case 'CANCELED':
      case 'FAILED':
        return 'cancelled';
      case 'DELIVERED':
        return 'closed';
      case 'WAITING_FOR_PAYMENT':
      case 'WAITING_FOR_SHIPMENT':
      case 'PREPARING':
      case 'SHIPPED':
      case 'PARTIALLY_SHIPPED':
      default:
        return 'open';
    }
  }

  public static mapFinancialStatus(status?: string): EcommerceFinancialStatus {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'PAID':
        return 'paid';
      case 'REFUNDED':
        return 'refunded';
      case 'PARTIALLY_REFUNDED':
        return 'partially_refunded';
      case 'WAITING':
      case 'PENDING':
      default:
        return 'pending';
    }
  }

  public static mapFulfillmentStatus(status: string): EcommerceFulfillmentStatus {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'DELIVERED':
        return 'delivered';
      case 'SHIPPED':
        return 'in_transit';
      case 'PARTIALLY_SHIPPED':
        return 'partially_fulfilled';
      case 'CANCELLED':
      case 'CANCELED':
        return 'cancelled';
      case 'WAITING_FOR_SHIPMENT':
      case 'PREPARING':
      default:
        return 'unfulfilled';
    }
  }

  public static mapCustomer(raw?: IkasRawCustomer): EcommerceCustomer | undefined {
    if (!raw) return undefined;
    const fullName = [raw.firstName, raw.lastName].filter(Boolean).join(' ') || undefined;
    return {
      id: raw.id,
      firstName: raw.firstName,
      lastName: raw.lastName,
      fullName,
      email: raw.email,
      phone: raw.phone,
    };
  }

  public static mapAddress(raw?: IkasRawAddress): EcommerceAddress | undefined {
    if (!raw) return undefined;
    const fullName = [raw.firstName, raw.lastName].filter(Boolean).join(' ') || undefined;
    return {
      firstName: raw.firstName,
      lastName: raw.lastName,
      fullName,
      address1: raw.address1 || '',
      address2: raw.address2,
      city: raw.city || '',
      province: raw.district,
      postalCode: raw.postalCode,
      country: raw.country || 'Türkiye',
      countryCode: raw.countryCode || 'TR',
      phone: raw.phone,
    };
  }

  public static mapOrderItem(raw: IkasRawOrderLineItem, currency: string): EcommerceOrderItem {
    const qty = Number(raw.quantity) || 1;
    const unitPrice = Number(raw.price) || 0;
    const totalPrice = Number(raw.finalPrice ?? unitPrice * qty);

    return {
      id: raw.id,
      productId: raw.productId,
      variantId: raw.variantId,
      sku: raw.sku,
      barcode: raw.barcode,
      title: raw.name,
      variantTitle: raw.variantName,
      quantity: qty,
      unitPrice,
      totalPrice,
      currency,
      taxAmount: raw.taxRatio ? (totalPrice * raw.taxRatio) / 100 : undefined,
      discountAmount: raw.discountAmount,
      weightGrams: raw.weight,
    };
  }

  public static toEcommerceOrder(raw: IkasRawOrder): EcommerceOrder {
    const currency = raw.currency || 'TRY';
    const lines = raw.orderLineItems || raw.orderLines || [];
    const items = lines.map((line) => this.mapOrderItem(line, currency));

    return {
      id: raw.id,
      orderNumber: raw.orderNumber,
      provider: 'IKAS',
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
      orderStatus: this.mapOrderStatus(raw.orderStatus),
      financialStatus: this.mapFinancialStatus(raw.paymentStatus),
      fulfillmentStatus: this.mapFulfillmentStatus(raw.orderStatus),
      currency,
      totalPrice: Number(raw.totalPrice) || 0,
      subtotalPrice: Number(raw.subTotalPrice) || Number(raw.totalPrice) || 0,
      totalTax: Number(raw.totalTax) || 0,
      totalShipping: Number(raw.totalShippingPrice) || 0,
      totalDiscounts: Number(raw.totalDiscountPrice) || 0,
      customer: this.mapCustomer(raw.customer),
      shippingAddress: this.mapAddress(raw.shippingAddress),
      billingAddress: this.mapAddress(raw.billingAddress),
      items,
      notes: raw.customerNote,
      rawPayload: raw as unknown as Record<string, unknown>,
    };
  }

  public static mapVariant(raw: IkasRawVariant, currency: string): EcommerceProductVariant {
    return {
      id: raw.id,
      productId: raw.productId,
      sku: raw.sku,
      barcode: raw.barcode,
      title: raw.name || 'Standart',
      price: Number(raw.price) || 0,
      compareAtPrice: raw.discountPrice ? Number(raw.price) : undefined,
      currency,
      inventoryQuantity: Number(raw.stock ?? raw.inventoryQuantity ?? 0),
      weightGrams: raw.weight,
    };
  }

  public static toEcommerceProduct(raw: IkasRawProduct): EcommerceProduct {
    const brandName = typeof raw.brand === 'object' ? raw.brand?.name : raw.brand;
    const variants: EcommerceProductVariant[] = (raw.variants || []).map((v) =>
      this.mapVariant(v, 'TRY'),
    );

    const images: string[] = (raw.images || [])
      .map((img) => (typeof img === 'string' ? img : img.url))
      .filter(Boolean);

    let status: 'active' | 'draft' | 'archived' = 'active';
    if (raw.status === 'DRAFT') status = 'draft';
    if (raw.status === 'ARCHIVED') status = 'archived';

    return {
      id: raw.id,
      provider: 'IKAS',
      title: raw.name,
      description: raw.description,
      vendor: brandName,
      status,
      variants,
      images,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
      rawPayload: raw as unknown as Record<string, unknown>,
    };
  }
}
