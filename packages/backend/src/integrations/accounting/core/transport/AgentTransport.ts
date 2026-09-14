import {
  AgentJob,
  AgentResult,
  DEFAULT_JOB_TIMEOUT_SEC,
  DEFAULT_JOB_TTL_SEC,
  PROTOCOL_VERSION,
  isAgentJobType,
  isWriteJob,
} from '../agent/AgentProtocol';
import { assertNoCredentialLeak } from '../AccountingCredentialSchema';
import { AccountingApiError, AccountingNetworkError } from '../AccountingErrors';
import { AccountingTransport, TransportOperation, TransportResult } from './AccountingTransport';

/**
 * Sunucu tarafında işi Agent'a ulaştıran port. Gerçek uygulaması `modules/agent`'taki
 * AgentJobService'tir (DB satırı + Redis pub/sub + WS). Uygunluk paketi bunu sayaçla değiştirir.
 */
export interface AgentJobDispatcher {
  dispatch(job: AgentJob): Promise<AgentResult>;
}

/** Sunucuda kesinlikle görünmemesi gereken anahtarlar — sağlayıcıdan bağımsız çekirdek liste (K1). */
export const CORE_FORBIDDEN_PAYLOAD_KEYS = [
  'password',
  'sifre',
  'apiKey',
  'clientSecret',
  'accessToken',
  'refreshToken',
  'kullaniciKodu',
  'dbPassword',
] as const;

export interface AgentTransportOptions {
  agentId: string;
  agencyId: string;
  /** Sağlayıcının kendi yasak anahtarları (örn. Mikro: 'Mikro', 'ApiKey', 'Sifre', 'KullaniciKodu') */
  extraForbiddenKeys?: readonly string[];
  now?: () => Date;
  jobIdFactory?: () => string;
}

/**
 * `op`'u AgentJob zarfına sarar, dispatcher'a bırakır, sonucu yorumlar.
 * Zaman aşımı, yeniden deneme ve `fromCache` yorumu BURADA yapılır; connector Agent'ı bilmez.
 */
export class AgentTransport implements AccountingTransport {
  readonly kind = 'AGENT' as const;
  private calls = 0;

  constructor(
    private readonly dispatcher: AgentJobDispatcher,
    private readonly opts: AgentTransportOptions,
  ) {}

  get callCount(): number {
    return this.calls;
  }

  async execute<T = unknown>(op: TransportOperation): Promise<TransportResult<T>> {
    if (!isAgentJobType(op.type)) {
      throw new AccountingApiError('AGENT', 400, `Kapalı küme dışı iş tipi: ${String(op.type)} (K6)`);
    }
    if (isWriteJob(op.type) && !op.idempotencyKey) {
      throw new AccountingApiError('AGENT', 400, `${op.type} için idempotencyKey zorunlu (§9.5)`);
    }
    assertNoCredentialLeak(op.payload, [...CORE_FORBIDDEN_PAYLOAD_KEYS, ...(this.opts.extraForbiddenKeys ?? [])]);

    const job: AgentJob = {
      jobId: (this.opts.jobIdFactory ?? defaultJobId)(),
      protocolVersion: PROTOCOL_VERSION,
      agentId: this.opts.agentId,
      integrationId: op.integrationId,
      companyKey: op.companyKey,
      type: op.type,
      payload: op.payload ?? {},
      idempotencyKey: isWriteJob(op.type) ? op.idempotencyKey! : null,
      attempt: 1,
      issuedAt: (this.opts.now ?? (() => new Date()))().toISOString(),
      ttlSec: op.ttlSec ?? DEFAULT_JOB_TTL_SEC,
      jobTimeoutSec: op.timeoutSec ?? DEFAULT_JOB_TIMEOUT_SEC,
    };

    this.calls++;
    const result = await this.dispatcher.dispatch(job);

    switch (result.status) {
      case 'OK':
        return { data: result.data as T, fromCache: result.fromCache, durationMs: result.durationMs };
      case 'RETRYABLE':
      case 'EXPIRED':
        // Agent çevrimdışı / tünel koptu / TTL doldu → ağ sınıfı hata; çağıran 'stuck' yazar
        throw new AccountingNetworkError('AGENT', `${result.status}: ${result.errorCode ?? ''} ${result.errorRaw ?? ''}`.trim());
      case 'REJECTED':
        throw new AccountingApiError('AGENT', 400, `Agent işi reddetti: ${result.errorCode ?? ''} ${result.errorRaw ?? ''}`.trim());
      case 'FAILED':
      default:
        throw new AccountingApiError('AGENT', 502, `${result.errorCode ?? 'erp_error'}: ${result.errorRaw ?? ''}`.trim(), {
          errorCode: result.errorCode,
        });
    }
  }
}

function defaultJobId(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('crypto').randomUUID();
}
