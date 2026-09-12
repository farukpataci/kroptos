/**
 * T-Soft REST API v1 (rest1) Integration Types
 */

export interface TsoftCredentials {
  /**
   * Domain name or URL of the T-Soft store (e.g. "magaza.com" or "https://www.magaza.com")
   */
  storeDomain: string;
  /**
   * REST API Username
   */
  username: string;
  /**
   * REST API Password
   */
  password: string;
}

export interface TsoftAuthResponse {
  success: boolean;
  data?: Array<{
    token: string;
    expirationTime?: string;
  }>;
  message?: string[] | string;
}

export interface TsoftRawProduct {
  ProductId?: number | string;
  ProductCode?: string; // SKU
  ProductName?: string;
  DefaultCategoryId?: number | string;
  CategoryName?: string;
  Brand?: string;
  BrandId?: number | string;
  Price?: number | string;
  SellingPrice?: number | string;
  BuyingPrice?: number | string;
  Vat?: number | string;
  Currency?: string;
  Stock?: number | string;
  StockUnit?: string;
  Barcode?: string;
  IsActive?: boolean | string | number;
  ShortDescription?: string;
  Description?: string;
  SubProducts?: TsoftRawVariation[] | { [key: string]: TsoftRawVariation };
}

export interface TsoftRawVariation {
  SubProductId?: number | string;
  VariantId?: number | string;
  Code?: string; // SKU
  Barcode?: string;
  Stock?: number | string;
  Price?: number | string;
  SellingPrice?: number | string;
  Type?: string;
  Property?: string;
}

export interface TsoftRawOrder {
  OrderId?: number | string;
  OrderCode?: string;
  OrderDate?: string;
  OrderStatus?: string;
  OrderStatusId?: number | string;
  PaymentType?: string;
  PaymentStatus?: string;
  Total?: number | string;
  CargoPrice?: number | string;
  Currency?: string;
  CustomerId?: number | string;
  CustomerName?: string;
  CustomerEmail?: string;
  CustomerPhone?: string;
  CustomerMobile?: string;
  ShippingAddress?: TsoftRawAddress;
  BillingAddress?: TsoftRawAddress;
  CargoTrackingCode?: string;
  CargoTrackingUrl?: string;
  CargoCompany?: string;
  OrderDetails?: TsoftRawOrderItem[];
}

export interface TsoftRawOrderItem {
  OrderDetailId?: number | string;
  ProductId?: number | string;
  ProductCode?: string;
  ProductName?: string;
  Barcode?: string;
  Quantity?: number | string;
  Price?: number | string;
  Vat?: number | string;
  SubProductId?: number | string;
  VariantProperty?: string;
}

export interface TsoftRawAddress {
  Name?: string;
  Address?: string;
  City?: string;
  District?: string;
  PostalCode?: string;
  Country?: string;
  Phone?: string;
  Mobile?: string;
  TaxNumber?: string;
  TaxOffice?: string;
}
