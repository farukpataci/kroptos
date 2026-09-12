import { AccountingEnvironment } from '../core/AccountingTypes';

export type ExactCountry = 'NL' | 'BE' | 'DE' | 'UK' | 'US' | 'ES';

export interface ExactRegionalConfig {
  country: ExactCountry;
  name: string;
  baseUrl: string;
  authUrl: string;
  tokenUrl: string;
}

export const EXACT_REGIONAL_CONFIGS: Record<ExactCountry, ExactRegionalConfig> = {
  NL: {
    country: 'NL',
    name: 'Netherlands',
    baseUrl: 'https://start.exactonline.nl',
    authUrl: 'https://start.exactonline.nl/api/oauth2/auth',
    tokenUrl: 'https://start.exactonline.nl/api/oauth2/token',
  },
  BE: {
    country: 'BE',
    name: 'Belgium',
    baseUrl: 'https://start.exactonline.be',
    authUrl: 'https://start.exactonline.be/api/oauth2/auth',
    tokenUrl: 'https://start.exactonline.be/api/oauth2/token',
  },
  DE: {
    country: 'DE',
    name: 'Germany',
    baseUrl: 'https://start.exactonline.de',
    authUrl: 'https://start.exactonline.de/api/oauth2/auth',
    tokenUrl: 'https://start.exactonline.de/api/oauth2/token',
  },
  UK: {
    country: 'UK',
    name: 'United Kingdom',
    baseUrl: 'https://start.exactonline.co.uk',
    authUrl: 'https://start.exactonline.co.uk/api/oauth2/auth',
    tokenUrl: 'https://start.exactonline.co.uk/api/oauth2/token',
  },
  US: {
    country: 'US',
    name: 'United States',
    baseUrl: 'https://start.exactonline.com',
    authUrl: 'https://start.exactonline.com/api/oauth2/auth',
    tokenUrl: 'https://start.exactonline.com/api/oauth2/token',
  },
  ES: {
    country: 'ES',
    name: 'Spain',
    baseUrl: 'https://start.exactonline.es',
    authUrl: 'https://start.exactonline.es/api/oauth2/auth',
    tokenUrl: 'https://start.exactonline.es/api/oauth2/token',
  },
};

/**
 * Exact Online Rate Limit Headers (§3.3 & §5.1)
 * X-RateLimit-Reset is UTC epoch in MILLISECONDS.
 */
export interface ExactRateLimitHeaders {
  minutelyLimit?: number;
  minutelyRemaining?: number;
  dailyLimit?: number;
  dailyRemaining?: number;
  resetEpochMs?: number; // UTC milliseconds
}

export type ExactJobPriority = 'WRITE' | 'READ';

export interface ExactBudgetState {
  division: number | string;
  minutelyLimit: number;
  minutelyRemaining: number;
  dailyLimit: number;
  dailyRemaining: number;
  resetEpochMs: number;
  lastUpdated: number;
}

export interface ExactBudgetReserveOptions {
  division: number | string;
  estimatedCalls: number;
  priority: ExactJobPriority;
}

export interface ExactMeResponse {
  CurrentDivision: number;
  DivisionCustomer: string;
  FullName: string;
  UserID: string;
  UserName: string;
  Email: string;
}

export interface ExactDivision {
  Code: number;
  Description: string;
  HID: number;
  Customer: string;
  CustomerName: string;
  Status: number; // 1 = Active
  Currency: string;
  Country: string;
}

export interface ExactAccount {
  ID: string; // GUID
  Code: string;
  Name: string;
  IsCustomer: boolean;
  IsSupplier: boolean;
  Email?: string;
  Phone?: string;
  AddressLine1?: string;
  Postcode?: string;
  City?: string;
  Country?: string;
  VATNumber?: string;
  Status?: string;
}

export interface ExactItem {
  ID: string; // GUID
  Code: string;
  Description: string;
  CostPriceNew?: number;
  IsSalesItem?: boolean;
  IsStockItem?: boolean;
}

export interface ExactVATCode {
  Code: string;
  Description: string;
  Percentage: number;
  Type: string;
}

export interface ExactSalesInvoiceLine {
  ID?: string; // GUID
  LineNumber?: number;
  Item?: string; // Item GUID
  ItemDescription?: string;
  Quantity: number;
  UnitPrice: number;
  VATCode: string;
  VATPercentage?: number;
  VATAmount?: number;
  AmountDC?: number; // Total amount in default currency excl. VAT
  AmountFC?: number; // Foreign currency amount
  Notes?: string;
}

export interface ExactSalesInvoice {
  InvoiceID?: string; // GUID
  InvoiceNumber?: number;
  InvoiceDate: string; // YYYY-MM-DD
  DueDate?: string; // YYYY-MM-DD
  OrderedBy: string; // Account GUID (Customer)
  DeliverTo?: string; // Account GUID
  YourRef?: string; // Customer PO reference / Order reference (§5.8)
  Description?: string;
  Currency?: string;
  Status?: number; // 20 = Open, 50 = Processed
  Type?: number; // 8020 = Sales invoice, 8021 = Sales credit note
  AmountDC?: number; // Total amount in DC incl. VAT
  AmountFC?: number;
  VATAmountDC?: number;
  SalesInvoiceLines?: ExactSalesInvoiceLine[];
}

export interface ExactODataResponse<T> {
  d: {
    results: T[];
    __next?: string;
  };
}

export interface ExactTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // usually 600
}

export interface ExactReconciliationResult {
  isMatch: boolean;
  diff: number;
  kroptosTotal: number;
  exactTotal: number;
  message?: string;
}
