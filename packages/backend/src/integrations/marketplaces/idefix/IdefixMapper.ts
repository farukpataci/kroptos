import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { IdefixOrder, IdefixProduct } from './IdefixTypes';

export class IdefixMapper {
  static toUnifiedOrder(order: IdefixOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.items.map((item) => ({
      sku: item.merchantSku,
      name: item.productName || 'idefix Product',
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
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: order.totalPrice,
      currency: order.currency || 'TRY',
      source: 'idefix',
      items,
    };
  }

  static toUnifiedProduct(product: IdefixProduct): MarketplaceProduct {
    return {
      sku: product.merchantSku,
      name: product.title,
      description: product.description,
      price: product.salePrice,
      stockQuantity: product.quantity,
      image: product.image,
      barcode: product.barcode,
    };
  }
}
