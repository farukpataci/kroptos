export const SAMEDAY_ENDPOINTS = {
  PRODUCTION: 'https://api.sameday.ro',
  TEST: 'https://sameday-api.demo.zitec.com',
} as const;

export interface SamedayCredentials {
  username: string;
  password: string;
  pickupPointId?: number | string;
}

export interface SamedayAuthResponse {
  token: string;
  expires_at?: string;
  expire_at?: string;
}

export interface SamedayPerson {
  name: string;
  phone: string;
  email?: string;
}

export interface SamedayAddress {
  county: string;
  city: string;
  address: string;
  postalCode?: string;
}

export interface SamedayAwbPayload {
  pickupPoint: number | string;
  contactPerson?: number | string;
  packageType: number; // 0 = parcel, 1 = envelope, 2 = pallet
  packageWeight: number; // in Kg
  weightKg?: number;
  serviceId: number | string; // e.g. 1 = 24H, 7 = Easybox Locker
  awbRecipient: {
    name: string;
    personType: number; // 0 = individual, 1 = company
    phone: string;
    email: string;
    address: SamedayAddress;
  };
  clientInternalReference?: string;
  insuredValue?: number;
}

export interface SamedayAwbResponse {
  awbNumber: string;
  awbCost?: number;
  pdfLink?: string;
  rawLabelData?: string;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export interface SamedayStatusHistory {
  statusId: number;
  statusState: string;
  statusLabel?: string;
  updatedAt: string;
  transitLocation?: string;
}

export interface SamedayTrackingResponse {
  awbNumber: string;
  statusId: number;
  statusState?: string;
  statusLabel?: string;
  history?: SamedayStatusHistory[];
}
