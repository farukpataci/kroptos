import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { EbayInventoryItem, EbayOrder } from './EbayTypes';

/**
 * eBay sends money as `{ value: "12.34", currency: "USD" }` strings and states
 * as its own vocabulary. Everything below narrows those onto the shared shape.
 */
function amount(value?: { value?: string }): number {
  const parsed = Number(value?.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * eBay separates fulfilment state from payment state; the shared model has one
 * status, so fulfilment wins — it is what a seller acts on.
 */
function toStatus(order: EbayOrder): string {
  switch ((order.orderFulfillmentStatus ?? '').toUpperCase()) {
    case 'FULFILLED':
      return 'shipped';
    case 'IN_PROGRESS':
      return 'processing';
    case 'NOT_STARTED':
      return 'pending';
    default:
      return 'pending';
  }
}

function toPaymentStatus(order: EbayOrder): string {
  switch ((order.orderPaymentStatus ?? '').toUpperCase()) {
    case 'PAID':
      return 'paid';
    case 'FAILED':
      return 'failed';
    case 'REFUNDED':
      return 'refunded';
    default:
      return 'pending';
  }
}

function formatAddress(order: EbayOrder): string | undefined {
  const contact = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress;
  if (!contact) return undefined;

  return [
    contact.addressLine1,
    contact.addressLine2,
    contact.city,
    contact.stateOrProvince,
    contact.postalCode,
    contact.countryCode,
  ]
    .filter(Boolean)
    .join(', ');
}

export class EbayMapper {
  static toUnifiedOrder(order: EbayOrder, fallbackCurrency: string): MarketplaceOrder {
    const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;

    const items: MarketplaceOrderItem[] = (order.lineItems ?? []).map((line) => {
      const unitPrice = amount(line.lineItemCost);
      const quantity = Number(line.quantity) || 0;
      return {
        // An eBay listing created outside the Inventory API has no SKU; the
        // legacy item id is the only stable handle in that case.
        sku: line.sku || line.legacyItemId || '',
        name: line.title || 'eBay Product',
        quantity,
        unitPrice,
        totalPrice: amount(line.total) || unitPrice * quantity,
      };
    });

    return {
      // `orderId` is the modern identifier; legacyOrderId is what the seller
      // sees in older tooling, so it is the fallback rather than the primary.
      orderNumber: order.orderId || order.legacyOrderId || '',
      customerName:
        shipTo?.fullName ||
        order.buyer?.buyerRegistrationAddress?.fullName ||
        order.buyer?.username ||
        'eBay Buyer',
      customerEmail: shipTo?.email || order.buyer?.buyerRegistrationAddress?.email,
      customerPhone: shipTo?.primaryPhone?.phoneNumber,
      shippingAddress: formatAddress(order),
      status: toStatus(order),
      paymentStatus: toPaymentStatus(order),
      totalAmount: amount(order.pricingSummary?.total),
      // The marketplace states the currency per order; the fallback only
      // applies when the payload omits it.
      currency: order.pricingSummary?.total?.currency || fallbackCurrency,
      source: 'ebay',
      items,
    };
  }

  static toUnifiedProduct(item: EbayInventoryItem): MarketplaceProduct {
    return {
      sku: item.sku ?? '',
      name: item.product?.title ?? '',
      description: item.product?.description,
      // The Inventory API models price on the *offer*, not the inventory item,
      // so a price is not available from this call. Reporting 0 would look like
      // a free product; the sync treats it as "unknown" instead.
      price: 0,
      stockQuantity: Number(item.availability?.shipToLocationAvailability?.quantity) || 0,
      image: item.product?.imageUrls?.[0],
      barcode: item.product?.ean?.[0] ?? item.product?.upc?.[0],
    };
  }
}
