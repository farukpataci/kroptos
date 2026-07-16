import { MarketplaceOrder, MarketplaceProduct, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { TrendyolOrder, TrendyolProduct } from './TrendyolTypes';

export class TrendyolMapper {
  static toUnifiedOrder(order: TrendyolOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.lines.map((line) => ({
      sku: line.sku || line.barcode,
      name: line.productName || 'Trendyol Product',
      quantity: line.quantity,
      unitPrice: line.price,
      totalPrice: line.price * line.quantity,
    }));

    let status = 'pending';
    if (order.status === 'Created') status = 'pending';
    else if (order.status === 'Shipped') status = 'shipped';
    else if (order.status === 'Delivered') status = 'delivered';
    else if (order.status === 'Cancelled') status = 'cancelled';

    return {
      orderNumber: order.orderNumber,
      customerName: `${order.customerFirstName} ${order.customerLastName}`,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: `${order.shipmentAddress.address1}, ${order.shipmentAddress.city}, ${order.shipmentAddress.country}`,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: order.totalPrice,
      currency: order.currency || 'TRY',
      source: 'trendyol',
      items,
    };
  }

  static toUnifiedProduct(product: TrendyolProduct): MarketplaceProduct {
    return {
      sku: product.stockCode,
      name: product.title,
      description: product.description,
      price: product.salePrice,
      stockQuantity: product.quantity,
      image: product.images?.[0]?.url,
      barcode: product.barcode,
    };
  }
}
