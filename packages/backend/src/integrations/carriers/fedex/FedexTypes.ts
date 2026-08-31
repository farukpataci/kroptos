export const FEDEX_ENDPOINTS = {
  PRODUCTION: 'https://apis.fedex.com',
  TEST: 'https://apis-sandbox.fedex.com',
} as const;

export interface FedexCredentials {
  apiKey: string;
  secretKey: string;
  accountNumber: string;
}

export interface FedexTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface FedexShipmentRequest {
  labelResponseOptions: string; // 'URL_ONLY' | 'LABEL'
  requestedShipment: {
    shipper: {
      contact: {
        personName: string;
        phoneNumber: string;
        companyName?: string;
      };
      address: {
        streetLines: string[];
        city: string;
        stateOrProvinceCode?: string;
        postalCode: string;
        countryCode: string;
      };
    };
    recipients: Array<{
      contact: {
        personName: string;
        phoneNumber: string;
        companyName?: string;
      };
      address: {
        streetLines: string[];
        city: string;
        stateOrProvinceCode?: string;
        postalCode: string;
        countryCode: string;
      };
    }>;
    shipDatestamp?: string; // YYYY-MM-DD
    serviceType?: string; // 'FEDEX_EXPRESS_SAVER' | 'INTERNATIONAL_PRIORITY' | 'STANDARD_OVERNIGHT'
    packagingType?: string; // 'YOUR_PACKAGING' | 'FEDEX_PAK' | 'FEDEX_BOX'
    pickupType: string; // 'USE_SCHEDULED_PICKUP' | 'DROPOFF_AT_FEDEX_LOCATION'
    shippingChargesPayment: {
      paymentType: string; // 'SENDER' | 'RECIPIENT' | 'THIRD_PARTY'
      payor?: {
        responsibleParty: {
          accountNumber: {
            value: string;
          };
        };
      };
    };
    labelSpecification: {
      labelFormatType: string; // 'COMMON2D'
      imageType: string; // 'PDF' | 'ZPLII' | 'PNG'
      labelStockType: string; // 'PAPER_4X6'
    };
    requestedPackageLineItems: Array<{
      weight: {
        units: string; // 'KG' | 'LB'
        value: number;
      };
      dimensions?: {
        length: number;
        width: number;
        height: number;
        units: string; // 'CM' | 'IN'
      };
    }>;
  };
  accountNumber: {
    value: string;
  };
}

export interface FedexShipmentResponse {
  transactionId?: string;
  customerTransactionId?: string;
  output?: {
    transactionShipments?: Array<{
      masterTrackingNumber?: string;
      serviceType?: string;
      pieceResponses?: Array<{
        trackingNumber?: string;
        packageDocuments?: Array<{
          docType?: string;
          encodedLabel?: string; // Base64 label image string
          url?: string;
        }>;
      }>;
    }>;
  };
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export interface FedexTrackingRequest {
  includeDetailedScans: boolean;
  trackingInfo: Array<{
    trackingNumberInfo: {
      trackingNumber: string;
    };
  }>;
}

export interface FedexTrackingResponse {
  transactionId?: string;
  output?: {
    completeTrackResults?: Array<{
      trackingNumber?: string;
      trackResults?: Array<{
        trackingNumberInfo?: {
          trackingNumber: string;
        };
        latestStatusDetail?: {
          code?: string; // 'DL', 'PU', 'IT', 'OD', 'OC', 'CA', etc.
          description?: string;
          statusByLocale?: string;
        };
        scanEvents?: Array<{
          date?: string; // ISO date string
          derivedStatus?: string;
          scanEventCode?: string;
          eventDescription?: string;
          scanLocation?: {
            city?: string;
            stateOrProvinceCode?: string;
            countryCode?: string;
          };
        }>;
      }>;
    }>;
  };
}

export interface FedexRateRequest {
  accountNumber: {
    value: string;
  };
  requestedShipment: {
    shipper: {
      address: {
        postalCode: string;
        countryCode: string;
      };
    };
    recipient: {
      address: {
        postalCode: string;
        countryCode: string;
      };
    };
    pickupType: string;
    rateRequestType: string[]; // ['LIST', 'ACCOUNT']
    requestedPackageLineItems: Array<{
      weight: {
        units: string;
        value: number;
      };
    }>;
  };
}

export interface FedexRateResponse {
  output?: {
    rateReplyDetails?: Array<{
      serviceType?: string;
      serviceName?: string;
      ratedShipmentDetails?: Array<{
        totalNetCharge?: number;
        currency?: string;
      }>;
    }>;
  };
}

export interface FedexCancelRequest {
  accountNumber: {
    value: string;
  };
  trackingNumber: string;
}

export interface FedexCancelResponse {
  transactionId?: string;
  output?: {
    cancelledShipment?: boolean;
    successMessage?: string;
  };
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export interface FedexPickupRequest {
  associatedAccountNumber: {
    value: string;
  };
  originDetail: {
    pickupLocation: {
      contact: {
        personName: string;
        phoneNumber: string;
      };
      address: {
        streetLines: string[];
        city: string;
        postalCode: string;
        countryCode: string;
      };
    };
    readyTimestamp: string;
    companyCloseTime: string;
  };
  carrierCode: string; // 'FDXE' | 'FDXG'
}

export interface FedexPickupResponse {
  output?: {
    pickupConfirmationCode?: string;
    message?: string;
  };
  errors?: Array<{
    code: string;
    message: string;
  }>;
}
