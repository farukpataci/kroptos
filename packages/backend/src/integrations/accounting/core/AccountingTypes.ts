export enum CapabilityStatus {
  SUPPORTED = 'SUPPORTED',
  MOCK_ONLY = 'MOCK_ONLY',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  DOCUMENTATION_REQUIRED = 'DOCUMENTATION_REQUIRED',
  UNKNOWN = 'UNKNOWN',
}

export type AccountingEnvironment = 'MOCK' | 'TEST' | 'PRODUCTION';
export type AccountingReadiness = 'SCAFFOLDED' | 'MOCK_READY' | 'TEST_READY' | 'PRODUCTION_READY';

export type AccountingDocumentType =
  | 'sales_invoice'
  | 'payment'
  | 'purchase_invoice'
  | 'e_archive'
  | 'e_invoice';

export type AccountingDocumentStatus = 'pending' | 'created' | 'failed' | 'cancelled';

export interface CredentialFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'select';
  required: boolean;
  secret?: boolean;
  description?: string;
  defaultValue?: string;
}

export interface AccountingProviderSchema {
  provider: string;
  name: string;
  fields: CredentialFieldDefinition[];
}

export interface AccountingProviderDescriptor {
  id: string;
  displayName: string;
  country: string;
  protocol: 'rest' | 'jsonapi' | 'soap' | 'odata';
  readiness: AccountingReadiness;
  documentationStatus: 'VERIFIED' | 'PARTIAL' | 'DOCUMENTATION_REQUIRED';
  credentialSchema: AccountingProviderSchema;
  capabilities: AccountingCapabilities;
  supportsMock: boolean;
  supportsTest: boolean;
  supportsProduction: boolean;
  lastVerifiedAt: string | null;
  sandboxVerifiedAt?: string | null;
  connectorClass: any;
}

export interface AccountingCapabilities {
  salesInvoice: CapabilityStatus;
  payment: CapabilityStatus;
  contactSync: CapabilityStatus;
  productMapping: CapabilityStatus;
  stockSync: CapabilityStatus; // Paraşüt & KolayBi: strictly NOT_SUPPORTED
  eInvoiceOfficialSend: CapabilityStatus; // strictly NOT_SUPPORTED in Phase 1
  cancelInvoice: CapabilityStatus;
  findInvoiceByReference: CapabilityStatus;
  multiCompany?: CapabilityStatus;
  eDocument?: CapabilityStatus;
  refreshSemantics?: import('./AccountingTokenSemantics').RefreshSemantics;
}

export interface AccountingInvoiceItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // e.g. 20, 10, 1, 0
  vatAmount?: number;
  discountAmount?: number;
  totalAmount: number;
}

export interface AccountingInvoiceContact {
  id?: string;
  name: string;
  taxNumber?: string;
  taxOffice?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  isCompany?: boolean;
}

export interface AccountingInvoiceRequest {
  companyId: string;
  referenceCode: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  currency: string;
  contact: AccountingInvoiceContact;
  items: AccountingInvoiceItem[];
  subtotal: number;
  vatTotal: number;
  discountTotal?: number;
  grandTotal: number;
  notes?: string;
}

export interface AccountingInvoiceResult {
  externalId: string;
  externalNumber?: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingPaymentRequest {
  companyId: string;
  invoiceExternalId: string;
  referenceCode: string;
  amount: number;
  currency: string;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod?: string;
  accountId?: string;
  notes?: string;
}

export interface AccountingPaymentResult {
  externalId: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingContactRequest {
  companyId: string;
  kroptosKey: string;
  name: string;
  taxNumber?: string;
  taxOffice?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  isCompany?: boolean;
}

export interface AccountingContactResult {
  externalId: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingProductRequest {
  companyId: string;
  sku: string;
  name: string;
  code?: string;
  vatRate?: number;
  currency?: string;
  unitPrice?: number;
}

export interface AccountingProductResult {
  externalId: string;
  code?: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingTestConnectionResult {
  success: boolean;
  message: string;
  companyName?: string;
  companyId?: string;
  environment: AccountingEnvironment;
}
