export const POSTNL_ENDPOINTS = {
  PRODUCTION: 'https://api.postnl.nl',
  TEST: 'https://api-sandbox.postnl.nl',
} as const;

export interface PostnlCredentials {
  apiKey: string;
  customerCode: string;
  customerNumber: string;
}

export interface PostnlAddress {
  AddressType: '01' | '02'; // 01: Receiver, 02: Sender
  CompanyName?: string;
  FirstName?: string;
  LastName?: string;
  Street: string;
  HouseNr: string;
  HouseNrExt?: string;
  Zipcode: string;
  City: string;
  Countrycode: string; // 'NL', 'BE', 'DE', etc.
  Email?: string;
}

export interface PostnlDimension {
  Weight: number; // in grams
  weightKg?: number;
  Height?: number; // in mm
  Length?: number; // in mm
  Width?: number; // in mm
}

export interface PostnlShipmentPayload {
  Customer: {
    CustomerCode: string;
    CustomerNumber: string;
  };
  Message: {
    MessageID?: string;
    MessageTimeStamp: string;
    Printertype: 'GraphicFile|PDF' | 'ZPL2';
  };
  Shipments: Array<{
    Barcode: string;
    Addresses: PostnlAddress[];
    Dimension: PostnlDimension;
    ProductCodeDelivery?: string; // '3085': Standard parcel, '4944': Express
    Reference?: string;
  }>;
}

export interface PostnlLabelResponse {
  ResponseShipments?: Array<{
    Barcode: string;
    Labels?: Array<{
      Content: string; // Base64 PDF / ZPL string
      Labeltype: string;
    }>;
    ProductCodeDelivery?: string;
  }>;
  Barcode?: string;
  Error?: {
    ErrorCode?: string;
    ErrorMsg?: string;
  };
}

export interface PostnlStatusResponse {
  CurrentStatus?: {
    Shipment?: {
      StatusCode?: string;
      StatusDescription?: string;
      TimeStamp?: string;
    };
  };
  CompleteStatus?: {
    Shipment?: {
      Barcode?: string;
      StatusCode?: string;
      StatusDescription?: string;
      TimeStamp?: string;
      ProductCode?: string;
      Dimension?: {
        Weight?: number;
      };
      OldStatus?: Array<{
        StatusCode?: string;
        StatusDescription?: string;
        TimeStamp?: string;
      }>;
    };
  };
}

export interface PostnlBarcodeResponse {
  Barcode?: string;
  BarcodeType?: string;
}
