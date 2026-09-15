/**
 * KroptOS Agent protokolü — TEK KAYNAK. `agent/` workspace'i bu dosyayı doğrudan import eder;
 * iki dilde elle yazılan zarf tanımı ilk sürüm uyuşmazlığında sessizce bozulur.
 * (docs/mikro.agent.md §6.1, §9)
 */
import { CompanyKey } from '../AccountingTypes';

export const PROTOCOL_VERSION = 1;
/** Sunucu N ve N-1'i kabul eder (§9.1). */
export const ACCEPTED_PROTOCOL_VERSIONS: readonly number[] = [PROTOCOL_VERSION, PROTOCOL_VERSION - 1].filter(
  (v) => v >= 1,
);

/**
 * K6 — KAPALI KÜME. Küme dışı tip reddedilir ve loglanır; hiçbir sağlayıcı bu listeye ekleme yaptıramaz.
 * CATALOG_QUERY bir sağlayıcıya değil AGENT+SQL ROTASINA aittir (K7).
 */
export const AGENT_JOB_TYPES = [
  'CONNECTION_TEST',
  'COMPANY_LIST',
  'WAREHOUSE_LIST',
  'PRODUCT_SEARCH',
  'PRODUCT_FETCH',
  'STOCK_SNAPSHOT',
  'STOCK_DELTA',
  'PARTNER_UPSERT',
  'PARTNER_FETCH',
  'RECEIPT_PUSH',
  'INVOICE_PUSH',
  'INVOICE_FIND_BY_REF',
  'INVOICE_CANCEL',
  'CATALOG_QUERY',
  'SESSION_RELEASE',
] as const;

export type AgentJobType = (typeof AGENT_JOB_TYPES)[number];

/** Yazma işleri: idempotencyKey ZORUNLU, (integration, company) başına aynı anda 1 (§9.5). */
export const WRITE_JOB_TYPES: readonly AgentJobType[] = [
  'PARTNER_UPSERT',
  'RECEIPT_PUSH',
  'INVOICE_PUSH',
  'INVOICE_CANCEL',
];

/** Çevrimdışıyken kuyrukta yalnızca en son bir tanesi kalır (coalesce, §9.5). */
export const COALESCING_JOB_TYPES: readonly AgentJobType[] = ['STOCK_SNAPSHOT', 'STOCK_DELTA'];

export function isAgentJobType(value: unknown): value is AgentJobType {
  return typeof value === 'string' && (AGENT_JOB_TYPES as readonly string[]).includes(value);
}

export function isWriteJob(type: AgentJobType): boolean {
  return WRITE_JOB_TYPES.includes(type);
}

export const DEFAULT_JOB_TIMEOUT_SEC = 120;
export const DEFAULT_JOB_TTL_SEC = 6 * 60 * 60;

export interface AgentJob {
  jobId: string; // sunucu üretir
  protocolVersion: number;
  agentId: string;
  integrationId: string;
  /** SessionKey ekseni — Agent kimlik zarfına FirmaKodu/CalismaYili'yi buradan takar (§9.6) */
  companyKey: CompanyKey;
  type: AgentJobType;
  /** Tipi job type'a bağlı; KİMLİK ASLA GİRMEZ (K1) */
  payload: unknown;
  /** Yazma işlerinde zorunlu, okuma işlerinde null */
  idempotencyKey: string | null;
  attempt: number;
  /** ISO — sunucu üretir; ttlSec bundan sayılır */
  issuedAt: string;
  notBefore?: string; // ISO
  ttlSec: number;
  jobTimeoutSec: number;
}

export type AgentResultStatus = 'OK' | 'FAILED' | 'RETRYABLE' | 'EXPIRED' | 'REJECTED';

export interface AgentResult {
  jobId: string;
  status: AgentResultStatus;
  data?: unknown;
  /** Agent'ın normalize ettiği kod — problem kuyruğu kodlarıyla aynı sözlük */
  errorCode?: string;
  /** ERP'nin ham mesajı — kırpılmış, PII/credential taranmış */
  errorRaw?: string;
  durationMs: number;
  agentVersion: string;
  /** Yerel tekrar-koruma kasasından döndü — ERP'ye GİDİLMEDİ (§9.5) */
  fromCache: boolean;
}

/** Problem kuyruğu kodları (§9.7) — Agent ve sunucu aynı sözlüğü kullanır. */
export const PROBLEM_CODES = [
  'agent_offline',
  'agent_failover_blocked',
  'erp_auth_failed',
  'erp_session_limit',
  'erp_clock_skew',
  'mapping_missing',
  'stock_sync_stale',
  'invoice_stuck',
  'catalog_schema_drift',
  'job_expired',
  'job_type_rejected',
  'posting_defaults_missing',
  'session_leaked',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

// ---------------------------------------------------------------------------
// Tünel mesajları (Agent ⇄ AgentGateway). Her mesajda protocolVersion (§9.1).
// ---------------------------------------------------------------------------

export interface AgentHelloMessage {
  kind: 'hello';
  protocolVersion: number;
  agentId: string;
  /** Kayıtta verilen kimlik sırrının HMAC'i ile imzalanır; sunucu doğrular */
  auth: { nonce: string; signature: string; issuedAt: string };
  agentVersion: string;
  osVersion: string;
  /** K8: Agent saati — sunucu farkı ölçer */
  clockIso: string;
}

export interface AgentHeartbeatMessage {
  kind: 'heartbeat';
  protocolVersion: number;
  agentId: string;
  clockIso: string;
  erpVersion?: string;
  counters: { queued: number; running: number; ok: number; failed: number };
}

export interface ServerJobMessage {
  kind: 'job';
  protocolVersion: number;
  job: AgentJob;
}

export interface AgentResultMessage {
  kind: 'result';
  protocolVersion: number;
  agentId: string;
  result: AgentResult;
}

/** K2: sunucu bu blob'u çözemez; Agent açık anahtarıyla şifrelidir, teslimde silinir */
export interface ServerCredentialEnvelopeMessage {
  kind: 'credential_envelope';
  protocolVersion: number;
  envelopeId: string;
  integrationId: string;
  blob: string;
  fingerprint: string;
}

export interface AgentEnvelopeAckMessage {
  kind: 'credential_ack';
  protocolVersion: number;
  agentId: string;
  envelopeId: string;
  ok: boolean;
  error?: string;
}

/** Agent bunu alınca yerel kasasını siler ve durur (§9.3) */
export interface ServerRevokedMessage {
  kind: 'revoked';
  protocolVersion: number;
  reason: string;
}

export interface ServerHelloAckMessage {
  kind: 'hello_ack';
  protocolVersion: number;
  /** Kısa ömürlü oturum belirteci (öneri 15 dk) — iptal sertifika süresini beklemez */
  sessionToken: string;
  sessionExpiresAt: string;
  serverClockIso: string;
  clockSkewSec: number;
}

export type AgentToServerMessage = AgentHelloMessage | AgentHeartbeatMessage | AgentResultMessage | AgentEnvelopeAckMessage;
export type ServerToAgentMessage =
  | ServerHelloAckMessage
  | ServerJobMessage
  | ServerCredentialEnvelopeMessage
  | ServerRevokedMessage;
export type TunnelMessage = AgentToServerMessage | ServerToAgentMessage;

export function isProtocolVersionAccepted(v: unknown): v is number {
  return typeof v === 'number' && ACCEPTED_PROTOCOL_VERSIONS.includes(v);
}
