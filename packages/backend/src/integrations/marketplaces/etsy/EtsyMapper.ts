import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { EtsyListing, EtsyReceipt } from './EtsyTypes';

export class EtsyMapper {
  static toUnifiedOrder(receipt: EtsyReceipt): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = receipt.transactions.map((transaction) => ({
      sku: transaction.sku,
      name: transaction.title || 'Etsy Product',
      quantity: transaction.quantity,
      unitPrice: transaction.price,
      totalPrice: transaction.price * transaction.quantity,
    }));

    // Etsy tracks payment and fulfilment separately: a receipt stays "paid"
    // after dispatch, and only is_shipped says the parcel left.
    let status = 'pending';
    if (receipt.status === 'canceled') status = 'cancelled';
    else if (receipt.status === 'completed') status = 'delivered';
    else if (receipt.is_shipped) status = 'shipped';

    const address = [receipt.first_line, receipt.city, receipt.state, receipt.country_iso]
      .filter(Boolean)
      .join(', ');

    return {
      orderNumber: String(receipt.receipt_id),
      customerName: receipt.name,
      customerEmail: receipt.buyer_email,
      shippingAddress: address || undefined,
      status,
      paymentStatus: receipt.status === 'canceled' ? 'failed' : 'paid',
      totalAmount: receipt.total,
      currency: receipt.currency || 'USD',
      source: 'etsy',
      items,
    };
  }

  static toUnifiedProduct(listing: EtsyListing): MarketplaceProduct {
    return {
      sku: listing.sku,
      name: listing.title,
      description: listing.description,
      price: listing.price,
      stockQuantity: listing.quantity,
      image: listing.image,
    };
  }
}
