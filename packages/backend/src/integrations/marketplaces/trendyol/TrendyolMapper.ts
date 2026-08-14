import { MarketplaceOrder, MarketplaceProduct, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { TrendyolOrder, TrendyolProduct } from './TrendyolTypes';

/**
 * What the mapper cannot infer from the payload: which provider the order came
 * from, and what to assume when the payload omits a currency. Both used to be
 * hardcoded to Türkiye, which mislabels every international order.
 */
export interface TrendyolMapperContext {
  /** Written to `Order.source`; distinguishes trendyol from trendyol_global. */
  source: string;
  /** Used only when the payload carries no currency at all. May be empty. */
  fallbackCurrency: string;
}

const TR_CONTEXT: TrendyolMapperContext = { source: 'trendyol', fallbackCurrency: 'TRY' };

export class TrendyolMapper {
  static toUnifiedOrder(
    order: TrendyolOrder,
    context: TrendyolMapperContext = TR_CONTEXT,
  ): MarketplaceOrder {
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
      currency: order.currency || context.fallbackCurrency,
      source: context.source,
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
