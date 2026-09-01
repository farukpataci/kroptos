export const POCZTEX_ENDPOINTS = {
  PROD_WSDL: 'https://e-nadawca.poczta-polska.pl/websrv/en.wsdl',
  TEST_WSDL: 'https://en-testwebapi.poczta-polska.pl/websrv/en.wsdl',
  REST_TRACKING_URL: 'https://uss.poczta-polska.pl/uss/v1/tracking',
} as const;

export interface PocztexCredentials {
  username: string;
  password: string;
  accountNumber: string; // Karta / Profil numarası
}

export interface PocztexAddress {
  nazwa: string; // İsim / Ünvan
  ulica: string; // Sokak
  dom: string; // Bina No
  miejscowosc: string; // Şehir / İlçe
  kodPocztowy: string; // Posta Kodu (XX-XXX)
  telefon?: string;
  email?: string;
}

export interface PocztexPrzesylkaPayload {
  guid: string;
  opakowanie: string;
  masa: number; // gram / kg
  weightKg?: number;
  uprzedniePowiadomienie?: boolean;
  adresat: PocztexAddress;
  karta: string;
}

export interface PocztexPrzesylkaResponse {
  status: string; // 'OK' | 'ERROR'
  numerNadania?: string; // Pocztex tracking number (e.g. PX123456789PL)
  guid?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PocztexTrackingEvent {
  kod: string; // '0', '1', '2', '3', '4', '5', '6', '7'
  nazwa: string;
  czas: string;
  jednostka?: string;
}

export interface PocztexTrackingResponse {
  numer?: string;
  status?: string;
  zdarzenia?: PocztexTrackingEvent[];
  events?: PocztexTrackingEvent[];
}
