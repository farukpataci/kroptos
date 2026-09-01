export const INPOST_ENDPOINTS = {
  SHIPX_PRODUCTION: 'https://api-shipx-pl.easypack24.net/v1',
  SHIPX_TEST: 'https://sandbox-api-shipx-pl.easypack24.net/v1',
  POINTS_PRODUCTION: 'https://api.inpost.pl/v1/points',
  POINTS_TEST: 'https://sandbox-api-gateway-pl.easypack24.net/v1/points',
} as const;

export interface InpostCredentials {
  apiToken: string;
  organizationId: string;
}

export interface InpostAddress {
  name?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    building_number: string;
    city: string;
    post_code: string;
    country_code: string;
  };
}

export interface InpostParcel {
  id?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  weight?: {
    amount: number;
    unit: string;
  };
  template?: string; // 'small' | 'medium' | 'large' (A, B, C)
}

export interface InpostShipmentPayload {
  receiver: InpostAddress;
  sender?: InpostAddress;
  parcels: InpostParcel[];
  service: string; // 'inpost_locker_standard' | 'inpost_courier_standard'
  custom_attributes?: {
    target_point?: string; // e.g. 'KRA010' for Paczkomat
    dropoff_point?: string;
  };
  reference?: string;
  comments?: string;
}

export interface InpostShipmentResponse {
  id: number | string;
  status: string;
  tracking_number?: string;
  service?: string;
  reference?: string;
  created_at?: string;
  updated_at?: string;
  custom_attributes?: {
    target_point?: string;
  };
  parcels?: Array<{
    id: string;
    tracking_number?: string;
    is_non_standard?: boolean;
  }>;
  error?: string;
  message?: string;
  details?: any;
}

export interface InpostTrackingResponse {
  tracking_number: string;
  service?: string;
  status: string;
  custom_attributes?: {
    target_point?: string;
  };
  tracking_details?: Array<{
    status: string;
    origin_status?: string;
    datetime: string;
    description?: string;
    location?: string;
  }>;
}

export interface InpostPoint {
  name: string; // 'KRA010'
  type: string[]; // ['parcel_locker']
  status: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  address: {
    street: string;
    building_number: string;
    city: string;
    post_code: string;
    country_code: string;
  };
  address_description?: string;
}
