/**
 * Raw n11 REST shapes, taken from the seller-facing documentation
 * ("n11 RestAPI Entegrasyon Servisleri", 2026-08-17) rather than guessed.
 *
 * Field names are n11's, typos included: the order payload really does spell
 * the buyer's name `customerfullName` with a lower-case f.
 */

// ---------------------------------------------------------------- products

/** One row of `GET /ms/product-query`'s `content` array. */
export interface RawN11Product {
  n11ProductId?: number;
  stockCode?: string; // Satıcı Stok Kodu — this is the SKU
  title?: string;
  description?: string;
  categoryId?: number;
  productMainId?: string;
  status?: string; // Active, InCatalogApproval, Suspended, ...
  saleStatus?: string; // Before_Sale, On_Sale, Out_Of_Stock, Sale_Closed
  preparingDay?: number;
  shipmentTemplate?: string;
  barcode?: string | null;
  currencyType?: string; // TL | USD | EUR
  salePrice?: number;
  listPrice?: number;
  quantity?: number;
  imageUrls?: string[];
  vatRate?: number;
  commissionRate?: number;
}

// ------------------------------------------------------------------ orders

export interface RawN11Address {
  address?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  fullName?: string;
  gsm?: string;
  postalCode?: string;
}

/** One entry of a shipment package's `lines` array — a flat array, not nested. */
export interface RawN11OrderLine {
  quantity?: number;
  productId?: number;
  productName?: string;
  stockCode?: string; // seller SKU
  price?: number; // unit price, before discounts
  sellerInvoiceAmount?: number;
  totalSellerDiscountPrice?: number;
  orderLineId?: number;
  barcode?: string;
  orderItemLineItemStatusName?: string;
}

/**
 * One row of `GET /rest/delivery/v1/shipmentPackages`'s `content`.
 *
 * `orderNumber` identifies the buyer's order; `id` identifies the package. One
 * order can be split into several packages, each shipped separately — and `id`
 * comes back null for "Konuma Özel Teslimat" orders, where n11 handles delivery.
 */
export interface RawN11ShipmentPackage {
  orderNumber?: string;
  id?: string | null;
  customerEmail?: string;
  customerfullName?: string; // n11's spelling
  customerId?: number;
  shippingAddress?: RawN11Address;
  billingAddress?: RawN11Address;
  lines?: RawN11OrderLine[];
  totalAmount?: number;
  totalDiscountAmount?: number;
  shipmentPackageStatus?: string;
  lastModifiedDate?: number; // epoch milliseconds
}

/** Spring's page envelope, shared by product-query and shipmentPackages. */
export interface RawN11Page<T> {
  content?: T[];
  totalPages?: number;
  totalElements?: number;
  number?: number;
  size?: number;
  empty?: boolean;
}

// ------------------------------------------------------------- stock tasks

/** Answer to `POST /ms/product/tasks/price-stock-update`. */
export interface RawN11TaskAck {
  id?: number;
  type?: string;
  status?: string; // IN_QUEUE | REJECT
  reasons?: string[];
}

/** One SKU's outcome inside `POST /ms/product/task-details/page-query`. */
export interface RawN11TaskSkuResult {
  itemCode?: string; // the stockCode this row is about
  status?: string; // SUCCESS | Fail
  reasons?: string[];
}

export interface RawN11TaskDetails {
  taskId?: number;
  status?: string; // PROCESSED | IN_QUEUE | REJECT
  skus?: RawN11Page<RawN11TaskSkuResult>;
}

// ------------------------------------------------------------------ status

/**
 * Every status `GET /rest/delivery/v1/shipmentPackages` accepts and returns.
 * The parameter takes exactly one of these per request, so importing several
 * means several requests.
 */
export const N11_ORDER_STATUSES = [
  'Created',
  'Picking',
  'Shipped',
  'Delivered',
  'Cancelled',
  'UnPacked',
  'UnSupplied',
] as const;

export type N11OrderStatus = (typeof N11_ORDER_STATUSES)[number];
