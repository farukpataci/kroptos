/**
 * IdeaSoft API & OAuth Integration Types
 */

export interface IdeasoftCredentials {
  storeDomain: string; // e.g., "mystore.myideasoft.com" or "mystore"
  accessToken?: string; // Direct API token if already generated
  clientId?: string; // OAuth Client ID
  clientSecret?: string; // OAuth Client Secret
  refreshToken?: string; // OAuth Refresh Token
  expiresAt?: number; // Epoch timestamp in ms when accessToken expires
}

export interface IdeasoftTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface IdeasoftAddress {
  id?: number;
  firstname?: string;
  surname?: string;
  companyName?: string;
  address?: string;
  city?: string;
  district?: string;
  country?: string;
  postcode?: string;
  phoneNumber?: string;
  mobilePhoneNumber?: string;
}

export interface IdeasoftOrderItem {
  id: number;
  productId?: number;
  productName: string;
  productSku?: string;
  productBarcode?: string;
  productPrice: number | string;
  discount?: number | string;
  orderQuantity: number;
  totalPrice?: number | string;
}

export interface IdeasoftRawOrder {
  id: number;
  orderNumber?: string;
  status: string; // 'new', 'waiting_approval', 'approved', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'
  paymentStatus?: string; // 'waiting', 'paid', 'refunded'
  paymentTypeName?: string;
  currency?: string;
  totalPrice: number | string;
  finalPrice?: number | string;
  customerFirstname?: string;
  customerSurname?: string;
  customerEmail?: string;
  customerPhone?: string;
  createdAt: string;
  updatedAt?: string;
  shippingAddress?: IdeasoftAddress;
  billingAddress?: IdeasoftAddress;
  orderItems: IdeasoftOrderItem[];
  cargoTrackingNumber?: string;
  cargoTrackingUrl?: string;
  cargoProviderName?: string;
}

export interface IdeasoftProductPrice {
  price: number | string;
  currency?: string;
  taxRate?: number;
}

export interface IdeasoftRawProduct {
  id: number;
  name: string;
  slug?: string;
  sku?: string;
  barcode?: string;
  stockAmount: number;
  status: number | boolean; // 1 or true = active
  price1: number | string; // Base sale price
  currency?: {
    id?: number;
    label?: string;
    abbr?: string;
  } | string;
  category?: {
    id?: number;
    name?: string;
  };
  brand?: {
    id?: number;
    name?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface IdeasoftRawCategory {
  id: number;
  name: string;
  slug?: string;
  sortOrder?: number;
  status?: number;
  parent?: {
    id?: number;
    name?: string;
  } | null;
}
