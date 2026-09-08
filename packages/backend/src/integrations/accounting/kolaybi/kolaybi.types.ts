export type KolaybiVatRate = 0 | 1 | 8 | 10 | 18 | 20;

export const KOLAYBI_VALID_VAT_RATES: readonly number[] = [0, 1, 8, 10, 18, 20];

export interface KolaybiInvoiceItemPayload {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  vat_rate: KolaybiVatRate;
  discount_rate?: number;
  discount_amount?: number;
  gross_total?: number;
  net_total?: number;
  tax_total?: number;
}

export interface KolaybiInvoicePayload {
  contact_id: string;
  address_id?: string;
  order_date: string; // YYYY-MM-DD
  currency: string; // 'try'
  exchange_rate?: number;
  invoice_no?: string;
  category_id?: string;
  description?: string;
  notes?: string;
  items: KolaybiInvoiceItemPayload[];
}

export interface KolaybiContactPayload {
  name: string;
  identity_no: string; // TCKN (11 digits) or VKN (10 digits)
  tax_office?: string;
  type: 'person' | 'company';
  email?: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
}

export interface KolaybiPaymentPayload {
  invoice_id: string;
  amount: number;
  payment_date: string; // YYYY-MM-DD
  payment_type: 'cash' | 'credit_card' | 'bank_transfer';
  account_id?: string;
  description?: string;
}

export interface KolaybiProductPayload {
  name: string;
  code: string;
  tax_rate: KolaybiVatRate;
  buying_price?: number;
  selling_price: number;
  currency?: string;
  quantity?: number; // Report matris note: KolayBi API contains quantity field
}

export interface KolaybiApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface KolaybiInvoiceData {
  id: string;
  invoice_no?: string;
  status?: string; // draft, ready_to_send, sent, approved, rejected, cancelled
  total?: number;
  currency?: string;
  created_at?: string;
}

export interface KolaybiContactData {
  id: string;
  name: string;
  identity_no: string;
}

export interface KolaybiPaymentData {
  id: string;
  invoice_id: string;
  amount: number;
}

export interface KolaybiProductData {
  id: string;
  code: string;
  name: string;
  quantity?: number;
}
