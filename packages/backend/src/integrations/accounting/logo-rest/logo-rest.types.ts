/**
 * Logo REST Servis (Tiger 3 / Tiger Wings / Enterprise) — doğrulanmış sözleşme.
 * Kaynak: docs/logo.agent.md §1.1. Yalnızca token ucu doğrulandı; veri uçları,
 * alan adları ve hata sözlüğü DOCUMENTATION_REQUIRED — burada tanımlanmaz.
 */
export const LOGO_REST_DEFAULT_PORT = 32001;
export const LOGO_REST_TOKEN_PATH = '/api/v1/token';

/** Token isteği gövdesi: firmno token'a KİLİTLİDİR (§5.3). */
export interface LogoRestTokenRequestBody {
  grant_type: 'password';
  username: string;
  password: string;
  firmno: string;
}

/** OAuth2 password-grant varsayımı; expires_in Logo tarafında DOĞRULANMADI. */
export interface LogoRestTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface LogoRestTokenRequest {
  url: string;
  headers: Record<string, string>;
  body: LogoRestTokenRequestBody;
}
