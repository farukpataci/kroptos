import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { PazaramaOrder, PazaramaProduct } from './PazaramaTypes';

export class PazaramaMapper {
  static toUnifiedOrder(order: PazaramaOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.items.map((item) => ({
      sku: item.stockCode,
      name: item.productName || 'Pazarama Product',
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));

    let status = 'pending';
    if (order.status === 'New' || order.status === 'Preparing') status = 'pending';
    else if (order.status === 'Shipped') status = 'shipped';
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
      source: 'pazarama',
      items,
    };
  }

  static toUnifiedProduct(product: PazaramaProduct): MarketplaceProduct {
    return {
      sku: product.code,
      name: product.name,
      description: product.description,
      price: product.salePrice,
      stockQuantity: product.stockCount,
      image: product.image,
      barcode: product.barcode,
    };
  }
}
