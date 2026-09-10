export interface XeroConnection {
  id: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
  createdDateUtc: string;
  updatedDateUtc: string;
}

export type XeroInvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AUTHORISED'
  | 'PAID'
  | 'VOIDED'
  | 'DELETED';

export type XeroLineAmountType = 'Exclusive' | 'Inclusive' | 'NoTax';

export interface XeroAddress {
  AddressType?: 'STREET' | 'POBOX' | 'DELIVERY';
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  Region?: string;
  PostalCode?: string;
  Country?: string;
}

export interface XeroPhone {
  PhoneType?: 'DEFAULT' | 'DDI' | 'MOBILE' | 'FAX';
  PhoneNumber?: string;
}

export interface XeroContact {
  ContactID?: string;
  ContactNumber?: string;
  AccountNumber?: string;
  ContactStatus?: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  TaxNumber?: string;
  IsCustomer?: boolean;
  IsSupplier?: boolean;
  Addresses?: XeroAddress[];
  Phones?: XeroPhone[];
}

export interface XeroLineItem {
  LineItemID?: string;
  Description: string;
  Quantity: number;
  UnitAmount: number;
  ItemCode?: string;
  AccountCode?: string;
  TaxType?: string;
  TaxAmount?: number;
  LineAmount?: number;
  DiscountRate?: number;
}

export interface XeroValidationError {
  Message: string;
}

export interface XeroInvoice {
  InvoiceID?: string;
  InvoiceNumber?: string;
  Type: 'ACCREC' | 'ACCPAY';
  Contact: XeroContact;
  LineItems: XeroLineItem[];
  Date?: string;
  DueDate?: string;
  LineAmountTypes?: XeroLineAmountType;
  Status?: XeroInvoiceStatus;
  Reference?: string;
  CurrencyCode?: string;
  CurrencyRate?: number;
  SubTotal?: number;
  TotalTax?: number;
  Total?: number;
  AmountDue?: number;
  AmountPaid?: number;
  AmountCredited?: number;
  UpdatedDateUTC?: string;
  ValidationErrors?: XeroValidationError[];
  Warnings?: XeroValidationError[];
}

export interface XeroPayment {
  PaymentID?: string;
  Invoice: {
    InvoiceID: string;
    InvoiceNumber?: string;
  };
  Account: {
    AccountID?: string;
    Code?: string;
  };
  Date: string;
  Amount: number;
  CurrencyRate?: number;
  Reference?: string;
  Status?: 'AUTHORISED' | 'DELETED';
  ValidationErrors?: XeroValidationError[];
}

export interface XeroItem {
  ItemID?: string;
  Code: string;
  Name: string;
  IsSold?: boolean;
  IsPurchased?: boolean;
  Description?: string;
  SalesDetails?: {
    UnitPrice?: number;
    AccountCode?: string;
    TaxType?: string;
  };
}

export interface XeroTaxRate {
  Name: string;
  TaxType: string;
  ReportTaxType: string;
  Status: string;
  DisplayTaxRate: number;
}

export interface XeroRateLimitInfo {
  minuteRemaining?: number;
  dayRemaining?: number;
  appMinuteRemaining?: number;
  retryAfterSeconds?: number;
}
