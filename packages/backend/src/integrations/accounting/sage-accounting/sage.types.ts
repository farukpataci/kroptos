/**
 * Sage Business Cloud Accounting API Types (v3.1)
 */

export interface SageCredentials {
  businessId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface SagePaginationEnvelope<T> {
  $total: number;
  $page: number;
  $next: string | null;
  $itemsPerPage: number;
  $items: T[];
}

export interface SageResourceRef {
  id: string;
  displayed_as?: string;
  $path?: string;
}

export interface SageBusiness {
  id: string;
  displayed_as?: string;
  $path?: string;
  name: string;
  country?: SageResourceRef;
  currency?: SageResourceRef;
}

export interface SageAddress {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postal_code?: string;
  country?: SageResourceRef;
}

export interface SageContact {
  id: string;
  displayed_as?: string;
  $path?: string;
  name: string;
  contact_type_ids: string[];
  reference?: string;
  email?: string;
  tax_number?: string;
  currency?: SageResourceRef;
  main_address?: SageAddress;
}

export interface SageContactCreatePayload {
  contact: {
    name: string;
    contact_type_ids: string[];
    reference?: string;
    email?: string;
    tax_number?: string;
    main_address?: {
      address_line_1?: string;
      city?: string;
      postal_code?: string;
      country_id?: string;
    };
  };
}

export interface SageLedgerAccount {
  id: string;
  displayed_as?: string;
  $path?: string;
  name: string;
  nominal_code?: number;
  ledger_account_type?: SageResourceRef;
  included_in_chart?: boolean;
}

export interface SageTaxRate {
  id: string;
  displayed_as?: string;
  $path?: string;
  name: string;
  percentage: number;
  is_visible?: boolean;
}

export interface SageInvoiceLine {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  net_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  tax_rate?: SageResourceRef;
  tax_rate_id?: string;
  ledger_account?: SageResourceRef;
  ledger_account_id?: string;
  product_id?: string;
  discount_amount?: number;
}

export interface SageSalesInvoice {
  id: string;
  displayed_as?: string;
  $path?: string;
  invoice_number?: string;
  contact_name?: string;
  contact?: SageResourceRef;
  date: string;
  due_date?: string;
  reference?: string;
  status?: SageResourceRef;
  net_amount: number;
  tax_amount: number;
  total_amount: number;
  outstanding_amount?: number;
  currency?: SageResourceRef;
  invoice_lines: SageInvoiceLine[];
}

export interface SageSalesInvoiceCreatePayload {
  sales_invoice: {
    contact_id: string;
    date: string;
    due_date?: string;
    reference: string;
    invoice_lines: Array<{
      description: string;
      ledger_account_id: string;
      quantity: number;
      unit_price: number;
      tax_rate_id: string;
      product_id?: string;
      discount_amount?: number;
    }>;
  };
}

export interface SageOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type?: string;
  scope?: string;
}
