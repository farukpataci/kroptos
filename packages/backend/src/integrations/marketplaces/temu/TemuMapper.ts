import { MarketplaceOrder, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import { TemuOrder } from './TemuTypes';

/**
 * Temu returns money in minor units (cents) on the order endpoints documented
 * so far, so amounts are divided before they reach the shared model — storing
 * cents as if they were currency units would inflate every order a hundredfold.
 *
 * DOĞRULANAMADI: that the minor-unit assumption holds for every field and
 * currency. It is the single most damaging thing to get wrong here, so it is
 * isolated in one function and covered by its own test.
 */
function fromMinorUnits(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

/**
 * Temu order states are numeric. Only the mappings that appear consistently in
 * integration documentation are translated; anything else stays `pending`
 * rather than being guessed into a state that would, say, mark an unpaid order
 * as shipped.
 */
function toStatus(status: unknown): string {
  switch (String(status)) {
    case '1':
      return 'pending';
    case '2':
      return 'processing';
    case '3':
      return 'shipped';
    case '4':
      return 'delivered';
    case '5':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export class TemuMapper {
  static toUnifiedOrder(order: TemuOrder, fallbackCurrency: string): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = (order.itemList ?? []).map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = fromMinorUnits(item.unitPrice);
      return {
        // `skuCode` is the seller's own code where it exists; the numeric ids
        // are Temu's and only useful as a fallback handle.
        sku: item.skuCode || String(item.skuId ?? item.goodsId ?? ''),
        name: item.goodsName || 'Temu Product',
        quantity,
        unitPrice,
        totalPrice: item.totalAmount !== undefined ? fromMinorUnits(item.totalAmount) : unitPrice * quantity,
      };
    });

    const status = toStatus(order.orderStatus);

    return {
      orderNumber: order.parentOrderSn || order.orderSn || '',
      customerName: order.receiverName || 'Temu Buyer',
      customerEmail: order.receiverEmail,
      customerPhone: order.receiverPhone,
      shippingAddress: [order.addressDetail, order.city, order.countryCode].filter(Boolean).join(', ') || undefined,
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: fromMinorUnits(order.orderAmount),
      // The payload states the currency where it can; the fallback only applies
      // when it does not, and is deliberately not a guessed per-region table.
      currency: order.currency || fallbackCurrency,
      source: 'temu',
      items,
    };
  }
}
