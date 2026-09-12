/**
 * E-Commerce Integration Layer Core Types
 * Unified domain vocabulary for e-commerce platforms (Shopify, WooCommerce, Magento, etc.)
 */

export const ECOMMERCE_PROVIDERS = [
  'SHOPIFY',
  'WOOCOMMERCE',
  'MAGENTO',
  'TICIMAX',
  'IDEASOFT',
  'TSOFT',
  'OPENCART',
  'PRESTASHOP',
  'IKAS',
] as const;

export type EcommerceProvider = (typeof ECOMMERCE_PROVIDERS)[number];

export function isEcommerceProvider(value: unknown): value is EcommerceProvider {
  return typeof value === 'string' && (ECOMMERCE_PROVIDERS as readonly string[]).includes(value as EcommerceProvider);
}

/**
 * Normalized financial/payment statuses across all e-commerce platforms.
 */
export const ECOMMERCE_FINANCIAL_STATUSES = [
  'pending',
  'authorized',
  'paid',
  'partially_paid',
  'refunded',
  'partially_refunded',
  'voided',
] as const;

export type EcommerceFinancialStatus = (typeof ECOMMERCE_FINANCIAL_STATUSES)[number];

/**
 * Normalized fulfillment/shipping statuses across all e-commerce platforms.
 */
export const ECOMMERCE_FULFILLMENT_STATUSES = [
  'unfulfilled',
  'partially_fulfilled',
  'fulfilled',
  'restocked',
  'cancelled',
  'in_transit',
  'delivered',
] as const;

export type EcommerceFulfillmentStatus = (typeof ECOMMERCE_FULFILLMENT_STATUSES)[number];

/**
 * Normalized overall order statuses.
 */
export const ECOMMERCE_ORDER_STATUSES = [
  'open',
  'closed',
  'cancelled',
  'archived',
] as const;

export type EcommerceOrderStatus = (typeof ECOMMERCE_ORDER_STATUSES)[number];

export interface EcommerceAddress {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string; // State / Region / İlçe
  postalCode?: string;
  country: string;
  countryCode?: string;
  phone?: string;
  email?: string;
}

export interface EcommerceCustomer {
  id?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface EcommerceOrderItem {
  id: string;
  productId?: string;
  variantId?: string;
  sku?: string;
  barcode?: string;
  title: string;
  variantTitle?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  taxAmount?: number;
  discountAmount?: number;
  weightGrams?: number;
  requiresShipping?: boolean;
}

export interface EcommerceOrder {
  id: string;
  orderNumber: string;
  provider: EcommerceProvider;
  createdAt: Date;
  updatedAt: Date;
  orderStatus: EcommerceOrderStatus;
  financialStatus: EcommerceFinancialStatus;
  fulfillmentStatus: EcommerceFulfillmentStatus;
  currency: string;
  totalPrice: number;
  subtotalPrice: number;
  totalTax: number;
  totalShipping: number;
  totalDiscounts: number;
  customer?: EcommerceCustomer;
  shippingAddress?: EcommerceAddress;
  billingAddress?: EcommerceAddress;
  items: EcommerceOrderItem[];
  notes?: string;
  tags?: string[];
  rawPayload?: Record<string, unknown>;
}

export interface EcommerceProductVariant {
  id: string;
  productId: string;
  sku?: string;
  barcode?: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  inventoryQuantity: number;
  weightGrams?: number;
  requiresShipping?: boolean;
}

export interface EcommerceProduct {
  id: string;
  provider: EcommerceProvider;
  title: string;
  description?: string;
  vendor?: string;
  productType?: string;
  status: 'active' | 'draft' | 'archived';
  variants: EcommerceProductVariant[];
  images?: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  rawPayload?: Record<string, unknown>;
}

export interface EcommerceFulfillmentRequest {
  orderId: string;
  trackingNumber: string;
  carrierName?: string;
  carrierCode?: string;
  trackingUrl?: string;
  notifyCustomer?: boolean;
  lineItems?: Array<{
    id: string;
    quantity: number;
  }>;
}

export interface EcommerceFulfillmentResult {
  success: boolean;
  fulfillmentId?: string;
  trackingNumber?: string;
  carrierName?: string;
  message?: string;
}

export interface EcommerceInventoryUpdate {
  inventoryItemId?: string;
  productId?: string;
  variantId?: string;
  sku?: string;
  locationId?: string;
  availableQuantity: number;
}

export interface EcommerceInventoryUpdateResult {
  success: boolean;
  variantId?: string;
  sku?: string;
  newQuantity?: number;
  message?: string;
}

export interface EcommerceOrderQueryFilter {
  status?: EcommerceOrderStatus;
  financialStatus?: EcommerceFinancialStatus;
  fulfillmentStatus?: EcommerceFulfillmentStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  limit?: number;
  cursor?: string;
  page?: number;
}

export interface EcommerceConnectionTestResult {
  success: boolean;
  message: string;
  shopName?: string;
  shopDomain?: string;
  currency?: string;
  details?: Record<string, unknown>;
}

export interface EcommerceWebhookPayload {
  topic: string;
  provider: EcommerceProvider;
  shopDomain: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
}
