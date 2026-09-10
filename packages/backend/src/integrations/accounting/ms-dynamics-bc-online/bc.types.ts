/**
 * Microsoft Dynamics 365 Business Central Online (API v2.0) Types
 * Source: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/resources/dynamics_salesinvoice
 */

export interface BusinessCentralCredentials {
  aadTenantId: string;
  environmentName: string; // e.g. 'production', 'sandbox'
  companyId: string; // GUID
  userDomain?: string; // Optional domain for direct tenant URL format
  clientId?: string; // Optional override; defaults to system-level BC_ONLINE_CLIENT_ID
  clientSecret?: string; // Optional override; defaults to system-level BC_ONLINE_CLIENT_SECRET
  defaultRetailContactId?: string;
}

export type BusinessCentralInvoiceStatus =
  | ''
  | 'Draft'
  | 'In Review'
  | 'Open'
  | 'Paid'
  | 'Canceled'
  | 'Corrective'
  | string;

export interface BusinessCentralSalesInvoiceHeader {
  id?: string; // Read-only: assigned by BC
  number?: string; // Read-only / auto-assigned readable document number
  externalDocumentNumber?: string; // KroptOS reference code
  invoiceDate: string; // YYYY-MM-DD
  postingDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  customerId: string; // GUID
  customerNumber?: string;
  customerName?: string;
  currencyCode?: string;
  paymentTermsId?: string;
  salesperson?: string;
  phoneNumber?: string;
  email?: string;
  status?: BusinessCentralInvoiceStatus; // Read-only
  // Read-only calculated amounts (BC calculates these):
  totalAmountExcludingTax?: number;
  totalTaxAmount?: number;
  totalAmountIncludingTax?: number;
  lastModifiedDateTime?: string;
  '@odata.etag'?: string;
  salesInvoiceLines?: BusinessCentralSalesInvoiceLine[];
}

export type BusinessCentralLineType =
  | 'Comment'
  | 'Account'
  | 'Item'
  | 'Resource'
  | 'Fixed Asset'
  | 'Charge';

export interface BusinessCentralSalesInvoiceLine {
  id?: string; // Read-only
  documentId?: string; // GUID of parent invoice
  sequence?: number;
  lineType?: BusinessCentralLineType;
  itemId?: string; // GUID
  lineObjectNumber?: string;
  description: string;
  unitOfMeasureCode?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  discountPercent?: number;
  taxCode?: string;
  // Read-only calculated amounts:
  amountExcludingTax?: number;
  taxPercent?: number;
  totalTaxAmount?: number;
  amountIncludingTax?: number;
  netAmount?: number;
  netTaxAmount?: number;
  netAmountIncludingTax?: number;
  '@odata.etag'?: string;
}

export interface BusinessCentralCustomer {
  id: string; // GUID
  number: string;
  displayName: string;
  type?: 'Company' | 'Person';
  email?: string;
  phoneNumber?: string;
  taxRegistrationNumber?: string;
  addressLine1?: string;
  city?: string;
  country?: string;
}

export interface BusinessCentralItem {
  id: string; // GUID
  number: string;
  displayName: string;
  type?: 'Inventory' | 'Service' | 'Non-Inventory';
  itemCategoryCode?: string;
  unitPrice?: number;
  baseUnitOfMeasureCode?: string;
}

export interface BusinessCentralCompany {
  id: string; // GUID
  name: string;
  displayName: string;
  businessProfileId?: string;
}

export interface BusinessCentralReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  bcTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}
