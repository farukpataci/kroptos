/**
 * Zalando zDirect response shapes, narrowed to what this connector reads.
 *
 * PROVENANCE — read this before changing a field name.
 *
 * 1. `ZalandoTokenResponse` and `ZalandoIdentity` come from Zalando's
 *    Authentication OpenAPI spec, fetched directly from
 *    `developers.merchants.zalando.com`. First-party, reliable.
 *
 * 2. The order, stock and price shapes come from the published zDirect
 *    OpenAPI documents for those APIs. Zalando serves only the authentication
 *    spec from its own host — every other spec path answers 403 or returns the
 *    documentation SPA shell — so these were taken from a public mirror
 *    (github.com/api-evangelist/zalando). MIRROR, NOT FIRST PARTY.
 *
 *    They corroborate against what Zalando does publish: the operation id
 *    `get-merchants-by-id-orders`, the `/merchants/{merchant-id}/…` path shape,
 *    the JSON:API envelope their RESTful API Guidelines mandate, and the
 *    authentication spec's own statement that "a bpid is also known as a
 *    Merchant Identifier". That is strong corroboration, not proof.
 *
 * Every read has a fallback, so an unexpected spelling degrades to a missing
 * field rather than a crash.
 */

// ---------------------------------------------------------------- First party

/** From the published Authentication API spec. */
export interface ZalandoTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * `GET /auth/me`.
 *
 * The merchant identifier arrives as `bpids` — an *array* of business partner
 * ids. There is no `merchant_id` field; an earlier version of this connector
 * read one and would have reported "no merchant" against every real account.
 */
export interface ZalandoIdentity {
  client_id?: string;
  user_id?: string;
  username?: string;
  bpids?: string[];
  groups?: string[];
  scopes?: string[];
}

// ------------------------------------------------------------- JSON:API frame

/**
 * The Orders API answers `application/vnd.api+json`: primary rows in `data`,
 * everything pulled in through `include` flattened into a sibling `included`
 * array. Relationships are resolved by matching ids, which is why the item and
 * line attributes below each carry their parent's id.
 */
export interface ZalandoResource<TAttributes> {
  type?: string;
  id?: string;
  attributes?: TAttributes;
}

export interface ZalandoMoney {
  amount?: number | string;
  currency?: string;
}

export interface ZalandoAddress {
  first_name?: string;
  last_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
  zip_code?: string;
  city?: string;
  country_code?: string;
  address_type?: string;
}

export interface ZalandoOrderAttributes {
  merchant_id?: string;
  order_id?: string;
  order_number?: string;
  order_date?: string;
  merchant_order_id?: string;
  exported?: boolean;
  sales_channel_id?: string;
  locale?: string;
  customer_number?: string;
  customer_email?: string;
  customer_phone?: { number?: string };
  /** `ZalandoFulfilled` or `PartnerFulfilled`. */
  order_type?: string;
  /** Enum: `initial` | `approved` | `fulfilled`. Note: no cancelled state. */
  status?: string;
  shipping_address?: ZalandoAddress;
  billing_address?: ZalandoAddress;
  shipment_number?: string;
  tracking_number?: string;
  order_lines_count?: number;
  order_lines_price_amount?: number | string;
  order_lines_price_currency?: string;
  shipping_costs?: ZalandoMoney;
  created_at?: string;
  modified_at?: string;
}

/**
 * A summarised view of the underlying order lines. Carries the identifiers and
 * the quantities but **no price** — money lives on the lines.
 */
export interface ZalandoOrderItemAttributes {
  order_item_id?: string;
  order_id?: string;
  /** Zalando's own product identifier. */
  article_id?: string;
  /** The merchant's product identifier — what ProductMapping keys on. */
  external_id?: string;
  description?: string;
  quantity_initial?: number;
  quantity_reserved?: number;
  quantity_shipped?: number;
  quantity_returned?: number;
  quantity_canceled?: number;
}

/** Exactly one sold product. This is where the price is stated. */
export interface ZalandoOrderLineAttributes {
  order_line_id?: string;
  order_item_id?: string;
  /** Enum: `initial` | `reserved` | `shipped` | `returned` | `canceled`. */
  status?: string;
  price?: ZalandoMoney;
}

export type ZalandoOrderResource = ZalandoResource<ZalandoOrderAttributes>;
export type ZalandoOrderItemResource = ZalandoResource<ZalandoOrderItemAttributes>;
export type ZalandoOrderLineResource = ZalandoResource<ZalandoOrderLineAttributes>;

/**
 * `included` mixes resource types in one array, distinguished by `type`. The
 * union is kept loose because the same document can also carry transitions and
 * shipments this connector does not read.
 */
export type ZalandoIncludedResource = ZalandoResource<
  ZalandoOrderItemAttributes & ZalandoOrderLineAttributes
>;

export interface ZalandoOrdersDocument {
  data?: ZalandoOrderResource[];
  included?: ZalandoIncludedResource[];
  meta?: { number_of_results?: number };
  links?: { next?: string };
}

// --------------------------------------------------------------------- Stocks

export interface ZalandoStockUpdateItem {
  sales_channel_id: string;
  ean: string;
  quantity: number;
}

export interface ZalandoStockUpdatesRequest {
  items: ZalandoStockUpdateItem[];
}

/**
 * The stock endpoint answers 207: the HTTP call succeeds and each item carries
 * its own verdict, so a per-item failure has to be read out of the body rather
 * than inferred from the status code.
 */
export interface ZalandoStockUpdatesResponse {
  results?: Array<{
    item?: ZalandoStockUpdateItem;
    result?: {
      /** `ACCEPTED` | `REJECTED` | `FAILED`. */
      status?: string;
      /** 0 ok · 101 validation · 102 internal · 104 awaiting onboarding. */
      code?: number;
      description?: string;
    };
  }>;
}
