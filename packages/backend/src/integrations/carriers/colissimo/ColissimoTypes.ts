export const COLISSIMO_ENDPOINTS = {
  LABEL_BASE: 'https://ws.colissimo.fr/sls-ws/SlsServiceWSRest/3.1',
  TRACKING_BASE: 'https://api.laposte.fr/suivi/v2',
} as const;

export interface ColissimoCredentials {
  contractNumber: string;
  password: string;
  apiKey: string; // La Poste Okapi Key for Suivi API v2
}

export interface ColissimoAddress {
  companyName?: string;
  lastName: string;
  firstName?: string;
  line1: string;
  line2?: string;
  city: string;
  zipCode: string;
  countryCode: string; // 'FR', 'DE', 'GB', etc.
  email?: string;
  phoneNumber?: string;
}

export interface ColissimoGenerateLabelPayload {
  outputFormat: {
    x?: number;
    y?: number;
    outputPrintingType: 'PDF_10x15_300dpi' | 'ZPL_10x15_300dpi' | 'DPL_10x15_300dpi';
  };
  letter: {
    service: {
      contractNumber: string;
      password: string;
      commercialName?: string;
      productCode: string; // 'DOS', 'DOM', 'COL', 'BPR', 'CORE'
      depositDate: string; // 'YYYY-MM-DD'
    };
    parcel: {
      weight: number; // in Kg
      weightKg?: number;
      skybillNumber?: string;
    };
    sender?: {
      address: ColissimoAddress;
    };
    addressee: {
      address: ColissimoAddress;
    };
  };
}

export interface ColissimoGenerateLabelResponse {
  messages?: Array<{
    id: string;
    messageContent: string;
    type: string;
  }>;
  labelV2Response?: {
    parcelNumber: string;
    label: string; // Base64 PDF / ZPL / DPL
  };
}

export interface LaPosteTrackingEvent {
  code: string;
  label: string;
  date: string;
}

export interface LaPosteShipmentTracking {
  idShip: string;
  event?: LaPosteTrackingEvent[];
  timeline?: Array<{
    id: number;
    label: string;
    status?: boolean;
    date?: string;
  }>;
  isCompleted?: boolean;
}

export interface LaPosteTrackingResponse {
  returnCode: number;
  returnMessage?: string;
  shipment?: LaPosteShipmentTracking;
}
