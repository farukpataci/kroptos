export const ROYALMAIL_ENDPOINTS = {
  PRODUCTION: 'https://api.parcel.royalmail.com/api/v1',
  TEST: 'https://api.parcel.royalmail.com/api/v1',
} as const;

export interface RoyalmailCredentials {
  apiKey: string;
}

export interface RoyalmailAddress {
  fullName: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  county?: string;
  postcode: string;
  countryCode: string; // 'GB', 'US', 'DE', etc.
  email?: string;
  phoneNumber?: string;
}

export interface RoyalmailPackage {
  weightInGrams: number;
  weightInKg?: number;
  packageFormatIdentifier?: string; // 'Parcel' | 'LargeLetter' | 'Letter'
  dimensions?: {
    heightInMms: number;
    widthInMms: number;
    depthInMms: number;
  };
}

export interface RoyalmailOrderPayload {
  orderReference: string;
  orderDate?: string;
  recipient: {
    address: RoyalmailAddress;
  };
  packages: RoyalmailPackage[];
  postageDetails?: {
    serviceCode?: string; // e.g. 'TPN' (Tracked 24), 'TPS' (Tracked 48)
  };
}

export interface RoyalmailOrderResponse {
  orderIdentifier?: string;
  orderReference?: string;
  createdDateTime?: string;
  orderStatus?: string;
  trackingNumber?: string;
  errors?: Array<{
    errorCode: string;
    errorMessage: string;
  }>;
}

export interface RoyalmailLabelResponse {
  labelData?: string; // Base64 encoded PDF / ZPL label
  orderIdentifier?: string;
  trackingNumber?: string;
}
