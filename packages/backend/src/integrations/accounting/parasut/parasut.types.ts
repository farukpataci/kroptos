/**
 * Paraşüt API v4 Data Types
 * Follows JSON:API v1.0 specification.
 * Fields marked with DOCUMENTATION_REQUIRED are provisional and need
 * official confirmation before TEST/PRODUCTION verification.
 */

export interface ParasutJsonApiResource<TAttributes = any, TRelationships = any> {
  id?: string;
  type: string;
  attributes: TAttributes;
  relationships?: TRelationships;
}

export interface ParasutOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  created_at?: number;
}

export interface ParasutContactAttributes {
  name: string;
  email?: string;
  tax_number?: string;
  tax_office?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  account_type?: 'customer' | 'vendor';
  // DOCUMENTATION_REQUIRED: Additional contact classification attributes in v4
  is_abroad?: boolean;
}

export interface ParasutInvoiceItemAttributes {
  name: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  discount_value?: number;
  discount_type?: 'percentage' | 'amount';
  // DOCUMENTATION_REQUIRED: Withholding tax / ÖTV / description in v4 item lines
  description?: string;
}

export interface ParasutSalesInvoiceAttributes {
  item_type: 'invoice';
  description?: string;
  issue_date: string; // YYYY-MM-DD
  due_date?: string; // YYYY-MM-DD
  invoice_series?: string;
  invoice_id?: number;
  currency: string;
  // DOCUMENTATION_REQUIRED: Withholding / tevkifat / istisna codes in v4
  exchange_rate?: number;
  net_total?: number;
}

export interface ParasutPaymentAttributes {
  date: string; // YYYY-MM-DD
  amount: number;
  description?: string;
  // DOCUMENTATION_REQUIRED: Payment method enum in v4 (credit_card, cash, bank)
  payment_type?: string;
}

export interface ParasutProductAttributes {
  name: string;
  code?: string;
  vat_rate?: number;
  currency?: string;
  list_price?: number;
  // DOCUMENTATION_REQUIRED: Inventory tracking flags in v4
  inventory_tracking?: boolean;
}
