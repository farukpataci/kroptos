/**
 * Lexware Office (formerly lexoffice) API Types (§3, §5)
 * Base URL: https://api.lexware.io/v1
 * Currency: EUR strictly
 */

export type LexwareInvoiceStatus = 'draft' | 'open' | 'paid' | 'voided';

export type LexwareLineItemType = 'custom' | 'service' | 'material' | 'text';

export type LexwareLeadingPrice = 'NET' | 'GROSS';

export interface LexwareUnitPrice {
  currency: 'EUR';
  netAmount: number;
  grossAmount: number;
  taxRatePercentage: number;
}

export interface LexwareLineItem {
  id?: string;
  type: LexwareLineItemType;
  name: string;
  description?: string;
  quantity: number;
  unitName?: string;
  unitPrice: LexwareUnitPrice;
  discountPercentage?: number;
}

export interface LexwareTaxAmount {
  taxRatePercentage: number;
  taxAmount: number;
  netAmount: number;
}

export interface LexwareTotalPrice {
  currency: 'EUR';
  totalNetAmount: number;
  totalGrossAmount: number;
  totalTaxAmount: number;
}

export interface LexwareTaxConditions {
  taxType: 'net' | 'gross' | 'vatfree';
  taxTypeNote?: string;
}

export interface LexwareAddress {
  name: string;
  supplement?: string;
  street?: string;
  city?: string;
  zip?: string;
  countryCode: string;
}

export interface LexwareInvoice {
  id: string;
  organizationId?: string;
  createdDate?: string;
  updatedDate?: string;
  version: number;
  language?: string;
  archived?: boolean;
  voucherStatus: LexwareInvoiceStatus;
  voucherNumber?: string;
  voucherDate: string;
  dueDate?: string;
  address: LexwareAddress;
  lineItems: LexwareLineItem[];
  totalPrice: LexwareTotalPrice;
  taxAmounts: LexwareTaxAmount[];
  taxConditions: LexwareTaxConditions;
  introduction?: string;
  remark?: string;
  title?: string;
}

export interface LexwareCreateInvoiceRequest {
  voucherDate: string;
  address: LexwareAddress;
  lineItems: LexwareLineItem[];
  totalPrice: LexwareTotalPrice;
  taxAmounts: LexwareTaxAmount[];
  taxConditions: LexwareTaxConditions;
  introduction?: string;
  remark?: string;
  title?: string;
}

export interface LexwareContact {
  id: string;
  organizationId?: string;
  version: number;
  roles: {
    customer?: {
      number?: number;
    };
    vendor?: {
      number?: number;
    };
  };
  company?: {
    name: string;
    taxNumber?: string;
    vatRegistrationNumber?: string;
    allowTaxFreeInvoicing?: boolean;
  };
  person?: {
    salutation?: string;
    firstName?: string;
    lastName?: string;
  };
  addresses?: {
    billing?: LexwareAddress[];
    shipping?: LexwareAddress[];
  };
  emailAddresses?: {
    business?: string[];
    office?: string[];
    other?: string[];
  };
}

export interface LexwareArticle {
  id: string;
  organizationId?: string;
  version: number;
  title: string;
  description?: string;
  type?: 'product' | 'service';
  articleNumber?: string;
  unitName?: string;
  price: {
    leadingPrice: LexwareLeadingPrice;
    netPrice: number;
    grossPrice: number;
    taxRatePercentage: number;
  };
}

export interface LexwarePageResponse<T> {
  content: T[];
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  size: number;
  totalElements: number;
  totalPages: number;
  sort?: any[];
}

export interface LexwareErrorResponse {
  timestamp?: string;
  status?: number;
  error?: string;
  path?: string;
  traceId?: string;
  message?: string;
  i18nKey?: string;
  validationErrors?: Array<{
    field?: string;
    message?: string;
    error?: string;
  }>;
}

export interface LexwareReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  lexwareTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}
