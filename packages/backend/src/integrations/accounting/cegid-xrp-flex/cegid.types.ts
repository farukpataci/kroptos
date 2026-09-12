/**
 * Cegid XRP Flex API Tipleri ve Sözleşme Modelleri (§1, §2, §3)
 *
 * Acumatica Contract-Based REST API standardı gereğince tüm alanlar
 * `{ value?: T }` sarmalayıcısı (wrapper) ile taşınır.
 */

export interface FlexValue<T = any> {
  value?: T | null;
}

/**
 * Cegid XRP Flex OAuth 2.0 Kimlik Yanıtı (§2.b, §6.3)
 */
export interface CegidTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

/**
 * Müşteri / Cari Varlık Modeli (Customer Contract)
 */
export interface CegidCustomer {
  id?: string;
  rowNumber?: number;
  note?: string;
  CustomerID?: FlexValue<string>;
  CustomerName?: FlexValue<string>;
  CustomerClass?: FlexValue<string>;
  Status?: FlexValue<'Active' | 'Hold' | 'Inactive' | 'CreditHold' | string>;
  TaxRegistrationID?: FlexValue<string>;
  CurrencyID?: FlexValue<string>;
  MainContact?: {
    Email?: FlexValue<string>;
    Phone1?: FlexValue<string>;
    DisplayName?: FlexValue<string>;
    Attention?: FlexValue<string>;
    Address?: {
      AddressLine1?: FlexValue<string>;
      AddressLine2?: FlexValue<string>;
      City?: FlexValue<string>;
      State?: FlexValue<string>;
      PostalCode?: FlexValue<string>;
      Country?: FlexValue<string>;
    };
  };
  BillingContact?: {
    Email?: FlexValue<string>;
    Phone1?: FlexValue<string>;
    DisplayName?: FlexValue<string>;
    Address?: {
      AddressLine1?: FlexValue<string>;
      AddressLine2?: FlexValue<string>;
      City?: FlexValue<string>;
      State?: FlexValue<string>;
      PostalCode?: FlexValue<string>;
      Country?: FlexValue<string>;
    };
  };
  custom?: Record<string, any>;
}

/**
 * Satış Faturası Satır Modeli (SalesInvoiceDetail Contract)
 */
export interface CegidSalesInvoiceDetail {
  id?: string;
  rowNumber?: number;
  Branch?: FlexValue<string>;
  InventoryID?: FlexValue<string>;
  TransactionDescription?: FlexValue<string>;
  Qty?: FlexValue<number>;
  UOM?: FlexValue<string>;
  UnitPrice?: FlexValue<number>;
  Amount?: FlexValue<number>;
  TaxCategory?: FlexValue<string>;
  Account?: FlexValue<string>;
  Subaccount?: FlexValue<string>;
}

/**
 * Satış Faturası Varlık Modeli (SalesInvoice Contract)
 */
export interface CegidSalesInvoice {
  id?: string;
  rowNumber?: number;
  ReferenceNbr?: FlexValue<string>;
  Type?: FlexValue<'Invoice' | 'DebitMemo' | 'CreditMemo' | string>;
  CustomerID?: FlexValue<string>;
  CustomerOrder?: FlexValue<string>;
  Date?: FlexValue<string>;
  DueDate?: FlexValue<string>;
  Description?: FlexValue<string>;
  Hold?: FlexValue<boolean>;
  Status?: FlexValue<
    | 'Hold'
    | 'Balanced'
    | 'Voided'
    | 'Scheduled'
    | 'Open'
    | 'Closed'
    | 'PendingPrint'
    | 'PendingEmail'
    | string
  >;
  Amount?: FlexValue<number>;
  Balance?: FlexValue<number>;
  TaxTotal?: FlexValue<number>;
  CurrencyID?: FlexValue<string>;
  Branch?: FlexValue<string>;
  FinancialDetails?: {
    Branch?: FlexValue<string>;
    BatchNbr?: FlexValue<string>;
  };
  Details?: CegidSalesInvoiceDetail[];
  custom?: Record<string, any>;
}

/**
 * Tahsilat / Ödeme Varlık Modeli (Payment Contract)
 */
export interface CegidPayment {
  id?: string;
  ReferenceNbr?: FlexValue<string>;
  Type?: FlexValue<'Payment' | 'Prepayment' | 'CustomerRefund' | string>;
  CustomerID?: FlexValue<string>;
  PaymentAmount?: FlexValue<number>;
  PaymentMethod?: FlexValue<string>;
  CashAccount?: FlexValue<string>;
  Hold?: FlexValue<boolean>;
  Status?: FlexValue<string>;
  Description?: FlexValue<string>;
  Branch?: FlexValue<string>;
  ApplicationDate?: FlexValue<string>;
}

/**
 * Şema Keşfi Bilgisi (§6.2)
 */
export interface CegidSchemaEntity {
  name: string;
  fields: string[];
}

export interface CegidSchemaValidationResult {
  valid: boolean;
  missingEntities: string[];
  missingFields: Record<string, string[]>;
}

/**
 * Cegid XRP Flex API Hata Yanıtı
 */
export interface CegidErrorResponse {
  message?: string;
  exceptionMessage?: string;
  exceptionType?: string;
  stackTrace?: string;
  error?: string;
  error_description?: string;
}
