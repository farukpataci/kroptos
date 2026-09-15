/**
 * İkas E-Commerce Integration Types
 * Definitions for İkas GraphQL/REST API request and response data structures.
 */

export interface IkasCredentials {
  storeUrl?: string;
  storeDomain?: string;
  apiToken?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface IkasRawAddress {
  id?: string;
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  district?: string; // İlçe
  postalCode?: string;
  country?: string;
  countryCode?: string;
  phone?: string;
}

export interface IkasRawCustomer {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface IkasRawOrderLineItem {
  id: string;
  productId?: string;
  variantId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
  finalPrice?: number;
  taxRatio?: number;
  discountAmount?: number;
  weight?: number;
}

export type IkasOrderStatus =
  | 'WAITING_FOR_PAYMENT'
  | 'WAITING_FOR_SHIPMENT'
  | 'PREPARING'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED';

export interface IkasRawOrder {
  id: string;
  orderNumber: string;
  orderStatus: IkasOrderStatus | string;
  paymentStatus?: 'PAID' | 'WAITING' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | string;
  currency: string;
  totalPrice: number;
  subTotalPrice?: number;
  totalTax?: number;
  totalShippingPrice?: number;
  totalDiscountPrice?: number;
  createdAt: string;
  updatedAt: string;
  customer?: IkasRawCustomer;
  shippingAddress?: IkasRawAddress;
  billingAddress?: IkasRawAddress;
  orderLineItems?: IkasRawOrderLineItem[];
  orderLines?: IkasRawOrderLineItem[];
  cargoTrackingNumber?: string;
  cargoCompany?: string;
  customerNote?: string;
}

export interface IkasRawVariant {
  id: string;
  productId: string;
  sku?: string;
  barcode?: string;
  name?: string;
  price: number;
  discountPrice?: number;
  stock?: number;
  inventoryQuantity?: number;
  weight?: number;
}

export interface IkasRawProduct {
  id: string;
  name: string;
  description?: string;
  status?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | string;
  brand?: { name?: string } | string;
  createdAt?: string;
  updatedAt?: string;
  variants?: IkasRawVariant[];
  images?: Array<{ url: string } | string>;
}

export interface IkasFulfillmentPayload {
  orderId: string;
  cargoCompany: string;
  trackingNumber: string;
  trackingUrl?: string;
  lineItemIds?: string[];
}

export interface IkasInventoryUpdatePayload {
  variantId: string;
  sku?: string;
  stock: number;
}
