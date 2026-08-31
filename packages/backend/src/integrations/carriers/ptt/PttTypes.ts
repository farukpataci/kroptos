export const PTT_GATEWAY = {
  TEST: 'https://pttws.ptt.gov.tr/PttVeriYuklemeTest/services/Sorgu',
  PRODUCTION_SHIPMENT: 'https://pttws.ptt.gov.tr/PttVeriYukleme/services/Sorgu',
  PRODUCTION_TRACKING: 'https://pttws.ptt.gov.tr/GonderiTakip/services/Sorgu',
} as const;

export interface PttCredentials {
  username: string;
  password: string;
  customerCode: string;
}

export interface PttCreateShipmentPayload {
  barcode: string;
  referenceNo: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientDistrict: string;
  recipientPhone: string;
  desi: number;
  weightKg: number;
  pieceCount: number;
  description?: string;
}

export interface PttCreateShipmentResult {
  resultCode: string;
  resultMessage: string;
  barcode?: string;
  referenceNo?: string;
}

export interface PttCancelShipmentResult {
  resultCode: string;
  resultMessage: string;
}

export interface PttTrackingResult {
  barcode?: string;
  statusCode?: string;
  statusName?: string;
  events?: Array<{
    date: string;
    statusCode: string;
    description: string;
    location?: string;
  }>;
}
