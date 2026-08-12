import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { AllegroCheckoutForm, AllegroOffer, AllegroPrice } from './AllegroTypes';

/**
 * Allegro sends money as decimal *text* in major units ("12.34"), not as a
 * number and not in cents. Parsing it in one place keeps that assumption
 * checkable — getting the unit wrong is the most damaging mistake here.
 */
function amount(price?: AllegroPrice): number {
  const parsed = Number(price?.amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Checkout form statuses. Only the documented values are translated; anything
 * else stays `pending` rather than being guessed into a state that would, say,
 * mark an unpaid order as ready to ship.
 */
function toStatus(status: unknown): string {
  switch (String(status ?? '').toUpperCase()) {
    case 'BOUGHT':
      return 'pending';
    case 'FILLED_IN':
    case 'READY_FOR_PROCESSING':
      return 'processing';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export class AllegroMapper {
  static toUnifiedOrder(form: AllegroCheckoutForm, fallbackCurrency: string): MarketplaceOrder {
    const address = form.delivery?.address;

    const items: MarketplaceOrderItem[] = (form.lineItems ?? []).map((line) => {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = amount(line.price);
      return {
        // `external.id` is the SKU the seller supplied when listing the offer;
        // it is what ProductMapping keys on. The offer id is Allegro's own and
        // only a fallback handle.
        sku: line.offer?.external?.id || line.offer?.id || '',
        name: line.offer?.name || 'Allegro Offer',
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
    });

    const status = toStatus(form.status);

    return {
      orderNumber: form.id ?? '',
      customerName:
        [form.buyer?.firstName, form.buyer?.lastName].filter(Boolean).join(' ') ||
        form.buyer?.login ||
        'Allegro Buyer',
      customerEmail: form.buyer?.email,
      customerPhone: form.buyer?.phoneNumber,
      shippingAddress:
        [address?.street, address?.zipCode, address?.city, address?.countryCode]
          .filter(Boolean)
          .join(', ') || undefined,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: amount(form.summary?.totalToPay),
      currency: form.summary?.totalToPay?.currency || fallbackCurrency,
      source: 'allegro',
      items,
    };
  }

  static toUnifiedProduct(offer: AllegroOffer): MarketplaceProduct {
    return {
      sku: offer.external?.id || offer.id || '',
      name: offer.name ?? '',
      description: undefined,
      price: amount(offer.sellingMode?.price),
      stockQuantity: Number(offer.stock?.available) || 0,
      image: offer.primaryImage?.url,
      barcode: offer.ean,
    };
  }
}
