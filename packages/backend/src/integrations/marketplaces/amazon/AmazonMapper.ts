import { MarketplaceOrder, MarketplaceProduct, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { AmazonOrder, AmazonProduct } from './AmazonTypes';

export class AmazonMapper {
  static toUnifiedOrder(order: AmazonOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.OrderItems.map((item) => ({
      sku: item.SellerSKU || item.ASIN,
      name: item.Title || 'Amazon SP-API Product',
      quantity: item.QuantityOrdered,
      unitPrice: Number(item.ItemPrice?.Amount || 0),
      totalPrice: Number(item.ItemPrice?.Amount || 0) * item.QuantityOrdered,
    }));

    let status = 'pending';
    if (order.OrderStatus === 'Unshipped' || order.OrderStatus === 'Pending') status = 'pending';
    else if (order.OrderStatus === 'Shipped') status = 'shipped';
    else if (order.OrderStatus === 'Canceled') status = 'cancelled';

    const addr = order.ShippingAddress;
    const shippingStr = addr
      ? `${addr.AddressLine1 || ''}, ${addr.City || ''}, ${addr.StateOrRegion || ''} ${addr.PostalCode || ''}, ${addr.CountryCode || ''}`
      : 'No shipping address provided';

    return {
      orderNumber: order.AmazonOrderId,
      customerName: order.BuyerInfo.BuyerName || 'Amazon Customer',
      customerEmail: order.BuyerInfo.BuyerEmail,
      customerPhone: order.BuyerInfo.BuyerPhone,
      shippingAddress: shippingStr,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: Number(order.OrderTotal?.Amount || 0),
      currency: order.OrderTotal?.CurrencyCode || 'USD',
      source: 'amazon',
      items,
    };
  }

  static toUnifiedProduct(product: AmazonProduct): MarketplaceProduct {
    return {
      sku: product.sku,
      name: product.attributes.title?.[0]?.value || 'Amazon Product',
      description: product.attributes.description?.[0]?.value,
      price: product.price.amount,
      stockQuantity: product.quantity,
      image: product.imageUrl,
      barcode: product.asin,
    };
  }
}
