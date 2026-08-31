export const ARAS_GATEWAY = {
  TEST: 'https://customerservicestest.arascargoservice.com.tr/arascargoservice/arascargoservice.asmx',
  PRODUCTION: 'https://customerservices.arascargoservice.com.tr/arascargoservice/arascargoservice.asmx',
} as const;

export interface ArasCredentials {
  userName: string;
  password: string;
  customerCode: string;
}

export interface ArasOrderShipmentPayload {
  integrationCode: string;
  tradingWaybillNumber?: string;
  invoiceNumber?: string;
  receiverName: string;
  receiverAddress: string;
  receiverPhone: string;
  cityName: string;
  townName: string;
  payorTypeCode: number; // 1: Sender (Gönderici Ödemeli), 2: Receiver (Alıcı Ödemeli)
  pieceCount: number;
  weight: number;
  desi: number;
  description?: string;
}

export interface ArasShipmentQueryResult {
  orderId?: string;
  integrationCode?: string;
  cargoKey?: string;
  statusCode?: string;
  statusName?: string;
  trackingUrl?: string;
  events?: Array<{
    date: string;
    statusCode: string;
    description: string;
    location?: string;
  }>;
}
