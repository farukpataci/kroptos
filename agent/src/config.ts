import * as fs from 'fs';
import * as path from 'path';

/** Agent yapılandırması — %ProgramData%\KroptOS\Agent\agent.json (K6: Agent yalnızca kendi dizinine erişir). */
export interface AgentConfig {
  /** wss://... — yalnızca giden bağlantı; sunucu adresi dışında ağ erişimi yok */
  serverUrl: string;
  dataDir: string;
  agentName: string;
  erp: {
    provider: 'MIKRO';
    /** K10: Agent Mikro'nun makinesinde çalışır; localhost dışı adres transportSecurity='PLAINTEXT_LAN' ister */
    baseUrl: string;
    port: number;
    /** DOĞRULANMADI (§12/1): "Tarih + Şifre → MD5" tam biçimi. Faz D'de sabitlenir. */
    sifreFormat: string;
  };
  jobTimeoutSec: number;
  readConcurrency: number;
  heartbeatSec: number;
  deadAfterSec: number;
  reconnectMaxSec: number;
  /** K8: bu sınırı aşan saat farkında iş çalıştırılmaz */
  clockSkewLimitSec: number;
  idempotencyTtlDays: number;
  catalogDir: string;
}

export const DEFAULT_DATA_DIR = path.join(process.env.ProgramData || 'C:\\ProgramData', 'KroptOS', 'Agent');

export function defaultConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  const dataDir = overrides.dataDir ?? DEFAULT_DATA_DIR;
  return {
    serverUrl: 'wss://localhost:3001/api/agents/tunnel',
    dataDir,
    agentName: process.env.COMPUTERNAME || 'AGENT',
    erp: { provider: 'MIKRO', baseUrl: 'http://localhost', port: 8094, sifreFormat: '{date} {password}' },
    jobTimeoutSec: 120,
    readConcurrency: 2,
    heartbeatSec: 30,
    deadAfterSec: 90,
    reconnectMaxSec: 60,
    clockSkewLimitSec: 300,
    idempotencyTtlDays: 7,
    catalogDir: resolveCatalogDir(),
    ...overrides,
  };
}

/** Katalog: derlenmiş (dist/agent/src) ya da kaynak (src) konumundan yukarı doğru aranır. */
export function resolveCatalogDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, 'catalog', 'mikro');
    if (fs.existsSync(path.join(candidate, 'manifest.json'))) return candidate;
    dir = path.dirname(dir);
  }
  return path.join(DEFAULT_DATA_DIR, 'catalog', 'mikro');
}

export function loadConfig(file = path.join(DEFAULT_DATA_DIR, 'agent.json')): AgentConfig {
  if (!fs.existsSync(file)) return defaultConfig();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return defaultConfig({ ...raw, erp: { ...defaultConfig().erp, ...(raw.erp ?? {}) } });
}
