import { MarketplaceOrder, MarketplaceProduct, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { N11Order, N11Product } from './N11Types';

export class N11Mapper {
  static toUnifiedOrder(order: N11Order): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.orderItemList.orderItem.map((item) => ({
      sku: item.productSellerCode,
      name: item.productName || 'N11 Product',
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));

    let status = 'pending';
    if (order.status === 1) status = 'pending';
    else if (order.status === 2) status = 'shipped';
    else if (order.status === 3) status = 'delivered';
    else if (order.status === 4) status = 'cancelled';

    return {
      orderNumber: order.orderNumber,
      customerName: order.buyer.fullName,
      customerEmail: order.buyer.email,
      customerPhone: order.buyer.gsm,
      shippingAddress: `${order.shippingAddress.address}, ${order.shippingAddress.district}, ${order.shippingAddress.city}`,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: order.totalPrice,
      currency: order.currency || 'TRY',
      source: 'n11',
      items,
    };
  }

  static toUnifiedProduct(product: N11Product): MarketplaceProduct {
    return {
      sku: product.stockCode,
      name: product.title,
      description: product.description,
      price: product.salePrice,
      stockQuantity: product.stockQuantity,
      image: product.image,
      barcode: product.gtin,
    };
  }
}
