import { MarketplaceOrder, MarketplaceProduct, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { HepsiburadaOrder, HepsiburadaProduct } from './HepsiburadaTypes';

export class HepsiburadaMapper {
  static toUnifiedOrder(order: HepsiburadaOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.items.map((item) => ({
      sku: item.sku,
      name: item.name || 'Hepsiburada Product',
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));

    let status = 'pending';
    if (order.status === 'Open') status = 'pending';
    else if (order.status === 'Shipped') status = 'shipped';
    else if (order.status === 'Delivered') status = 'delivered';
    else if (order.status === 'Cancelled') status = 'cancelled';

    return {
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone,
      shippingAddress: `${order.shippingAddress.address}, ${order.shippingAddress.town}, ${order.shippingAddress.city}`,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: order.totalAmount,
      currency: order.currency || 'TRY',
      source: 'hepsiburada',
      items,
    };
  }

  static toUnifiedProduct(product: HepsiburadaProduct): MarketplaceProduct {
    return {
      sku: product.merchantSku,
      name: product.name,
      description: product.description,
      price: product.price,
      stockQuantity: product.stock,
      image: product.image,
      barcode: product.barcode,
    };
  }
}
