import { MarketplaceOrder, MarketplaceOrderItem } from '../core/MarketplaceTypes';
import {
  ZalandoIncludedResource,
  ZalandoMoney,
  ZalandoOrderItemAttributes,
  ZalandoOrderLineAttributes,
  ZalandoOrderResource,
  ZalandoOrdersDocument,
} from './ZalandoTypes';

/**
 * Zalando states money as an amount plus an ISO-4217 currency, and the spec
 * pins the amount as a **major unit** — `Money.amount` is documented as
 * "Amount with 2 digits after the decimal separator", example `99.95`. That is
 * the opposite of Temu, and reading it wrong moves every total by 100x, so it
 * stays isolated in one function with its own test.
 */
function amount(money?: ZalandoMoney): number {
  const parsed = Number(money?.amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Zalando's `OrderStatus` enum has only three values and **no cancelled state**
 * — cancellation is expressed per order line instead. So the order status sets
 * the baseline and the lines can override it downwards.
 *
 * `fulfilled` maps to `shipped` rather than `delivered` on purpose: it means
 * Zalando considers the order dispatched, and telling a seller something was
 * delivered when it is still in transit is the more expensive error.
 */
function toStatus(orderStatus: unknown, lineStatuses: string[]): string {
  const lines = lineStatuses.map((s) => s.toLowerCase());

  if (lines.length > 0 && lines.every((s) => s === 'canceled' || s === 'cancelled')) {
    return 'cancelled';
  }
  if (lines.length > 0 && lines.every((s) => s === 'returned')) {
    return 'returned';
  }

  switch (String(orderStatus ?? '').toLowerCase()) {
    case 'initial':
      return 'pending';
    case 'approved':
      return 'processing';
    case 'fulfilled':
      return 'shipped';
    default:
      // Anything Zalando adds later stays pending rather than being guessed at.
      return 'pending';
  }
}

function addressLine(order: ZalandoOrderResource): string | undefined {
  const address = order.attributes?.shipping_address;
  if (!address) return undefined;

  return (
    [
      address.address_line_1,
      address.address_line_2,
      address.address_line_3,
      address.zip_code,
      address.city,
      address.country_code,
    ]
      .filter(Boolean)
      .join(', ') || undefined
  );
}

/**
 * Splits `included` by resource type. JSON:API puts every included resource in
 * one flat array, so items and lines are told apart by `type` — and, because
 * `type` spelling is the one thing not pinned by the mirror, by which
 * identifying attribute the resource actually carries.
 */
function partitionIncluded(included: ZalandoIncludedResource[]) {
  const items: ZalandoOrderItemAttributes[] = [];
  const lines: ZalandoOrderLineAttributes[] = [];

  for (const resource of included) {
    const attributes = resource.attributes;
    if (!attributes) continue;

    const type = String(resource.type ?? '').toLowerCase();
    const looksLikeLine = type.includes('line') || attributes.order_line_id !== undefined;
    const looksLikeItem = type.includes('item') || attributes.article_id !== undefined;

    if (looksLikeLine && !type.includes('item')) {
      lines.push(attributes);
    } else if (looksLikeItem) {
      items.push(attributes);
    }
  }

  return { items, lines };
}

export class ZalandoMapper {
  /**
   * Turns one JSON:API orders document into unified orders.
   *
   * The document is mapped as a whole rather than order by order because the
   * item and line resources live in a shared `included` array — an order alone
   * carries no prices at all, and joining has to happen at document level.
   */
  static toUnifiedOrders(
    document: ZalandoOrdersDocument | undefined,
    fallbackCurrency: string,
  ): MarketplaceOrder[] {
    const orders = document?.data ?? [];
    const { items, lines } = partitionIncluded(document?.included ?? []);

    const itemsByOrder = new Map<string, ZalandoOrderItemAttributes[]>();
    for (const item of items) {
      const key = String(item.order_id ?? '');
      if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
      itemsByOrder.get(key)!.push(item);
    }

    const linesByItem = new Map<string, ZalandoOrderLineAttributes[]>();
    for (const line of lines) {
      const key = String(line.order_item_id ?? '');
      if (!linesByItem.has(key)) linesByItem.set(key, []);
      linesByItem.get(key)!.push(line);
    }

    return orders.map((order) =>
      ZalandoMapper.toUnifiedOrder(order, itemsByOrder, linesByItem, fallbackCurrency),
    );
  }

  private static toUnifiedOrder(
    order: ZalandoOrderResource,
    itemsByOrder: Map<string, ZalandoOrderItemAttributes[]>,
    linesByItem: Map<string, ZalandoOrderLineAttributes[]>,
    fallbackCurrency: string,
  ): MarketplaceOrder {
    const attributes = order.attributes ?? {};
    const orderId = String(attributes.order_id ?? order.id ?? '');
    const orderItems = itemsByOrder.get(orderId) ?? [];

    const lineStatuses: string[] = [];
    const items: MarketplaceOrderItem[] = orderItems.map((item) => {
      const itemLines = linesByItem.get(String(item.order_item_id ?? '')) ?? [];
      for (const line of itemLines) {
        if (line.status) lineStatuses.push(String(line.status));
      }

      // One order line is exactly one sold product, so the line count is the
      // quantity. `quantity_initial` covers the case where lines were not
      // requested through `include`.
      const quantity = itemLines.length || Number(item.quantity_initial) || 0;
      const unitPrice = amount(itemLines[0]?.price);
      const totalPrice = itemLines.length
        ? itemLines.reduce((sum, line) => sum + amount(line.price), 0)
        : unitPrice * quantity;

      return {
        // The merchant's own identifier is preferred: that is what
        // ProductMapping keys on. Zalando's article id is the fallback.
        sku: item.external_id || item.article_id || '',
        name: item.description || 'Zalando Article',
        quantity,
        unitPrice,
        totalPrice,
      };
    });

    const status = toStatus(attributes.status, lineStatuses);

    // The goods total and the shipping charge are stated separately, so an
    // order total is their sum. `order_lines_price_amount` alone would
    // under-report every order that charged for delivery.
    const goodsTotal = Number(attributes.order_lines_price_amount);
    const totalAmount =
      (Number.isFinite(goodsTotal) ? goodsTotal : 0) + amount(attributes.shipping_costs);

    const customer = attributes.shipping_address;

    return {
      orderNumber: attributes.order_number || orderId,
      customerName:
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || 'Zalando Customer',
      customerEmail: attributes.customer_email,
      customerPhone: attributes.customer_phone?.number,
      shippingAddress: addressLine(order),
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount,
      // Stated per order where present; the fallback is deliberately not a
      // guessed per-country table.
      currency:
        attributes.order_lines_price_currency ||
        attributes.shipping_costs?.currency ||
        fallbackCurrency,
      source: 'zalando',
      items,
    };
  }
}
