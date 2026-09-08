export interface SapS4HanaCloudCredentials {
  apiKey?: string; // Sandbox access key (for https://sandbox.api.sap.com)
  useSandbox?: boolean;
  baseUrl?: string; // Customer tenant URL (e.g. https://myXXXXXX-api.s4hana.ondemand.com)
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

export interface ODataSingleResponse<T> {
  d: T;
}

export interface ODataListResponse<T> {
  d: {
    results: T[];
    __count?: string;
  };
}

export interface SapBusinessPartnerAddress {
  BusinessPartner: string;
  AddressID: string;
  CityName?: string;
  Country?: string;
  PostalCode?: string;
  StreetName?: string;
  District?: string;
}

export interface SapBusinessPartnerTaxNumber {
  BusinessPartner: string;
  BPTaxType: string;
  BPTaxNumber: string;
}

export interface SapBusinessPartner {
  BusinessPartner: string;
  Customer?: string;
  Supplier?: string;
  AcademicTitle?: string;
  AuthorizationGroup?: string;
  BusinessPartnerCategory: string; // '1' = Person (B2C), '2' = Organization (B2B)
  BusinessPartnerFullName?: string;
  BusinessPartnerGrouping?: string;
  BusinessPartnerName?: string;
  CorrespondenceLanguage?: string;
  FirstName?: string;
  LastName?: string;
  LegalForm?: string;
  OrganizationBPName1?: string;
  OrganizationBPName2?: string;
  SearchTerm1?: string;
  SearchTerm2?: string;
  to_BusinessPartnerAddress?: {
    results: SapBusinessPartnerAddress[];
  };
  to_BusinessPartnerTaxNumber?: {
    results: SapBusinessPartnerTaxNumber[];
  };
}

export interface SapODataErrorBody {
  error: {
    code: string;
    message: {
      lang?: string;
      value: string;
    };
    innererror?: {
      application?: {
        component_id?: string;
        service_namespace?: string;
        service_id?: string;
        service_version?: string;
      };
      transactionid?: string;
      timestamp?: string;
      Error_Resolution?: Record<string, any>;
      errordetails?: Array<{
        code: string;
        message: string;
        propertyref?: string;
        severity?: string;
        target?: string;
      }>;
    };
  };
}

export interface SapFindContactQuery {
  searchTerm?: string;
  taxNumber?: string;
  businessPartnerId?: string;
  top?: number;
  skip?: number;
}
