/**
 * QuickBooks Online (QBO) Accounting API Types
 * API v3 (minorversion=75)
 */

export const QBO_API_MINORVERSION = '75';

export interface QBOReferenceType {
  value: string;
  name?: string;
  type?: string;
}

export interface QBOSalesItemLineDetail {
  ItemRef?: QBOReferenceType;
  ClassRef?: QBOReferenceType;
  UnitPrice?: number;
  Qty?: number;
  TaxCodeRef?: QBOReferenceType;
  ServiceDate?: string;
}

export interface QBODiscountLineDetail {
  PercentBased?: boolean;
  DiscountPercent?: number;
  DiscountAccountRef?: QBOReferenceType;
}

export interface QBOLine {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: 'SalesItemLineDetail' | 'DiscountLineDetail' | 'SubTotalLineDetail';
  SalesItemLineDetail?: QBOSalesItemLineDetail;
  DiscountLineDetail?: QBODiscountLineDetail;
}

export interface QBOTaxLineDetail {
  TaxRateRef: QBOReferenceType;
  PercentBased?: boolean;
  TaxPercent?: number;
  NetAmountTaxable?: number;
}

export interface QBOTaxLine {
  Amount: number;
  DetailType: 'TaxLineDetail';
  TaxLineDetail: QBOTaxLineDetail;
}

export interface QBOTxnTaxDetail {
  TxnTaxCodeRef?: QBOReferenceType;
  TotalTax?: number;
  TaxLine?: QBOTaxLine[];
}

export interface QBOInvoice {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  CustomerRef: QBOReferenceType;
  Line: QBOLine[];
  TxnTaxDetail?: QBOTxnTaxDetail;
  CustomerMemo?: { value: string };
  PrivateNote?: string;
  BillEmail?: { Address: string };
  CurrencyRef?: QBOReferenceType;
  ExchangeRate?: number;
  TotalAmt?: number;
  Balance?: number;
  sparse?: boolean;
  MetaData?: {
    CreateTime?: string;
    LastUpdatedTime?: string;
  };
  LinkedTxn?: Array<{
    TxnId: string;
    TxnType: string;
  }>;
}

export interface QBOCustomer {
  Id?: string;
  SyncToken?: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  TaxIdentifier?: string;
}

export interface QBOItem {
  Id?: string;
  SyncToken?: string;
  Name: string;
  Sku?: string;
  Type: 'Inventory' | 'NonInventory' | 'Service';
  UnitPrice?: number;
  IncomeAccountRef?: QBOReferenceType;
  ExpenseAccountRef?: QBOReferenceType;
  AssetAccountRef?: QBOReferenceType;
}

export interface QBOPaymentLine {
  Amount: number;
  LinkedTxn: Array<{
    TxnId: string;
    TxnType: 'Invoice';
  }>;
}

export interface QBOPayment {
  Id?: string;
  SyncToken?: string;
  CustomerRef: QBOReferenceType;
  TotalAmt: number;
  TxnDate?: string;
  DepositToAccountRef?: QBOReferenceType;
  PaymentMethodRef?: QBOReferenceType;
  PaymentRefNum?: string;
  Line?: QBOPaymentLine[];
}

export interface QBOPreferences {
  TaxPrefs?: {
    UsingSalesTax?: boolean;
    PartnerTaxEnabled?: boolean; // Automated Sales Tax (AST)
  };
  CurrencyPrefs?: {
    MultiCurrencyEnabled?: boolean;
    HomeCurrency?: QBOReferenceType;
  };
}

export interface QBOCompanyInfo {
  Id?: string;
  CompanyName?: string;
  LegalName?: string;
  CompanyAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Country?: string;
  FiscalYearStartMonth?: string;
}

export interface QBOErrorDetail {
  Message: string;
  Detail?: string;
  code: string;
  element?: string;
}

export interface QBOFault {
  Error: QBOErrorDetail[];
  type: string;
}

export interface QBOErrorResponse {
  Fault: QBOFault;
  time?: string;
}
