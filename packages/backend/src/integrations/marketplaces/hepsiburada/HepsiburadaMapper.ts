import { MarketplaceOrder, MarketplaceProduct, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { HepsiburadaOrder, HepsiburadaProduct } from './HepsiburadaTypes';

/**
 * Connector-folded status → domain status. The connector already collapses
 * Hepsiburada's marketplace names ("Packaged", "InTransit"...) onto this
 * vocabulary, so this table only has to name the seven folded values.
 */
const STATUS: Record<string, string> = {
  created: 'pending',
  picking: 'processing',
  invoiced: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  returned: 'returned',
};

export class HepsiburadaMapper {
  static toUnifiedOrder(order: HepsiburadaOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.items.map((item) => ({
      sku: item.sku,
      name: item.name || 'Hepsiburada Product',
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));

    const status = STATUS[order.status] ?? 'pending';

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
