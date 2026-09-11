export interface FortnoxInvoiceRow {
  ArticleNumber?: string;
  Description?: string;
  DeliveredQuantity: number;
  Price: number;
  AccountNumber?: number;
  VAT?: number; // e.g. 25, 12, 6, 0
  Unit?: string;
  Total?: number;
  Discount?: number;
  DiscountType?: 'AMOUNT' | 'PERCENT';
}

export interface FortnoxInvoice {
  DocumentNumber?: string | number;
  CustomerNumber: string;
  CustomerName?: string;
  InvoiceDate: string; // YYYY-MM-DD
  DueDate?: string; // YYYY-MM-DD
  Total?: number;
  TotalVAT?: number;
  Gross?: number;
  Net?: number;
  RoundOff?: number;
  Currency?: string; // SEK
  CurrencyRate?: number;
  YourOrderNumber?: string;
  YourReference?: string;
  OurReference?: string;
  Comments?: string;
  Booked?: boolean;
  Cancelled?: boolean;
  Credit?: string | number;
  InvoiceType?: 'INVOICE' | 'AGREEMENTINVOICE' | 'INTRESTINVOICE' | 'SUMMARYINVOICE' | 'CASHINVOICE';
  InvoiceRows: FortnoxInvoiceRow[];
  Sent?: boolean;
  EmailInformation?: {
    EmailAddressTo?: string;
    EmailSubject?: string;
    EmailBody?: string;
  };
}

export interface FortnoxInvoiceSingleResponse {
  Invoice: FortnoxInvoice;
}

export interface FortnoxInvoiceListItem {
  DocumentNumber: string | number;
  CustomerName: string;
  CustomerNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Total: number;
  Booked: boolean;
  Cancelled: boolean;
  Currency: string;
  YourOrderNumber?: string;
}

export interface FortnoxInvoicesListResponse {
  Invoices: FortnoxInvoiceListItem[];
  MetaInformation?: {
    '@TotalResources'?: number;
    '@TotalPages'?: number;
    '@CurrentPage'?: number;
  };
}

export interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
  OrganisationNumber?: string;
  Email?: string;
  Phone1?: string;
  Address1?: string;
  City?: string;
  ZipCode?: string;
  CountryCode?: string;
  Currency?: string;
  DefaultDeliveryTypes?: {
    Invoice?: 'PRINT' | 'EMAIL' | 'PRINTSERVICE' | 'ELECTRONICINVOICE';
  };
}

export interface FortnoxCustomerSingleResponse {
  Customer: FortnoxCustomer;
}

export interface FortnoxArticle {
  ArticleNumber: string;
  Description: string;
  SalesPrice: number;
  Unit?: string;
  VAT?: number;
  Type?: 'STOCK' | 'SERVICE';
}

export interface FortnoxArticleSingleResponse {
  Article: FortnoxArticle;
}

export interface FortnoxPayment {
  Number?: number;
  InvoiceNumber: number | string;
  Amount: number;
  PaymentDate: string; // YYYY-MM-DD
  Booked?: boolean;
  ModeOfPayment?: string;
}

export interface FortnoxPaymentSingleResponse {
  InvoicePayment: FortnoxPayment;
}

export interface FortnoxFinancialYear {
  Id: number;
  FromDate: string; // YYYY-MM-DD
  ToDate: string; // YYYY-MM-DD
  AccountingMethod?: string;
  Closed?: boolean;
}

export interface FortnoxFinancialYearsResponse {
  FinancialYears: FortnoxFinancialYear[];
}

export interface FortnoxErrorResponse {
  ErrorInformation?: {
    error?: number | string;
    message?: string;
    code?: number | string;
  };
}

export interface FortnoxOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface FortnoxConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  defaultSalesAccount?: number; // e.g. 3001 (Sales 25% VAT in Sweden BAS kontoplan)
  defaultVATRate?: number; // e.g. 25
}

export interface FortnoxSessionState {
  nonce: string;
  tenantId: string;
  storeId: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}
