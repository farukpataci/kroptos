export const DPD_GATEWAY = {
  TEST: 'https://nst-preprod.dpsin.dpdgroup.com/api/v1.1',
  PRODUCTION: 'https://shipping.dpdgroup.com/api/v1.1',
} as const;

export interface DpdCredentials {
  apiKey: string;
  accountNumber: string;
}

export interface DpdShipmentPayload {
  printOptions?: {
    printerLanguage?: string;
    paperFormat?: string;
  };
  orderData: {
    customerReference: string;
    sender: {
      name: string;
      street: string;
      country: string;
      zipCode: string;
      city: string;
    };
    recipient: {
      name: string;
      street: string;
      country: string;
      zipCode: string;
      city: string;
      phone?: string;
      email?: string;
    };
    parcels: Array<{
      weight: number;
      desi?: number;
    }>;
  };
}

export interface DpdShipmentResponse {
  shipmentResponse?: {
    shipmentNumber?: string;
    parcelNumber?: string;
    labelData?: string;
    status?: string;
    message?: string;
  };
  shipmentNumber?: string;
  parcelNumber?: string;
  status?: string;
  message?: string;
}

export interface DpdCancelResponse {
  status?: string;
  message?: string;
}

export interface DpdTrackingResponse {
  trackingData?: {
    parcelNumber?: string;
    statusCode?: string;
    statusName?: string;
    events?: Array<{
      date: string;
      statusCode: string;
      statusName: string;
      description?: string;
      location?: string;
    }>;
  };
  statusCode?: string;
  statusName?: string;
  events?: Array<{
    date: string;
    statusCode: string;
    statusName: string;
    description?: string;
    location?: string;
  }>;
}
