export const FAN_COURIER_ENDPOINTS = {
  BASE_URL: 'https://api.fancourier.ro',
} as const;

export interface FanCourierCredentials {
  clientId: string;
  username: string;
  password: string;
}

export interface FanCourierAuthResponse {
  status: string; // 'success' | 'error'
  message?: string;
  data?: {
    token: string;
    expires_at?: string;
  };
}

export interface FanCourierRecipient {
  name: string;
  phone: string;
  email?: string;
  county: string; // Județ / İl
  locality: string; // Localitate / İlçe
  street?: string;
  number?: string;
  postalCode?: string;
}

export interface FanCourierAwbPayload {
  service: string; // 'Standard', 'RedCode', 'Express'
  paymentType: string; // 'sender' | 'recipient'
  packages: number;
  weight: number; // in Kg
  weightKg?: number;
  recipient: FanCourierRecipient;
  contentDescription?: string;
  clientReference?: string;
}

export interface FanCourierAwbResponse {
  status: string; // 'success' | 'error'
  message?: string;
  data?: {
    awbNumber: string;
    barcode?: string;
    pdfLabel?: string;
  };
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export interface FanCourierTrackingEvent {
  status: string; // 'S1', 'S2', 'S3', 'S4', 'S9', 'S10', 'S99'
  statusName: string;
  date: string; // ISO / YYYY-MM-DD HH:mm:ss
  location?: string;
}

export interface FanCourierTrackingResponse {
  status: string;
  data?: Array<{
    awbNumber: string;
    currentStatus?: string;
    events?: FanCourierTrackingEvent[];
  }>;
}
