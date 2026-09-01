export const CARGUS_ENDPOINTS = {
  BASE_URL: 'https://urgentcargus.azure-api.net/api',
} as const;

export interface CargusCredentials {
  subscriptionKey: string;
  username: string;
  password: string;
  locationId?: number | string;
}

export interface CargusAddress {
  Name: string;
  ContactPerson?: string;
  Phone: string;
  Email?: string;
  CountyName: string; // Județ / İl
  LocalityName: string; // Localitate / İlçe
  StreetName: string; // Strada
  BuildingNumber?: string;
  PostalCode?: string;
}

export interface CargusAwbPayload {
  Sender: CargusAddress;
  Destination: CargusAddress;
  PriceTableId?: number;
  ServiceId?: number; // 1 = Standard, 34 = Lockers
  Parcels: number;
  Weight: number; // in Kg
  weightKg?: number;
  CustomString?: string;
}

export interface CargusAwbResponse {
  BarCode?: string;
  Barcode?: string;
  AwbNumber?: string;
  ReturnCode?: number;
  ReturnMessage?: string;
  ErrorMessage?: string;
  PdfLabel?: string;
}

export interface CargusEvent {
  EventId?: number;
  StatusCode: string; // '1', '2', '3', '4', '5', '6', '7'
  StatusName: string;
  EventDate: string; // YYYY-MM-DD HH:mm:ss
  LocationName?: string;
}

export interface CargusTrackingResponse {
  BarCode: string;
  StatusId?: number;
  StatusCode?: string;
  StatusName?: string;
  EventList?: CargusEvent[];
  Events?: CargusEvent[];
}
