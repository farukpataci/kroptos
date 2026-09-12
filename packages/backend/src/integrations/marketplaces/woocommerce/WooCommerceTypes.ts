/**
 * Credentials required to connect to a WooCommerce store.
 */
export interface WooCommerceCredentials {
  baseUrl: string; // e.g. https://example.com (trailing slash stripped)
  consumerKey: string; // ck_...
  consumerSecret: string; // cs_...
  webhookSecret?: string; // Generated secret for webhook HMAC SHA256 validation
  apiVersion?: 'wc/v3'; // default 'wc/v3'
  verifySsl?: boolean; // default true
}

export interface WooCommerceAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface WooCommerceLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id?: number;
  quantity: number;
  tax_class?: string;
  subtotal?: string;
  subtotal_tax?: string;
  total: string;
  total_tax?: string;
  sku?: string;
  price?: number | string;
}

export interface WooCommerceRawOrder {
  id: number;
  parent_id?: number;
  number: string;
  order_key?: string;
  status: string;
  currency: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_total?: string;
  discount_tax?: string;
  shipping_total?: string;
  shipping_tax?: string;
  cart_tax?: string;
  total: string;
  total_tax?: string;
  prices_include_tax?: boolean;
  customer_id?: number;
  customer_ip_address?: string;
  customer_user_agent?: string;
  customer_note?: string;
  billing?: WooCommerceAddress;
  shipping?: WooCommerceAddress;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  date_paid?: string | null;
  date_paid_gmt?: string | null;
  date_completed?: string | null;
  date_completed_gmt?: string | null;
  line_items: WooCommerceLineItem[];
  meta_data?: Array<{ id: number; key: string; value: any }>;
}

export interface WooCommerceRawProduct {
  id: number;
  name: string;
  slug?: string;
  permalink?: string;
  type: 'simple' | 'variable' | 'grouped' | 'external';
  status: string;
  featured?: boolean;
  description?: string;
  short_description?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  weight?: string;
  dimensions?: {
    length?: string;
    width?: string;
    height?: string;
  };
  categories?: Array<{ id: number; name: string; slug?: string }>;
  images?: Array<{ id: number; src: string; name?: string; alt?: string }>;
  variations?: number[];
}

export interface WooCommerceProductVariation {
  id: number;
  date_created?: string;
  date_modified?: string;
  description?: string;
  permalink?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  weight?: string;
  attributes?: Array<{ id: number; name: string; option: string }>;
}

export interface WooCommerceRawCategory {
  id: number;
  name: string;
  slug?: string;
  parent?: number;
  description?: string;
  count?: number;
}

export interface WooCommerceSystemStatus {
  environment?: {
    home_url?: string;
    site_url?: string;
    version?: string; // WooCommerce version
    wp_version?: string; // WordPress version
    language?: string;
    server_info?: string;
    php_version?: string;
    mysql_version?: string;
    default_timezone?: string;
  };
  settings?: {
    currency?: string;
    currency_symbol?: string;
    currency_position?: string;
    thousand_separator?: string;
    decimal_separator?: string;
    number_of_decimals?: number;
    prices_include_tax?: boolean;
    tax_round_at_subtotal?: boolean;
  };
}

export interface WooCommerceWebhookEvent {
  id: number;
  name?: string;
  status?: string;
  topic?: string;
  resource?: string;
  event?: string;
  hooks?: string[];
  delivery_url?: string;
  secret?: string;
  date_created?: string;
}
