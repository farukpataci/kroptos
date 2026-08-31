export const UPS_ENDPOINTS = {
  PRODUCTION: 'https://onlinetools.ups.com/api',
  TEST: 'https://wwwcie.ups.com/api',
} as const;

export interface UpsCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
}

export interface UpsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: string | number;
  status?: string;
}

export interface UpsShipmentRequest {
  ShipmentRequest: {
    Request?: {
      SubVersion?: string;
      RequestOption?: string;
      TransactionReference?: {
        CustomerContext?: string;
      };
    };
    Shipment: {
      Description?: string;
      Shipper: {
        Name: string;
        AttentionName?: string;
        TaxIdentificationNumber?: string;
        Phone?: {
          Number: string;
        };
        ShipperNumber: string;
        Address: {
          AddressLine: string[];
          City: string;
          StateProvinceCode?: string;
          PostalCode: string;
          CountryCode: string;
        };
      };
      ShipTo: {
        Name: string;
        AttentionName?: string;
        Phone?: {
          Number: string;
        };
        Address: {
          AddressLine: string[];
          City: string;
          StateProvinceCode?: string;
          PostalCode: string;
          CountryCode: string;
        };
      };
      PaymentInformation: {
        ShipmentCharge: {
          Type: string;
          BillShipper: {
            AccountNumber: string;
          };
        };
      };
      Service: {
        Code: string; // '03' = Ground, '11' = Standard, '07' = Express, etc.
        Description?: string;
      };
      Package: Array<{
        Description?: string;
        Packaging: {
          Code: string; // '02' = Customer Supplied Package
        };
        Dimensions?: {
          UnitOfMeasurement: { Code: string }; // 'CM' or 'IN'
          Length: string;
          Width: string;
          Height: string;
        };
        PackageWeight: {
          UnitOfMeasurement: { Code: string }; // 'KGS' or 'LBS'
          Weight: string;
        };
      }>;
    };
    LabelSpecification?: {
      LabelImageFormat: {
        Code: string; // 'ZPL' | 'GIF' | 'PNG' | 'PDF'
      };
      LabelStockSize?: {
        Height: string;
        Width: string;
      };
    };
  };
}

export interface UpsShipmentResponse {
  ShipmentResponse?: {
    Response: {
      ResponseStatus: {
        Code: string;
        Description: string;
      };
      Alert?: Array<{ Code: string; Description: string }>;
    };
    ShipmentResults?: {
      ShipmentIdentificationNumber: string;
      PackageResults?: Array<{
        TrackingNumber: string;
        ShippingLabel?: {
          ImageFormat: { Code: string };
          GraphicImage: string; // Base64 encoded string
          HTMLImage?: string;
        };
      }>;
    };
  };
}

export interface UpsTrackingResponse {
  trackResponse?: {
    shipment?: Array<{
      inquiryNumber?: string;
      package?: Array<{
        trackingNumber: string;
        activity?: Array<{
          location?: {
            address?: {
              city?: string;
              stateProvince?: string;
              postalCode?: string;
              country?: string;
            };
          };
          status?: {
            type?: string; // 'D', 'I', 'P', 'X', 'M', 'V'
            description?: string;
            code?: string;
          };
          date?: string; // YYYYMMDD
          time?: string; // HHMMSS
        }>;
      }>;
    }>;
  };
}

export interface UpsRatingResponse {
  RateResponse?: {
    Response: {
      ResponseStatus: {
        Code: string;
        Description: string;
      };
    };
    RatedShipment?: Array<{
      Service: { Code: string };
      TotalCharges?: {
        CurrencyCode: string;
        MonetaryValue: string;
      };
    }>;
  };
}

export interface UpsVoidResponse {
  VoidShipmentResponse?: {
    Response: {
      ResponseStatus: {
        Code: string;
        Description: string;
      };
    };
    SummaryResult?: {
      Status: {
        Code: string;
        Description: string;
      };
    };
  };
}
