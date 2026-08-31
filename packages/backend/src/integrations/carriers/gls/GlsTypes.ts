export const GLS_GATEWAY = {
  PRODUCTION: 'https://shipit.gls-group.eu',
  TEST: 'https://shipit-test.gls-group.eu',
} as const;

export const GLS_SHIPMENTS_PATH = '/backend/rs/shipments';

export interface GlsCredentials {
  username: string;
  password: string;
  shipperId: string;
}

export interface GlsAddress {
  name1: string;
  name2?: string;
  street1: string;
  street2?: string;
  country: string;
  zipCode: string;
  city: string;
  contact?: string;
  phone?: string;
  email?: string;
}

export interface GlsParcel {
  weight: number;
  comment?: string;
}

export interface GlsCreateShipmentPayload {
  shipperId: string;
  shipmentReference?: string;
  consignee: GlsAddress;
  parcels: GlsParcel[];
  services?: Array<{ code: string; [key: string]: any }>;
}

export interface GlsShipmentResponse {
  parcelNumber?: string;
  shipmentNumber?: string;
  trackId?: string;
  labels?: string[];
  pdfLabel?: string;
  status?: string;
  errorCode?: string;
  errorReason?: string;
  raw?: unknown;
}

export interface GlsTrackingEvent {
  dateTime: string;
  code: string;
  description: string;
  location?: string;
}

export interface GlsTrackingResponse {
  parcelNumber: string;
  statusCode: string;
  statusDescription: string;
  events: GlsTrackingEvent[];
  deliveryDate?: string;
  recipientName?: string;
}

export interface GlsCancelResponse {
  parcelNumber?: string;
  success?: boolean;
  message?: string;
  errorCode?: string;
}
