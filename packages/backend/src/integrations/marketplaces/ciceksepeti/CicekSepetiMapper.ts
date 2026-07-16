import { MarketplaceOrder, MarketplaceProduct, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { CicekSepetiOrder, CicekSepetiProduct } from './CicekSepetiTypes';

export class CicekSepetiMapper {
  static toUnifiedOrder(order: CicekSepetiOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.items.map((item) => ({
      sku: item.variantCode,
      name: item.name || 'CicekSepeti Product',
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));

    let status = 'pending';
    if (order.status === 'Created') status = 'pending';
    else if (order.status === 'Shipped') status = 'shipped';
    else if (order.status === 'Delivered') status = 'delivered';
    else if (order.status === 'Cancelled') status = 'cancelled';

    return {
      orderNumber: order.orderCode,
      customerName: order.receiverName,
      customerPhone: order.receiverPhone,
      shippingAddress: `${order.address}, ${order.district}, ${order.city}`,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: order.totalPrice,
      currency: order.currency || 'TRY',
      source: 'ciceksepeti',
      items,
    };
  }

  static toUnifiedProduct(product: CicekSepetiProduct): MarketplaceProduct {
    return {
      sku: product.stockCode,
      name: product.name,
      description: product.description,
      price: product.price,
      stockQuantity: product.stock,
      image: product.mainImage,
      barcode: product.barcode,
    };
  }
}
