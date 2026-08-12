/**
 * Zalando zDirect response shapes, narrowed to what this connector reads.
 *
 * The token and identity shapes come from Zalando's published Authentication
 * OpenAPI spec and are reliable. The order shapes below are DOĞRULANAMADI —
 * the orders spec is not publicly served, so field names are inferred from
 * Zalando's own RESTful API guidelines. Every read has a fallback so an
 * unexpected spelling degrades to a missing field rather than a crash.
 */

/** From the published Authentication API spec. */
export interface ZalandoTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/** `GET /auth/me` — identity and granted scopes. */
export interface ZalandoIdentity {
  client_id?: string;
  merchant_id?: string;
  merchantId?: string;
  scopes?: string[];
  scope?: string;
}

export interface ZalandoPrice {
  amount?: number | string;
  currency?: string;
}

export interface ZalandoOrderItem {
  ean?: string;
  merchant_sku?: string;
  article_id?: string;
  name?: string;
  quantity?: number;
  price?: ZalandoPrice;
}

export interface ZalandoOrder {
  order_number?: string;
  order_id?: string;
  status?: string;
  created_at?: string;
  currency?: string;
  gross_total?: ZalandoPrice;
  delivery_address?: {
    first_name?: string;
    last_name?: string;
    street?: string;
    city?: string;
    zip?: string;
    country_code?: string;
  };
  customer?: { email?: string };
  items?: ZalandoOrderItem[];
}

export interface ZalandoOrderPage {
  items?: ZalandoOrder[];
  content?: ZalandoOrder[];
  total_count?: number;
}
