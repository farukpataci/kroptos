/**
 * Buyers, rolled up out of the orders they placed.
 *
 * There is no Customer table. `Order` carries `customerName/Email/Phone` as
 * plain columns and a `customerId` nothing populates, so a buyer only exists as
 * the set of orders that share an identity. This is that roll-up, kept apart
 * from the page because the grouping key and the money are worth testing.
 */

export interface BuyerSourceOrder {
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  totalAmount: string | number;
  currency: string;
  createdAt: string;
}

export interface Buyer {
  /** Stable across renders: the grouping key itself. */
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  orderCount: number;
  /** Summed per currency — orders in TRY and USD do not add up to a number. */
  totalsByCurrency: Record<string, number>;
  lastOrderAt: string;
}

/**
 * Email first, then phone, then the name. Email is the only one a marketplace
 * reliably passes through; phone is the fallback, and a bare name is a last
 * resort that will merge two genuine namesakes. Case and surrounding spaces are
 * normalised, because the same buyer arrives spelled both ways from different
 * channels.
 */
export function buyerKey(order: BuyerSourceOrder): string {
  const email = order.customerEmail?.trim().toLowerCase();
  if (email) return `email:${email}`;
  // Formatting differs per channel (+90 555…, 0555…, 555…), so only the digits
  // are compared. The last ten are the subscriber number in every form of it.
  const digits = order.customerPhone?.replace(/\D/g, '') || '';
  if (digits) return `phone:${digits.slice(-10)}`;
  return `name:${order.customerName.trim().toLowerCase()}`;
}

export function groupBuyers(orders: BuyerSourceOrder[]): Buyer[] {
  const byKey = new Map<string, Buyer>();

  for (const order of orders) {
    const key = buyerKey(order);
    const amount = Number(order.totalAmount) || 0;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        key,
        name: order.customerName,
        email: order.customerEmail?.trim() || null,
        phone: order.customerPhone?.trim() || null,
        orderCount: 1,
        totalsByCurrency: { [order.currency]: amount },
        lastOrderAt: order.createdAt,
      });
      continue;
    }

    existing.orderCount += 1;
    existing.totalsByCurrency[order.currency] =
      (existing.totalsByCurrency[order.currency] || 0) + amount;
    // Keep whichever contact details the buyer eventually supplied: grouped by
    // phone, the first order may have had no email at all.
    existing.email = existing.email || order.customerEmail?.trim() || null;
    existing.phone = existing.phone || order.customerPhone?.trim() || null;
    if (order.createdAt > existing.lastOrderAt) {
      existing.lastOrderAt = order.createdAt;
      existing.name = order.customerName; // most recent spelling wins
    }
  }

  return [...byKey.values()].sort((a, b) => (a.lastOrderAt < b.lastOrderAt ? 1 : -1));
}

/** Matches a buyer against a free-text search over name, email and phone. */
export function buyerMatches(buyer: Buyer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [buyer.name, buyer.email, buyer.phone].some((field) =>
    field?.toLowerCase().includes(q),
  );
}
