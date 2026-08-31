export const SENDEO_GATEWAY = {
  TEST: 'https://apiintg.kolaygelsin.com',
  PRODUCTION: 'https://api.sendeo.com.tr/api',
} as const;

export interface SendeoCredentials {
  username: string;
  password: string;
  customerCode: string;
}

export interface SendeoAuthToken {
  token: string;
  expiresAt: number;
}

export interface SendeoAuthResponse {
  result?: {
    token?: string;
    expireDate?: string;
  };
  token?: string;
  status?: string;
  message?: string;
}

export interface SendeoSetCargoPayload {
  referenceNo: string;
  customerCode: string;
  barcode: string;
  paymentType: number; // 1: Gönderici Ödemeli
  receiver: {
    name: string;
    phone: string;
    city: string;
    district: string;
    address: string;
  };
  packages: Array<{
    desi: number;
    weight: number;
    description?: string;
  }>;
}

export interface SendeoSetCargoResponse {
  result?: {
    trackingNo?: string;
    barcode?: string;
    cargoId?: string;
  };
  trackingNo?: string;
  barcode?: string;
  status?: string;
  message?: string;
}

export interface SendeoTrackingEvent {
  date: string;
  statusCode: string;
  statusName: string;
  description?: string;
  location?: string;
}

export interface SendeoCargoTrackingResponse {
  result?: {
    trackingNo?: string;
    statusCode?: string;
    statusName?: string;
    events?: SendeoTrackingEvent[];
  };
  statusCode?: string;
  statusName?: string;
  events?: SendeoTrackingEvent[];
}
