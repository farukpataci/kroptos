/**
 * Whether a payload came from the marketplace or from a connector's own sample
 * data. A connector whose endpoints are not verified yet can still be installed
 * and configured, but nothing it produces may pass for real: every result
 * carries this, and the worker refuses to persist simulated rows.
 */
export type MarketplaceMode = 'live' | 'simulation';

/** Which of the three inputs decided the mode, for logs and for the UI badge. */
export type MarketplaceModeSource = 'setting' | 'env' | 'default';

/** Mixed into every connector result so no payload is mode-ambiguous. */
export interface MarketplaceModeStamp {
  mode?: MarketplaceMode;
  modeSource?: MarketplaceModeSource;
}

export interface MarketplaceProduct extends MarketplaceModeStamp {
  sku: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  image?: string;
  barcode?: string;
}

export interface MarketplaceOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * What the marketplace already knows about the parcel, when it arranges the
 * carrier itself. Every field optional: a marketplace that has not dispatched
 * the order yet sends none of them, and a provider that was never measured
 * leaves the whole block undefined rather than having a value guessed for it.
 *
 * Deliberately NOT a copy of the raw payload. A `raw` passthrough would reach
 * every log line and DTO that spreads an order, and the raw shipment package
 * carries the recipient's name, phone and address — see the address fields
 * above, which are handed over one at a time for exactly that reason.
 */
export interface MarketplaceOrderShipping {
  /** The carrier's own tracking number. String even where the payload sends a
   * number: it is an identifier, not a quantity, and leading zeros matter. */
  trackingNumber?: string;
  /** Carrier as the marketplace names it, e.g. 'Trendyol Express'. */
  carrierName?: string;
  trackingUrl?: string;
  /** The marketplace's id for the parcel, when the parcel has its own id. */
  packageId?: string;
  shippedAt?: Date;
}

export interface MarketplaceOrder extends MarketplaceModeStamp {
  /**
   * The number this order is stored and deduplicated under. For a marketplace
   * that splits one order into several shipments this is a composite, because
   * each shipment moves and is fulfilled on its own.
   */
  orderNumber: string;
  /**
   * The number the marketplace shows the seller, when `orderNumber` had to be
   * made composite. Kept so the panel can group the shipments back together and
   * so a seller searching the number the buyer quotes actually finds the order.
   */
  marketplaceOrderNumber?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  /**
   * One line of free text, joined by the mapper. Kept because every consumer
   * built so far reads it, but a courier cannot route on it: the district has
   * to be its own field.
   */
  shippingAddress?: string;
  /**
   * The same address, apart. Every field optional because the marketplaces do
   * not all send them — a provider with no concept of a district leaves
   * `shippingDistrict` undefined rather than having one guessed for it.
   *
   * Filled alongside `shippingAddress`, never instead of it.
   */
  shippingFullName?: string;
  shippingPhone?: string;
  shippingLine1?: string;
  shippingLine2?: string;
  shippingDistrict?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  /** ISO-3166-1 alpha-2, stated by the mapper that knows its marketplace. */
  shippingCountryCode?: string;
  status: string; // 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: string; // 'pending' | 'paid' | 'failed'
  totalAmount: number;
  currency: string;
  source: string; // provider name, e.g., 'trendyol', 'hepsiburada', etc.
  items: MarketplaceOrderItem[];
  /**
   * Carrier details the marketplace fulfils on its own. Not the shipping
   * address — that stays in the `shipping*` fields above.
   *
   * Nothing consumes this yet; the field exists so a provider that has the
   * data can carry it instead of dropping it on the floor.
   */
  shipping?: MarketplaceOrderShipping;
}

export interface StockUpdateResult extends MarketplaceModeStamp {
  sku: string;
  quantity: number;
  success: boolean;
  error?: string;
  /**
   * The marketplace accepted the update into a queue but had not applied it by
   * the time we stopped waiting. Neither success nor failure: reporting `true`
   * would claim stock that may still be rejected, and `false` would send the
   * caller retrying an update the marketplace is already processing.
   *
   * Optional, so a marketplace that answers synchronously never sets it.
   */
  pending?: boolean;
  /** Handle for querying the outcome later, when `pending` is set. */
  taskId?: string;
}

export interface ConnectionTestResult extends MarketplaceModeStamp {
  success: boolean;
  message: string;
  durationMs: number;
}
