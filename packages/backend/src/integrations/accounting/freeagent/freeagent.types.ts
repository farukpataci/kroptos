/**
 * FreeAgent API v2 Core Types & Schemas
 * Resmî FreeAgent API v2 dokümantasyonu doğrulanmış veri modelleri.
 */

export const FREEAGENT_PRODUCTION_BASE_URL = 'https://api.freeagent.com/v2';
export const FREEAGENT_SANDBOX_BASE_URL = 'https://api.sandbox.freeagent.com/v2';

export type FreeAgentEnvironment = 'MOCK' | 'TEST' | 'PRODUCTION';

/**
 * FreeAgent Fatura Durumları (Salt Okunur)
 * FreeAgent API v2 dokümanında tanımlı resmî enum listesi.
 */
export type FreeAgentInvoiceStatus =
  | 'Draft'
  | 'Scheduled To Email'
  | 'Open'
  | 'Zero Value'
  | 'Overdue'
  | 'Paid'
  | 'Overpaid'
  | 'Refunded'
  | 'Written-off'
  | 'Part written-off';

/**
 * FreeAgent Fatura Geçişleri (Transitions)
 * Yan etkisiz durum değiştirme aksiyonları.
 * Not: mark_as_sent e-posta GÖNDERMEZ (§5.2).
 */
export type FreeAgentInvoiceTransition =
  | 'mark_as_draft'
  | 'mark_as_sent'
  | 'mark_as_scheduled'
  | 'mark_as_cancelled';

export interface FreeAgentCompany {
  url: string;
  name: string;
  subdomain: string;
  type: string;
  currency: string;
  mileage_units?: string;
  company_start_date?: string;
  freeagent_start_date?: string;
  first_accounting_year_end?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  town?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

export interface FreeAgentUser {
  url: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  permission_level?: number;
}

export interface FreeAgentContact {
  url?: string;
  id?: string | number;
  name?: string;
  organisation_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  town?: string;
  region?: string;
  postcode?: string;
  country?: string;
  contact_name_on_invoices?: boolean;
  locale?: string;
  charge_sales_tax?: 'Auto' | 'Always' | 'Never';
}

export interface FreeAgentCategory {
  url: string;
  description: string;
  nominal_code: string;
  category_group: string;
  allowable_for_tax?: boolean;
  auto_sales_tax_rate?: number;
}

export interface FreeAgentInvoiceItem {
  url?: string;
  position?: number;
  description: string;
  item_type?: 'Hours' | 'Days' | 'Services' | 'Products' | 'Expenses' | 'Discount' | 'Credit';
  price: number;
  quantity: number;
  category: string; // Zorunlu muhasebe kategorisi URI'si (ör. https://api.freeagent.com/v2/categories/001)
  sales_tax_rate?: number; // UK standart KDV (ör. 20, 5, 0)
  second_sales_tax_rate?: number; // Yalnızca Universal hesaplar içindir (§5.4)
  sales_tax_status?: string;
  second_sales_tax_status?: string;
  stock_item?: string;
}

export interface FreeAgentInvoice {
  url?: string;
  id?: string | number;
  contact: string; // Contact URI
  dated_on: string; // YYYY-MM-DD
  due_on?: string; // YYYY-MM-DD
  payment_terms_in_days?: number;
  reference?: string; // Fatura numarası (boş bırakılırsa FreeAgent otomatik sıralar)
  currency?: string; // Varsayılan GBP
  exchange_rate?: number;
  comments?: string;
  po_reference?: string; // KroptOS harici referans kodu buraya yazılır (§5.9)
  status?: FreeAgentInvoiceStatus;
  long_status?: string;
  involves_sales_tax?: boolean;
  is_ec_status?: boolean;

  // Salt okunur sunucu tarafından hesaplanan tutarlar (§5.3)
  net_value?: number;
  sales_tax_value?: number;
  second_sales_tax_value?: number;
  total_value?: number;
  paid_value?: number;
  due_value?: number;

  invoice_items: FreeAgentInvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentBankAccount {
  url: string;
  id?: string | number;
  name: string;
  bank_name?: string;
  type: string;
  currency: string;
  current_balance?: number;
  is_personal?: boolean;
  primary?: boolean;
}

export interface FreeAgentBankTransactionExplanation {
  url?: string;
  id?: string | number;
  bank_account: string; // BankAccount URI
  dated_on: string; // YYYY-MM-DD
  gross_value: number; // Pozitif tutar fatura tahsilatı için
  paid_invoice: string; // Invoice URI
  description?: string;
}

export interface FreeAgentPaginationParams {
  page?: number;
  per_page?: number; // Max 100
  view?: string;
  updated_since?: string;
}

export interface FreeAgentPaginatedResponse<T> {
  items: T[];
  totalCount?: number;
  nextPage?: number;
  prevPage?: number;
  firstPage?: number;
  lastPage?: number;
}

export interface FreeAgentReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  freeagentTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}
