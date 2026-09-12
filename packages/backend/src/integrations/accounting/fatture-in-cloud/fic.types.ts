/**
 * Fatture in Cloud (TeamSystem) API v2 Types
 * Official OpenAPI & Developer Docs: https://developers.fattureincloud.it
 */

export const FIC_PROVIDER_NAME = 'fatture-in-cloud' as const;
export const FIC_API_BASE_URL = 'https://api-v2.fattureincloud.it' as const;

/**
 * 14 official e-invoice status values from Fatture in Cloud EiStatusEnum.
 * This axis is strictly independent from KroptOS document status.
 */
export type FicEiStatus =
  | 'attempt'
  | 'missing'
  | 'not_sent'
  | 'sent'
  | 'pending'
  | 'processing'
  | 'error'
  | 'discarded'
  | 'not_delivered'
  | 'accepted'
  | 'rejected'
  | 'no_response'
  | 'manual_accepted'
  | 'manual_rejected';

export const FIC_EI_STATUSES: readonly FicEiStatus[] = [
  'attempt',
  'missing',
  'not_sent',
  'sent',
  'pending',
  'processing',
  'error',
  'discarded',
  'not_delivered',
  'accepted',
  'rejected',
  'no_response',
  'manual_accepted',
  'manual_rejected',
] as const;

export type FicDocumentType =
  | 'invoice'
  | 'quote'
  | 'proforma'
  | 'receipt'
  | 'delivery_note'
  | 'credit_note'
  | 'order'
  | 'work_report'
  | 'supplier_order'
  | 'self_own_invoice'
  | 'self_supplier_invoice';

export type FicPaymentStatus = 'not_paid' | 'paid' | 'reversed';

export interface FicEntity {
  id?: number;
  name: string;
  vat_number?: string;
  tax_code?: string;
  address_street: string;
  address_postal_code: string;
  address_city: string;
  address_province: string;
  address_extra?: string;
  country: string;
  certified_email?: string;
  ei_code?: string;
}

export interface FicVatType {
  id: number;
  value?: number;
  description?: string;
  is_disabled?: boolean;
}

export interface FicDocumentItem {
  id?: number;
  product_id?: number;
  code?: string;
  name: string;
  category?: string;
  description?: string;
  qty: number;
  measure?: string;
  net_price?: number;
  gross_price?: number;
  vat: {
    id: number;
    value?: number;
  };
  not_taxable?: boolean;
  discount?: number;
  discount_highlight?: boolean;
  in_dn?: boolean;
  stock?: boolean;
  ei_raw?: Record<string, any>;
}

export interface FicPaymentAccount {
  id: number;
  name?: string;
  type?: 'standard' | 'bank';
  iban?: string;
  sia?: string;
  cuc?: string;
  virtual?: boolean;
}

export interface FicPaymentSchedule {
  id?: number;
  due_date: string; // YYYY-MM-DD
  amount: number;
  status: FicPaymentStatus;
  payment_account?: FicPaymentAccount;
  paid_date?: string;
  ei_raw?: Record<string, any>;
}

export interface FicEiData {
  vat_kind?: string;
  original_document_type?: string;
  od_number?: string;
  od_date?: string;
  cig?: string;
  cup?: string;
  payment_method?: string;
  bank_name?: string;
  bank_iban?: string;
  bank_beneficiary?: string;
  invoice_number?: string;
  invoice_date?: string;
}

export interface FicIssuedDocumentPayload {
  type: FicDocumentType;
  entity: FicEntity;
  date: string; // YYYY-MM-DD
  number?: number;
  numeration?: string;
  subject?: string;
  visible_subject?: string;
  currency: {
    id: string; // ISO 4217 e.g. 'EUR'
  };
  language: {
    code: string; // e.g. 'it'
  };
  items_list: FicDocumentItem[];
  payments_list?: FicPaymentSchedule[];
  use_gross_prices?: boolean;
  e_invoice?: boolean;
  ei_data?: FicEiData;
  notes?: string;
}

export interface FicIssuedDocumentResponse {
  id: number;
  type: FicDocumentType;
  entity: FicEntity;
  date: string;
  number: number;
  numeration?: string;
  amount_net: number;
  amount_vat: number;
  amount_gross: number;
  amount_due_discount?: number;
  use_gross_prices: boolean;
  e_invoice: boolean;
  ei_status?: FicEiStatus | string;
  ei_data?: FicEiData;
  items_list: FicDocumentItem[];
  payments_list: FicPaymentSchedule[];
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FicCompany {
  id: number;
  name: string;
  tax_code?: string;
  type?: 'company' | 'condo';
  access_token?: string;
  controlled_companies?: FicCompany[];
}

export interface FicUserCompaniesResponse {
  data: {
    companies: FicCompany[];
  };
}

export interface FicXmlVerifyResponse {
  data: {
    success: boolean;
    error?: string;
    extra?: Record<string, any>;
  };
}

export interface FicTotalsCalculationRequest {
  data: Partial<FicIssuedDocumentPayload>;
}

export interface FicTotalsCalculationResponse {
  data: {
    amount_net: number;
    amount_vat: number;
    amount_gross: number;
    amount_due_discount: number;
    amount_rivalsa?: number;
    amount_cassa?: number;
    amount_withholding_tax?: number;
    amount_other_withholding_tax?: number;
  };
}

export interface FicOAuthTokenResponse {
  token_type: 'bearer';
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
