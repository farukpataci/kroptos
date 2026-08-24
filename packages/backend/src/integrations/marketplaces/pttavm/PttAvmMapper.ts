import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { PttAvmOrder, PttAvmProduct } from './PttAvmTypes';

export class PttAvmMapper {
  static toUnifiedOrder(order: PttAvmOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.items.map((item) => ({
      sku: item.stockCode,
      name: item.productName || 'PttAVM Product',
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));

    let status = 'pending';
    if (order.status === 'Shipped') status = 'shipped';
    else if (order.status === 'Delivered') status = 'delivered';
    else if (order.status === 'Cancelled') status = 'cancelled';

    return {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: `${order.address}, ${order.district}, ${order.city}`,
      shippingFullName: order.customerName,
      shippingPhone: order.customerPhone,
      shippingLine1: order.address,
      shippingLine2: order.neighborhood,
      shippingDistrict: order.district,
      shippingCity: order.city,
      shippingPostalCode: order.postalCode,
      shippingCountryCode: 'TR',
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: order.totalPrice,
      currency: order.currency || 'TRY',
      source: 'pttavm',
      items,
    };
  }

  static toUnifiedProduct(product: PttAvmProduct): MarketplaceProduct {
    return {
      sku: product.stockCode,
      name: product.name,
      description: product.description,
      price: product.price,
      stockQuantity: product.quantity,
      image: product.image,
      barcode: product.barcode,
    };
  }
}
