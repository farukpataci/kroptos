export interface HepsiburadaCustomer {
  name: string;
  email?: string;
  phone?: string;
}

export interface HepsiburadaShippingAddress {
  address: string;
  city: string;
  /** Hepsiburada's name for the district (ilce) — not a separate town. */
  town: string;
  /** Passed through when the payload carries them; dropped before, silently. */
  neighborhood?: string;
  postalCode?: string;
}

export interface HepsiburadaItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface HepsiburadaOrder {
  id: string;
  orderNumber: string;
  customer: HepsiburadaCustomer;
  shippingAddress: HepsiburadaShippingAddress;
  items: HepsiburadaItem[];
  /** Folded by the connector: created | picking | invoiced | shipped | delivered | cancelled | returned */
  status: string;
  totalAmount: number;
  currency: string;
}

export interface HepsiburadaProduct {
  hepsiburadaSku: string;
  merchantSku: string; // SKU
  name: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  barcode?: string;
}
