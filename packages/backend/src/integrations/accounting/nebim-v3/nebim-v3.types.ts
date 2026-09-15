/**
 * Nebim V3 Integrator REST API — docs/nebim.v3.agent.md §3, §7.
 * İkincil kaynaklardan ve resmî broşürlerden okunanlar; gerçek ağ çağrısıyla doğrulanana kadar
 * DOCUMENTATION_REQUIRED yorumuyla korunur (§11).
 */

export const NEBIM_V3_DEFAULT_BASE_URL = 'http://localhost';
export const NEBIM_V3_DEFAULT_SERVICE_PATH = '/IntegratorService';

/**
 * İkincil kaynaktan bilinen Integrator uçları (docs/nebim.v3.agent.md §3.3).
 * Connect ucu doğrulanmalıdır; diğer uçlar metot listesi teyit edildikten sonra doldurulur.
 */
export const NEBIM_V3_PATHS = {
  Connect: '/IntegratorService/Connect',
  Disconnect: '/IntegratorService/Disconnect', // §12/2 — varlığı doğrulanacak
} as const;

export type NebimV3Method = keyof typeof NEBIM_V3_PATHS;

/**
 * K1 / K15 — bu anahtarlar backend connector'ın ürettiği HİÇBİR gövdede bulunmaz.
 * Kimliği ve SessionID'yi Agent yerel kasasında ve oturum havuzunda tutar.
 */
export const NEBIM_V3_FORBIDDEN_BODY_KEYS: readonly string[] = [
  'UserGroupCode',
  'Username',
  'Password',
  'userGroupCode',
  'username',
  'password',
  'SessionID',
  'sessionId',
  'session_id',
  'sessionToken',
];

/** Agent'ın Integrator'a gönderdiği Connect gövdesi (Agent tarafında kurulur, backend görmez) */
export interface NebimV3ConnectPayload {
  ModelType?: number;
  UserGroupCode: string;
  Username: string;
  Password: string;
  DatabaseName: string;
}

/** Integrator'ın Connect yanıtı (§3.3 — ikincil kaynak) */
export interface NebimV3ConnectResponse {
  ModelType?: number;
  SessionID?: string;
  Status?: string;
  Message?: string;
  ErrorCode?: number | string;
}
