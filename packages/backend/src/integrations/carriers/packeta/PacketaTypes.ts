export const PACKETA_ENDPOINTS = {
  BASE_URL: 'https://www.zasilkovna.cz/api/rest',
  BRANCHES_URL: 'https://www.zasilkovna.cz/api/v2',
} as const;

export interface PacketaCredentials {
  apiKey: string;
  apiSecret: string;
  eshop: string;
}

export interface PacketaPacketPayload {
  number: string; // Order / Reference number
  name: string;
  surname: string;
  email: string;
  phone: string;
  addressId: number | string; // Branch / Pickup Locker ID or 1 for HD
  weight: number; // in Kg
  value: number;
  currency?: string;
  eshop?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  zip?: string;
}

export interface PacketaPacketResponse {
  status: string; // 'ok' | 'error'
  result?: {
    id: string; // Packeta Packet ID (e.g. Z123456789)
    barcode?: string;
    barcodeText?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PacketaTrackingEvent {
  code: string; // '1', '2', '3', '4', '5', '6', '7', '8'
  name: string;
  dateTime: string;
  location?: string;
}

export interface PacketaTrackingResponse {
  status: string;
  result?: {
    packetId: string;
    statusCode?: string;
    statusName?: string;
    events?: PacketaTrackingEvent[];
  };
}
