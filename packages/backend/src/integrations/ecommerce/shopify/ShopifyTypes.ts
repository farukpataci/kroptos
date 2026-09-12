/**
 * Shopify Admin REST & GraphQL API Type Definitions
 */

export interface ShopifyCredentials {
  shopDomain: string; // e.g. "my-store.myshopify.com"
  accessToken: string; // Admin API access token (shpat_...)
  apiVersion?: string; // e.g. "2024-01"
}

export interface ShopifyMoney {
  amount: string;
  currency_code: string;
}

export interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
  name?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  province_code?: string;
  country: string;
  country_code?: string;
  zip?: string;
  phone?: string;
}

export interface ShopifyCustomer {
  id: number | string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  default_address?: ShopifyAddress;
}

export interface ShopifyLineItem {
  id: number | string;
  product_id?: number | string;
  variant_id?: number | string;
  title: string;
  variant_title?: string;
  sku?: string;
  quantity: number;
  price: string;
  total_discount?: string;
  grams?: number;
  requires_shipping?: boolean;
}

export interface ShopifyOrder {
  id: number | string;
  order_number: number | string;
  name?: string; // e.g. "#1001"
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  financial_status: 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';
  fulfillment_status: 'fulfilled' | 'partial' | 'restocked' | null;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  customer?: ShopifyCustomer;
  billing_address?: ShopifyAddress;
  shipping_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
  note?: string;
  tags?: string;
}

export interface ShopifyVariant {
  id: number | string;
  product_id: number | string;
  title: string;
  price: string;
  sku?: string;
  barcode?: string;
  inventory_item_id?: number | string;
  inventory_quantity?: number;
  weight?: number;
  weight_unit?: string;
  requires_shipping?: boolean;
}

export interface ShopifyProduct {
  id: number | string;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  status: 'active' | 'archived' | 'draft';
  created_at: string;
  updated_at: string;
  variants: ShopifyVariant[];
  images?: Array<{ id: number | string; src: string }>;
  tags?: string;
}

export interface ShopifyFulfillmentCreation {
  fulfillment: {
    message?: string;
    notify_customer?: boolean;
    tracking_info?: {
      number: string;
      company?: string;
      url?: string;
    };
    line_items_by_fulfillment_order?: Array<{
      fulfillment_order_id: number | string;
      fulfillment_order_line_items?: Array<{
        id: number | string;
        quantity: number;
      }>;
    }>;
  };
}
