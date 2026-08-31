export const SURAT_GATEWAY = {
  PRODUCTION: 'https://webservices.suratkargo.com.tr/services.asmx',
  TEST: 'https://prova.suratkargo.com.tr/services.asmx',
} as const;

export interface SuratCredentials {
  userName: string;
  password: string;
  customerCode?: string;
}

export interface SuratCreateShipmentInput {
  cargoKey: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientDistrict: string;
  recipientPhone: string;
  recipientEmail?: string;
  recipientTaxId?: string;
  weightKg: number;
  desi: number;
  parcelCount: number;
  paymentType: string;
  codAmount?: number;
  notes?: string;
}

export interface SuratCreateShipmentResult {
  resultCode: string;
  resultMessage: string;
  barcode?: string;
  trackingNumber?: string;
  cargoKey?: string;
  raw?: unknown;
}

export interface SuratTrackingEvent {
  date: string;
  statusCode: string;
  description: string;
  location?: string;
}

export interface SuratTrackingResult {
  trackingNumber: string;
  statusCode: string;
  statusName: string;
  events: SuratTrackingEvent[];
  deliveredAt?: string;
  recipientName?: string;
}

export interface SuratCancelResult {
  resultCode: string;
  resultMessage: string;
}
