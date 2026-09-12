import {
  EcommerceFinancialStatus,
  EcommerceFulfillmentStatus,
  EcommerceOrder,
  EcommerceOrderItem,
  EcommerceOrderStatus,
  EcommerceProduct,
} from '../core/EcommerceTypes';
import {
  IdeasoftAddress,
  IdeasoftRawOrder,
  IdeasoftRawProduct,
} from './IdeasoftTypes';

export class IdeasoftMapper {
  /**
   * Safely parses monetary value into number.
   */
  static parseAmount(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    let clean = String(value).trim();
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }

  /**
   * Maps IdeaSoft status to unified EcommerceOrderStatus ('open' | 'closed' | 'cancelled' | 'archived').
   */
  static mapOrderStatus(statusStr?: string): EcommerceOrderStatus {
    const s = String(statusStr ?? '').trim().toLowerCase();
    switch (s) {
      case 'cancelled':
      case 'iptal':
      case 'iptal_edildi':
        return 'cancelled';
      case 'delivered':
      case 'tamamlandi':
      case 'teslim_edildi':
      case 'refunded':
      case 'iade':
        return 'closed';
      case 'archived':
        return 'archived';
      case 'new':
      case 'waiting_approval':
      case 'waiting_payment':
      case 'approved':
      case 'preparing':
      case 'shipped':
      default:
        return 'open';
    }
  }

  /**
   * Maps IdeaSoft specific status to standard KroptOS Order status string ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned').
   */
  static mapToKroptosStatus(statusStr?: string): string {
    const s = String(statusStr ?? '').trim().toLowerCase();
    switch (s) {
      case 'new':
      case 'waiting_approval':
      case 'waiting_payment':
      case 'beklemede':
        return 'pending';
      case 'approved':
      case 'preparing':
      case 'hazirlaniyor':
      case 'onaylandi':
        return 'processing';
      case 'shipped':
      case 'kargolandi':
      case 'kargoda':
        return 'shipped';
      case 'delivered':
      case 'tamamlandi':
      case 'teslim_edildi':
        return 'delivered';
      case 'cancelled':
      case 'iptal':
      case 'iptal_edildi':
        return 'cancelled';
      case 'refunded':
      case 'iade':
      case 'iade_edildi':
        return 'returned';
      default:
        return 'pending';
    }
  }

  /**
   * Maps financial status.
   */
  static mapFinancialStatus(statusStr?: string, orderStatus?: string): EcommerceFinancialStatus {
    const s = String(statusStr ?? '').trim().toLowerCase();
    if (s === 'paid' || s === 'odendi' || orderStatus === 'delivered' || orderStatus === 'shipped') {
      return 'paid';
    }
    if (s === 'refunded' || s === 'iade') {
      return 'refunded';
    }
    return 'pending';
  }

  /**
   * Maps fulfillment status.
   */
  static mapFulfillmentStatus(statusStr?: string): EcommerceFulfillmentStatus {
    const s = String(statusStr ?? '').trim().toLowerCase();
    if (s === 'delivered' || s === 'shipped' || s === 'kargolandi') {
      return 'fulfilled';
    }
    if (s === 'preparing' || s === 'hazirlaniyor') {
      return 'partially_fulfilled';
    }
    return 'unfulfilled';
  }

  /**
   * Formats structured address.
   */
  static mapAddress(addr?: IdeasoftAddress) {
    if (!addr) return undefined;
    const fullName = `${addr.firstname || ''} ${addr.surname || ''}`.trim() || undefined;
    return {
      fullName,
      firstName: addr.firstname,
      lastName: addr.surname,
      phone: addr.phoneNumber || addr.mobilePhoneNumber || undefined,
      address1: addr.address || '',
      city: addr.city || '',
      province: addr.district || undefined,
      postalCode: addr.postcode || undefined,
      country: addr.country || 'TR',
    };
  }

  /**
   * Transforms raw IdeaSoft order to EcommerceOrder.
   */
  static toEcommerceOrder(order: IdeasoftRawOrder): EcommerceOrder {
    const shippingAddr = this.mapAddress(order.shippingAddress);
    const billingAddr = this.mapAddress(order.billingAddress);
    const customerFullName = `${order.customerFirstname || ''} ${order.customerSurname || ''}`.trim() ||
      shippingAddr?.fullName ||
      'Müşteri';

    const items: EcommerceOrderItem[] = (order.orderItems || []).map((item) => {
      const unitPrice = this.parseAmount(item.productPrice);
      const qty = Number(item.orderQuantity) || 1;
      const total = this.parseAmount(item.totalPrice) || (unitPrice * qty);

      return {
        id: String(item.id),
        productId: item.productId ? String(item.productId) : undefined,
        title: item.productName || 'Ürün',
        sku: item.productSku || String(item.productId || item.id),
        barcode: item.productBarcode || undefined,
        quantity: qty,
        unitPrice,
        totalPrice: total,
        currency: String(order.currency || 'TRY').toUpperCase(),
      };
    });

    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const updatedAt = order.updatedAt ? new Date(order.updatedAt) : createdAt;

    return {
      id: String(order.id),
      orderNumber: order.orderNumber || String(order.id),
      provider: 'IDEASOFT',
      orderStatus: this.mapOrderStatus(order.status),
      financialStatus: this.mapFinancialStatus(order.paymentStatus, order.status),
      fulfillmentStatus: this.mapFulfillmentStatus(order.status),
      currency: String(order.currency || 'TRY').toUpperCase(),
      totalPrice: this.parseAmount(order.finalPrice ?? order.totalPrice),
      subtotalPrice: this.parseAmount(order.totalPrice),
      totalTax: 0,
      totalShipping: 0,
      totalDiscounts: 0,
      customer: {
        id: undefined,
        fullName: customerFullName,
        email: order.customerEmail || undefined,
        phone: order.customerPhone || shippingAddr?.phone || undefined,
      },
      shippingAddress: shippingAddr,
      billingAddress: billingAddr,
      items,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Transforms raw IdeaSoft product to EcommerceProduct.
   */
  static toEcommerceProduct(product: IdeasoftRawProduct): EcommerceProduct {
    const createdAt = product.createdAt ? new Date(product.createdAt) : new Date();
    const updatedAt = product.updatedAt ? new Date(product.updatedAt) : createdAt;

    const currencyStr = typeof product.currency === 'object' ? (product.currency?.abbr || 'TRY') : (product.currency || 'TRY');

    return {
      id: String(product.id),
      provider: 'IDEASOFT',
      title: product.name,
      status: product.status ? 'active' : 'draft',
      variants: [
        {
          id: String(product.id),
          productId: String(product.id),
          title: product.name,
          currency: String(currencyStr).toUpperCase(),
          sku: product.sku || String(product.id),
          barcode: product.barcode || undefined,
          price: this.parseAmount(product.price1),
          inventoryQuantity: typeof product.stockAmount === 'number' ? product.stockAmount : 0,
        },
      ],
      createdAt,
      updatedAt,
    };
  }
}
