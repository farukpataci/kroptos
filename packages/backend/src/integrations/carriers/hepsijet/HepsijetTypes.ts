/**
 * HepsiJET carrier API types and constants.
 */

export const HEPSIJET_GATEWAY = {
  TEST: 'https://integration-apitest.hepsijet.com',
  PRODUCTION: 'https://integration.hepsijet.com',
} as const;

export const HEPSIJET_ENDPOINTS = {
  TOKEN: '/auth/getToken',
  CREATE_ADVANCE: '/advance/sendDeliveryAdvance/v2',
  CANCEL_ADVANCE: '/advance/deleteDeliveryAdvance',
  TRACKING: '/deliveryTransaction/getDeliveryTracking',
  LABEL: '/delivery/barcodes-label',
} as const;

export interface HepsijetCredentials {
  userName: string;
  password: string;
  companyShortName: string;
}

export interface HepsijetAuthResponse {
  data?: {
    token?: string;
  };
  status?: string;
  statusCode?: number;
  message?: string;
}

export interface HepsijetRecipient {
  name: string;
  phone: string;
  email?: string;
  city: string;
  town: string;
  district?: string;
  addressLine1: string;
  addressLine2?: string;
}

export interface HepsijetSender {
  companyName: string;
  companyShortName: string;
  city: string;
  town: string;
  addressLine1: string;
}

export interface HepsijetParcel {
  desi: number;
  weightKg: number;
  parcelCount: number;
  description?: string;
}

export interface HepsijetSendAdvanceRequest {
  customerOrderId: string;
  orderNumber: string;
  companyShortName: string;
  sender: HepsijetSender;
  recipient: HepsijetRecipient;
  parcels: HepsijetParcel[];
  desi: number;
  weightKg: number;
  paymentType: string;
  codAmount?: number;
}

export interface HepsijetSendAdvanceResponse {
  status?: string;
  statusCode?: number;
  message?: string;
  data?: {
    barcode?: string;
    trackingNumber?: string;
    customerOrderId?: string;
    deliveryId?: string;
  };
}

export interface HepsijetCancelResponse {
  status?: string;
  statusCode?: number;
  message?: string;
  data?: {
    cancelled?: boolean;
    customerOrderId?: string;
  };
}

export interface HepsijetTrackingEventPayload {
  actionDate?: string;
  statusName?: string;
  statusCode?: string;
  description?: string;
  location?: string;
}

export interface HepsijetTrackingResultPayload {
  trackingNumber?: string;
  customerOrderId?: string;
  currentStatusCode?: string;
  currentStatusName?: string;
  events?: HepsijetTrackingEventPayload[];
}

export interface HepsijetTrackingResponse {
  status?: string;
  statusCode?: number;
  message?: string;
  data?: HepsijetTrackingResultPayload | HepsijetTrackingResultPayload[];
}
