import { MarketplaceOrder, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { ZalandoOrder, ZalandoPrice } from './ZalandoTypes';

/**
 * Zalando states money as an amount plus a currency. Unlike Temu the amount is
 * read as a major unit — DOĞRULANAMADI, and it is the most damaging thing here
 * to get wrong, so it is isolated in one function with its own test.
 */
function amount(price?: ZalandoPrice): number {
  const parsed = Number(price?.amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Only the states that appear consistently in Zalando's partner documentation
 * are translated. Anything else stays `pending` rather than being guessed —
 * marking an unshipped order as shipped is worse than admitting ignorance.
 */
function toStatus(status: unknown): string {
  switch (String(status ?? '').toLowerCase()) {
    case 'approved':
    case 'confirmed':
      return 'processing';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export class ZalandoMapper {
  static toUnifiedOrder(order: ZalandoOrder, fallbackCurrency: string): MarketplaceOrder {
    const address = order.delivery_address;

    const items: MarketplaceOrderItem[] = (order.items ?? []).map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = amount(item.price);
      return {
        // Zalando is EAN-driven; the merchant's own SKU is preferred where it
        // is echoed back, since that is what ProductMapping keys on.
        sku: item.merchant_sku || item.ean || item.article_id || '',
        name: item.name || 'Zalando Article',
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
    });

    const status = toStatus(order.status);

    return {
      orderNumber: order.order_number || order.order_id || '',
      customerName: [address?.first_name, address?.last_name].filter(Boolean).join(' ') || 'Zalando Customer',
      customerEmail: order.customer?.email,
      customerPhone: undefined,
      shippingAddress:
        [address?.street, address?.zip, address?.city, address?.country_code].filter(Boolean).join(', ') ||
        undefined,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: amount(order.gross_total),
      // Stated per order where present; the fallback is deliberately not a
      // guessed per-country table.
      currency: order.gross_total?.currency || order.currency || fallbackCurrency,
      source: 'zalando',
      items,
    };
  }
}
