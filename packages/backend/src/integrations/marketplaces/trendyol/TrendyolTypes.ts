export interface TrendyolAddress {
  address1: string;
  city: string;
  country: string;
}

export interface TrendyolOrderLine {
  barcode: string;
  sku: string;
  quantity: number;
  /** Unit price before discount — Trendyol's `lineUnitPrice`. */
  price: number;
  /** Discount Trendyol already deducted from the line, over all its units. */
  discount: number;
  merchantId: number;
  productName: string;
}

export interface TrendyolOrder {
  id: number;
  orderNumber: string;
  /**
   * Shipment package id. One order number arrives as several packages that
   * ship, invoice and cancel on their own, so this is what makes a row unique —
   * see TrendyolMapper.packageKey. Empty when the payload carries no package.
   */
  packageId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail?: string;
  customerPhone?: string;
  shipmentAddress: TrendyolAddress;
  lines: TrendyolOrderLine[];
  status: string; // 'Created', 'Delivered', 'Cancelled', etc.
  totalPrice: number;
  currency: string;
  /**
   * What Trendyol already knows about the parcel. Measured on the stage seller
   * account, 162 packages, 2026-08-25:
   *
   *   cargoProviderName    162/162 filled
   *   cargoTrackingNumber  162/162 present, one of them 0 — Trendyol's way of
   *                        saying "no barcode yet", so it is dropped rather
   *                        than imported as the string "0"
   *   cargoTrackingLink     79/162
   *
   * Carried as strings: a tracking number is an identifier, and the gateway
   * sends it as a JSON number.
   */
  cargoProviderName?: string;
  cargoTrackingNumber?: string;
  cargoTrackingLink?: string;
  /**
   * When the parcel actually left, read from `packageHistories`.
   *
   * NOT `originShipmentDate`, which looks like the answer and is not: it is
   * filled on all 162 packages including the 105 that never shipped, and it
   * matched the Shipped history entry on 0 of the 57 that did.
   */
  shippedAt?: Date;
}

export interface TrendyolProductImage {
  url: string;
}

export interface TrendyolProduct {
  title: string;
  stockCode: string; // SKU
  description?: string;
  salePrice: number;
  quantity: number;
  images: TrendyolProductImage[];
  barcode?: string;
}

/**
 * One line of a batch request's result. Trendyol accepts a price/inventory batch
 * and answers only with an id; whether the items were applied is a second call.
 */
export interface TrendyolBatchItem {
  status: string; // SUCCESS | FAILED
  failureReasons?: string[];
}

export interface TrendyolBatchStatus {
  batchRequestId?: string;
  items?: TrendyolBatchItem[];
  /**
   * Measured on stage 2026-08-19: these two are populated *before* `items` is,
   * so a batch can report `itemCount: 1, failedItemCount: 0` while the single
   * item it is counting turns out to be a failure. They are only usable as the
   * expected length of `items`, never as an outcome on their own.
   */
  itemCount?: number;
  failedItemCount?: number;
}
