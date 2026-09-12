/**
 * OpenCart Integration Types
 * Supporting OpenCart 2.x, 3.x, and 4.x standard API & REST endpoints.
 */

export interface OpencartCredentials {
  url: string; // Base store URL e.g. "https://www.magaza.com" or "magaza.com"
  username: string; // OpenCart API username
  apiKey: string; // OpenCart API key / secret
}

export interface OpencartLoginResponse {
  success?: string;
  api_token?: string; // OpenCart 3.x / 4.x
  token?: string; // OpenCart 2.x
  error?: string | Record<string, string>;
}

export interface OpencartRawProduct {
  product_id: string | number;
  name: string;
  description?: string;
  model?: string;
  sku?: string;
  upc?: string;
  ean?: string;
  quantity?: string | number;
  stock_status?: string;
  image?: string;
  price?: string | number;
  special?: string | number;
  tax_class_id?: string | number;
  date_added?: string;
  date_modified?: string;
  status?: string | number;
  categories?: Array<{ category_id: string | number; name?: string }>;
  options?: OpencartRawProductOption[];
  weight?: string | number;
  weight_class_id?: string | number;
}

export interface OpencartRawProductOption {
  product_option_id: string | number;
  option_id: string | number;
  name: string;
  type: string;
  value?: string;
  required?: string | number;
  product_option_value?: Array<{
    product_option_value_id: string | number;
    option_value_id: string | number;
    name: string;
    quantity?: string | number;
    price?: string | number;
    price_prefix?: string;
    sku?: string;
  }>;
}

export interface OpencartRawOrderProduct {
  order_product_id: string | number;
  product_id: string | number;
  name: string;
  model: string;
  quantity: string | number;
  price: string | number;
  total: string | number;
  tax?: string | number;
  reward?: string | number;
  options?: Array<{
    name: string;
    value: string;
    type?: string;
  }>;
}

export interface OpencartRawOrderTotal {
  code: string;
  title: string;
  value: string | number;
  sort_order?: number;
}

export interface OpencartRawOrder {
  order_id: string | number;
  invoice_no?: string | number;
  invoice_prefix?: string;
  store_name?: string;
  store_url?: string;
  customer_id?: string | number;
  firstname?: string;
  lastname?: string;
  email?: string;
  telephone?: string;
  custom_field?: Record<string, any>;
  
  // Payment / Billing Address
  payment_firstname?: string;
  payment_lastname?: string;
  payment_company?: string;
  payment_address_1?: string;
  payment_address_2?: string;
  payment_postcode?: string;
  payment_city?: string;
  payment_zone?: string;
  payment_zone_code?: string;
  payment_country?: string;
  payment_method?: string;
  payment_code?: string;

  // Shipping Address
  shipping_firstname?: string;
  shipping_lastname?: string;
  shipping_company?: string;
  shipping_address_1?: string;
  shipping_address_2?: string;
  shipping_postcode?: string;
  shipping_city?: string;
  shipping_zone?: string;
  shipping_zone_code?: string;
  shipping_country?: string;
  shipping_method?: string;
  shipping_code?: string;

  comment?: string;
  total: string | number;
  order_status_id: string | number;
  order_status?: string;
  currency_code?: string;
  currency_value?: string | number;
  date_added: string;
  date_modified: string;

  products?: OpencartRawOrderProduct[];
  totals?: OpencartRawOrderTotal[];
}

export interface OpencartRawCategory {
  category_id: string | number;
  name: string;
  parent_id?: string | number;
  status?: string | number;
}

export interface OpencartOrdersResponse {
  orders?: OpencartRawOrder[];
  success?: string | boolean;
  error?: string | Record<string, string>;
  total?: number;
}

export interface OpencartOrderInfoResponse {
  order?: OpencartRawOrder;
  order_id?: string | number;
  success?: string | boolean;
  error?: string | Record<string, string>;
}

export interface OpencartProductsResponse {
  products?: OpencartRawProduct[];
  success?: string | boolean;
  error?: string | Record<string, string>;
  total?: number;
}
