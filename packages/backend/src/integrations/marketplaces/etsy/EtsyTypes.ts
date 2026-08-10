/**
 * Etsy returns money as an integer plus the divisor that scales it, so 12.34 USD
 * arrives as { amount: 1234, divisor: 100, currency_code: 'USD' }.
 */
export interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code: string;
}

export interface EtsyTransaction {
  sku: string;
  title: string;
  quantity: number;
  price: number; // already scaled by divisor
}

export interface EtsyReceipt {
  receipt_id: number;
  name: string;
  buyer_email?: string;
  first_line?: string;
  city?: string;
  state?: string;
  country_iso?: string;
  status: string; // 'open' | 'paid' | 'completed' | 'canceled'
  is_shipped: boolean;
  total: number; // already scaled by divisor
  currency: string;
  transactions: EtsyTransaction[];
}

export interface EtsyListing {
  listing_id: number;
  sku: string;
  title: string;
  description?: string;
  price: number; // already scaled by divisor
  quantity: number;
  image?: string;
}
