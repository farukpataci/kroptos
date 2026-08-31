export const DHL_GATEWAY = {
  TEST: 'https://express.api.dhl.com/mydhlapi/test',
  PRODUCTION: 'https://express.api.dhl.com/mydhlapi',
} as const;

export interface DhlCredentials {
  apiKey: string;
  apiSecret: string;
  accountNumber: string;
}

export interface DhlAddress {
  postalCode?: string;
  cityName: string;
  countryCode: string; // ISO 2-character (e.g. TR, DE, US)
  addressLine1: string;
  addressLine2?: string;
}

export interface DhlContact {
  personName: string;
  companyName?: string;
  phone: string;
  email?: string;
}

export interface DhlCreateShipmentPayload {
  plannedShippingDateAndTime: string; // ISO string e.g. "2026-08-31T15:00:00 GMT+00:00"
  pickup: {
    isRequested: boolean;
  };
  productCode: string; // e.g. "N" (Express Domestic) or "P" (Express Worldwide)
  accounts: Array<{
    typeCode: string; // "shipper"
    number: string;
  }>;
  customerDetails: {
    shipperDetails: {
      postalAddress: DhlAddress;
      contactInformation: DhlContact;
    };
    receiverDetails: {
      postalAddress: DhlAddress;
      contactInformation: DhlContact;
    };
  };
  content: {
    packages: Array<{
      weight: number;
      dimensions: {
        length: number;
        width: number;
        height: number;
      };
      description?: string;
    }>;
    isCustomsDeclarable: boolean;
    declaredValue?: number;
    declaredValueCurrency?: string;
    description: string;
  };
}

export interface DhlCreateShipmentResponse {
  shipmentTrackingNumber: string;
  trackingUrl?: string;
  packages?: Array<{
    referenceNumber: number;
    trackingNumber: string;
  }>;
  documents?: Array<{
    imageFormat: string;
    content: string; // Base64 encoded label
    typeCode: string;
  }>;
}

export interface DhlTrackingResponse {
  shipments?: Array<{
    shipmentTrackingNumber: string;
    status: string;
    shipmentTimestamp?: string;
    events?: Array<{
      date: string;
      time: string;
      typeCode: string;
      description: string;
      serviceArea?: Array<{
        description: string;
      }>;
    }>;
  }>;
}
