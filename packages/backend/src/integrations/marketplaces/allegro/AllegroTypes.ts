/**
 * Allegro REST API shapes, narrowed to what this connector reads.
 *
 * Allegro states money as `{ amount: "12.34", currency: "PLN" }` strings —
 * major units, as decimal text.
 */

export interface AllegroTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface AllegroPrice {
  amount?: string;
  currency?: string;
}

export interface AllegroLineItem {
  id?: string;
  offer?: { id?: string; name?: string; external?: { id?: string } };
  quantity?: number;
  price?: AllegroPrice;
}

/** `/order/checkout-forms` — Allegro models an order as a checkout form. */
export interface AllegroCheckoutForm {
  id?: string;
  status?: string;
  updatedAt?: string;
  buyer?: {
    email?: string;
    login?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  };
  delivery?: {
    address?: {
      street?: string;
      city?: string;
      zipCode?: string;
      countryCode?: string;
    };
  };
  summary?: { totalToPay?: AllegroPrice };
  lineItems?: AllegroLineItem[];
}

export interface AllegroCheckoutFormsPage {
  checkoutForms?: AllegroCheckoutForm[];
  count?: number;
  totalCount?: number;
}

export interface AllegroOffer {
  id?: string;
  name?: string;
  /** The seller's own identifier, where one was supplied when listing. */
  external?: { id?: string };
  sellingMode?: { price?: AllegroPrice };
  stock?: { available?: number; sold?: number };
  primaryImage?: { url?: string };
  ean?: string;
}

export interface AllegroOffersPage {
  offers?: AllegroOffer[];
  count?: number;
  totalCount?: number;
}
