export const EVRI_ENDPOINTS = {
  PRODUCTION: 'https://api.evri.com',
  TEST: 'https://api-sandbox.evri.com',
} as const;

export interface EvriCredentials {
  apiKey: string;
  apiSecret: string;
  clientId: string;
  clientSecret: string;
}

export interface EvriAddress {
  lastName: string;
  firstName?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  countryCode: string; // 'GB', 'US', 'DE', etc.
  email: string;
  phone?: string;
}

export interface EvriParcel {
  weightInGrams: number;
  weightKg?: number;
  lengthInMm?: number;
  widthInMm?: number;
  heightInMm?: number;
}

export interface EvriShipmentPayload {
  clientId: string;
  clientReference: string;
  serviceType: 'standard_delivery' | 'next_day_delivery' | 'parcelshop_dropoff';
  deliveryAddress: EvriAddress;
  senderAddress?: EvriAddress;
  parcel: EvriParcel;
}

export interface EvriShipmentResponse {
  shipmentId: string;
  barcode: string;
  trackingNumber: string;
  status: string;
  labelData?: string; // Base64 PDF / ZPL label
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export interface EvriEvent {
  statusCode: string;
  statusDescription: string;
  timestamp: string;
  location?: string;
}

export interface EvriTrackingResponse {
  trackingNumber: string;
  status: string;
  statusDescription?: string;
  events?: EvriEvent[];
}
