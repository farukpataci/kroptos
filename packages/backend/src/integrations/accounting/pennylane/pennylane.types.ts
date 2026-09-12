export type PennylaneVatRateCode =
  | 'FR_200' // 20.0% Standard VAT
  | 'FR_100' // 10.0% Intermediate VAT
  | 'FR_055' // 5.5% Reduced VAT
  | 'FR_021' // 2.1% Super-reduced VAT
  | 'exempt'; // 0.0% Exempt

export interface PennylaneInvoiceLineRequest {
  label: string;
  quantity: string | number;
  unit?: string;
  raw_currency_unit_price: string; // Parasal tutarlar STRING olmak ZORUNDADIR (§5.2)
  vat_rate: PennylaneVatRateCode;
  product_id?: number;
}

export interface PennylaneCreateInvoiceRequest {
  customer_id: number;
  date: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  draft: true; // §5.1: draft: true ZORUNLUDUR, asla false veya tanımsız olamaz!
  currency?: string; // Varsayılan: EUR
  external_reference?: string; // KroptOS referansı (§5.5)
  invoice_lines: PennylaneInvoiceLineRequest[];
}

export interface PennylaneInvoiceResponse {
  id: number;
  invoice_number?: string | null;
  draft: boolean;
  status: string; // draft, pending, paid, etc.
  date: string;
  deadline: string;
  amount: string; // EUR-normalized
  currency_amount: string; // Belge para biriminde toplam
  remaining_amount_with_tax: string;
  paid: boolean;
  customer_id: number;
  external_reference?: string | null;
  invoice_lines?: Array<{
    id?: number;
    label: string;
    quantity: string | number;
    raw_currency_unit_price: string;
    vat_rate: string;
    amount?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface PennylaneCustomerRequest {
  name: string;
  reg_no?: string; // SIREN / SIRET
  vat_number?: string;
  emails?: string[];
  phone?: string;
  address?: {
    address?: string;
    postal_code?: string;
    city?: string;
    country_alpha2?: string;
  };
  external_reference?: string;
}

export interface PennylaneCustomerResponse {
  id: number;
  name: string;
  reg_no?: string | null;
  vat_number?: string | null;
  emails?: string[];
  external_reference?: string | null;
  created_at?: string;
}

export interface PennylaneProductRequest {
  label: string;
  reference?: string;
  unit?: string;
  vat_rate?: PennylaneVatRateCode;
  price_before_tax?: string; // Monetary as string
}

export interface PennylaneProductResponse {
  id: number;
  label: string;
  reference?: string | null;
  unit?: string | null;
  vat_rate?: string | null;
  price_before_tax?: string | null;
}

export interface PennylaneFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gteq' | 'lt' | 'lteq' | 'in';
  value: string;
}

export interface PennylaneListResponse<T> {
  items: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface PennylaneReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  pennylaneTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}
