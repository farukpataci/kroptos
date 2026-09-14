import { AgentJobType } from '../agent/AgentProtocol';
import { CompanyKey } from '../AccountingTypes';

/**
 * Connector "şu işi yap" der; transport onu ya doğrudan HTTP ile ya da Agent'a iş bırakarak
 * gerçekleştirir. Kimliği yalnızca Agent (veya DirectTransport'un kendi credential çözücüsü) bilir.
 */
export interface TransportOperation {
  /** Agent rotasında kapalı kümeden bir iş tipi (K6) */
  type: AgentJobType;
  integrationId: string;
  companyKey: CompanyKey;
  /** KİMLİKSİZ gövde (K1) — transport çalışma zamanında sızıntı denetler */
  payload: unknown;
  /** Yazma işlerinde zorunlu (deterministik externalRef) */
  idempotencyKey?: string | null;
  timeoutSec?: number;
  ttlSec?: number;
}

export interface TransportResult<T = unknown> {
  data: T;
  /** Agent kasasından döndü — ERP'ye gidilmedi */
  fromCache: boolean;
  durationMs: number;
}

export interface AccountingTransport {
  readonly kind: 'DIRECT' | 'AGENT';
  execute<T = unknown>(op: TransportOperation): Promise<TransportResult<T>>;
  /** Uygunluk paketi ağ/iş çağrısı sayısını buradan ölçer */
  readonly callCount: number;
}
