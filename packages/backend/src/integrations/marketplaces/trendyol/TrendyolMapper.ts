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

/**
 * Every package status a live gateway returns, lower-cased. The four-branch
 * if/else this replaces knew only Created/Shipped/Delivered/Cancelled, so
 * Picking, UnPacked, Invoiced and Returned — which together were most of the
 * packages on the account measured — all landed on 'pending'.
 */
const STATUS_MAP: Record<string, string> = {
  awaiting: 'pending',
  created: 'pending',
  picking: 'processing',
  invoiced: 'processing',
  unpacked: 'processing',
  shipped: 'shipped',
  atcollectionpoint: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  unsupplied: 'cancelled',
  returned: 'returned',
};

export class TrendyolMapper {
  /**
   * The key an order is stored under. Trendyol splits one order number across
   * several shipment packages that ship and cancel independently; storing them
   * all under the order number makes the second package collide with the first
   * — `Order.orderNumber` is unique — so only one of them is ever imported.
   */
  static packageKey(order: TrendyolOrder): string {
    return order.packageId ? `${order.orderNumber}-${order.packageId}` : order.orderNumber;
  }

  static toUnifiedOrder(
    order: TrendyolOrder,
    context: TrendyolMapperContext = TR_CONTEXT,
  ): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.lines.map((line) => ({
      sku: line.sku || line.barcode,
      name: line.productName || 'Trendyol Product',
      quantity: line.quantity,
      unitPrice: line.price,
      // The line discount covers all units, so it comes off the line total, not
      // the unit price — otherwise a discounted line rounds its way out of
      // agreeing with the package total.
      totalPrice: line.price * line.quantity - (line.discount ?? 0),
    }));

    const status = STATUS_MAP[String(order.status ?? '').trim().toLowerCase()] ?? 'pending';

    return {
      orderNumber: TrendyolMapper.packageKey(order),
      // The number the seller and the buyer quote; `orderNumber` above is
      // composite whenever the order arrived as more than one package.
      marketplaceOrderNumber: order.orderNumber,
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
