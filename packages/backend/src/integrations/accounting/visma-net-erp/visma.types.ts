/**
 * Visma.net ERP Types & DTOs
 *
 * Visma.net ERP uses Acumatica-style REST API with { value: T } field wrappers.
 */

export interface VismaValue<T> {
  value: T;
}

export type VismaInvoiceStatus =
  | 'Hold'
  | 'Balanced'
  | 'Voided'
  | 'Scheduled'
  | 'Open'
  | 'Closed'
  | 'InProcess'
  | 'Rejected';

export interface VismaInvoiceLineDto {
  operation?: 'Insert' | 'Update' | 'Delete';
  lineNumber?: VismaValue<number>;
  inventoryNumber?: VismaValue<string>;
  description?: VismaValue<string>;
  quantity?: VismaValue<number>;
  unitPriceInCurrency?: VismaValue<number>;
  manualAmountInCurrency?: VismaValue<number>;
  amountInCurrency?: VismaValue<number>;
  vatCodeId?: VismaValue<string>;
  accountNumber?: VismaValue<string>;
  uom?: VismaValue<string>;
  discountPercent?: VismaValue<number>;
  branchNumber?: VismaValue<string>;
}

export interface VismaCustomerInvoiceDto {
  invoiceNumber?: string;
  referenceNumber?: VismaValue<string>;
  documentType?: VismaValue<string>;
  customerNumber?: VismaValue<string>;
  customerRefNo?: VismaValue<string>;
  externalReference?: VismaValue<string>;
  documentDate?: VismaValue<string>;
  status?: VismaValue<VismaInvoiceStatus> | VismaInvoiceStatus;
  currencyId?: VismaValue<string>;
  invoiceText?: VismaValue<string>;
  amount?: number;
  vatAmount?: number;
  invoiceLines?: VismaInvoiceLineDto[];
  timestamp?: string;
}

export interface VismaCustomerDto {
  internalId?: number;
  number?: VismaValue<string>;
  name?: VismaValue<string>;
  status?: VismaValue<string>;
  corporateId?: VismaValue<string>;
  vatRegistrationId?: VismaValue<string>;
  email?: VismaValue<string>;
  invoiceAddress?: {
    addressLine1?: VismaValue<string>;
    addressLine2?: VismaValue<string>;
    postalCode?: VismaValue<string>;
    city?: VismaValue<string>;
    countryId?: VismaValue<string>;
  };
}

export interface VismaPaymentDto {
  paymentNumber?: string;
  referenceNumber?: VismaValue<string>;
  type?: VismaValue<string>;
  customerNumber?: VismaValue<string>;
  paymentMethod?: VismaValue<string>;
  cashAccount?: VismaValue<string>;
  paymentAmount?: VismaValue<number>;
  paymentRef?: VismaValue<string>;
  applicationDate?: VismaValue<string>;
  description?: VismaValue<string>;
  status?: VismaValue<string>;
}

/**
 * Visma Background Operation (§3)
 */
export type VismaBackgroundStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';

export interface VismaBackgroundJobResponse {
  jobId: string;
  stateLocation: string;
  contentLocation?: string;
  status: VismaBackgroundStatus;
  createdTime?: string;
  lastUpdated?: string;
  errorMessage?: string;
}

export interface VismaRateLimitInfo {
  limit?: number;
  remaining?: number;
  resetSeconds?: number;
  policy?: string;
  lastUpdated: number;
}

export interface VismaReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  vismaTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}

export interface VismaCustomerConfig {
  incomeAccount?: string;
  vatCodeId?: string;
  numberingSequence?: string;
  branchNumber?: string;
}

export const VISMA_OP_PREFIX = 'op:';
