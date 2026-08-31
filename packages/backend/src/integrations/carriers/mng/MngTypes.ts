export const MNG_GATEWAY = {
  TEST: 'https://sandbox.mngkargo.com.tr/mngapi/api',
  PRODUCTION: 'https://api.mngkargo.com.tr/mngapi/api',
} as const;

export interface MngCredentials {
  customerNumber: string;
  username: string;
  password: string;
}

export interface MngAuthToken {
  token: string;
  expiresAt: number;
}

export interface MngAuthResponse {
  jwtToken?: string;
  token?: string;
  tokenType?: string;
  expireDate?: string;
  status?: string;
  message?: string;
}

export interface MngCreateOrderPayload {
  order: {
    referenceId: string;
    barcode: string;
    billOfLadingNo?: string;
    isPaymentAtDoor?: boolean;
    paymentType: number; // 1: Gönderici Ödemeli, 2: Alıcı Ödemeli
    recipient: {
      fullName: string;
      phoneNumber: string;
      cityName: string;
      districtName: string;
      address: string;
    };
    pieceCount: number;
    weight: number;
    desi: number;
    description?: string;
  };
}

export interface MngCreateOrderResponse {
  status?: string;
  statusCode?: string;
  message?: string;
  referenceId?: string;
  barcode?: string;
  shipmentId?: string;
  trackingCode?: string;
}

export interface MngShipmentStatusResponse {
  status?: string;
  statusCode?: string;
  trackingCode?: string;
  referenceId?: string;
  statusName?: string;
  events?: Array<{
    date: string;
    statusCode: string;
    statusName: string;
    description?: string;
    location?: string;
  }>;
}
