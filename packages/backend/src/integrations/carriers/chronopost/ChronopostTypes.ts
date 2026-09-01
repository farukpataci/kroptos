export const CHRONOPOST_ENDPOINTS = {
  SHIPPING_WS: 'https://ws.chronopost.fr/shipping-cxf/ShippingServiceWS',
  TRACKING_WS: 'https://ws.chronopost.fr/tracking-cxf/TrackingServiceWS',
  QUICKCOST_WS: 'https://ws.chronopost.fr/quickcost-cxf/QuickcostServiceWS',
  POINT_RELAIS_WS: 'https://ws.chronopost.fr/recherchebt-ws-cxf/PointRelaisServiceWS',
} as const;

export interface ChronopostCredentials {
  accountNumber: string;
  password: string;
  subAccount?: string;
}

export interface ChronopostAddress {
  nom: string; // Last name / Company
  prenom?: string; // First name
  adresse1: string;
  adresse2?: string;
  codePostal: string;
  ville: string;
  codePays: string; // 'FR', 'DE', 'GB', etc.
  email?: string;
  telephone?: string;
}

export interface ChronopostShippingPayload {
  headerValue: {
    accountNumber: string;
    password: string;
    subAccount?: string;
    idEmitter?: string;
  };
  shipperValue: ChronopostAddress;
  recipientValue: ChronopostAddress;
  skybillValue: {
    productCode: string; // '01' Chrono 13, '02' Chrono 10, '86' Chrono Express
    shipDate: string; // ISO / YYYY-MM-DD
    weight: number; // in Kg
    weightKg?: number;
    objectType?: string; // 'DOC' | 'MAR'
  };
  scheduledValue?: {
    appointmentDate?: string;
  };
}

export interface ChronopostShippingResponse {
  errorCode: number;
  errorMessage?: string;
  skybillNumber?: string;
  reservationNumber?: string;
  pdfEtiquette?: string; // Base64 PDF / ZPL label
}

export interface ChronopostEvent {
  code: string; // 'D', 'E', 'PC', 'TA', 'DC', 'RB', 'AN'
  label: string;
  eventDate: string;
  eventLocation?: string;
}

export interface ChronopostTrackingResponse {
  errorCode: number;
  errorMessage?: string;
  skybillNumber?: string;
  events?: ChronopostEvent[];
  isDelivered?: boolean;
}
