import {
  AgentJob,
  AgentResult,
  COALESCING_JOB_TYPES,
  isAgentJobType,
  isWriteJob,
} from './protocol';
import { IdempotencyStore } from './idempotency-store';

export type JobExecutor = (job: AgentJob) => Promise<AgentResult>;

export interface JobRunnerOptions {
  executor: JobExecutor;
  store: IdempotencyStore;
  agentVersion: string;
  readConcurrency: number;
  now?: () => number;
  log?: (line: string) => void;
}

const companyLane = (job: AgentJob) =>
  `${job.integrationId}:${job.companyKey.companyNo}:${job.companyKey.periodNo ?? '-'}:${job.companyKey.branchCode ?? '-'}`;

/**
 * İş döngüsü (§9.5):
 * - K6: kapalı küme dışı tip → REJECTED + log, çalıştırılmaz
 * - ttlSec dolmuş iş → EXPIRED, çalıştırılmaz, sessizce atılmaz (sonuç sunucuya döner → problem kuyruğu)
 * - yazma işi: idempotencyKey kasada varsa ERP'ye GİDİLMEZ, fromCache:true
 * - eşzamanlılık: (integration, company) başına yazma 1, okuma readConcurrency
 * - çevrimdışı kuyrukta STOCK_* işleri coalesce olur; yazma işleri sırayı korur
 */
export class JobRunner {
  private readonly queue: AgentJob[] = [];
  private readonly runningWrites = new Set<string>();
  private readonly runningReads = new Map<string, number>();
  private draining = false;
  readonly counters = { queued: 0, running: 0, ok: 0, failed: 0 };
  private readonly now: () => number;
  private readonly log: (line: string) => void;

  constructor(
    private readonly opts: JobRunnerOptions,
    private readonly emit: (result: AgentResult) => void,
  ) {
    this.now = opts.now ?? (() => Date.now());
    this.log = opts.log ?? (() => undefined);
  }

  /** Kuyruğa al; coalescing burada. */
  enqueue(job: AgentJob): void {
    if (!isAgentJobType(job.type)) {
      this.log(`[runner] küme dışı iş tipi reddedildi: ${String(job.type)} job=${job.jobId}`);
      this.emit(this.result(job, { status: 'REJECTED', errorCode: 'job_type_rejected', errorRaw: String(job.type) }));
      return;
    }
    if (COALESCING_JOB_TYPES.includes(job.type)) {
      const lane = companyLane(job);
      for (let i = this.queue.length - 1; i >= 0; i--) {
        const q = this.queue[i];
        if (q.type === job.type && companyLane(q) === lane) {
          this.log(`[runner] coalesce: ${q.jobId} yerine ${job.jobId}`);
          this.emit(this.result(q, { status: 'EXPIRED', errorCode: 'job_expired', errorRaw: 'coalesced' }));
          this.queue.splice(i, 1);
        }
      }
    }
    this.queue.push(job);
    this.counters.queued = this.queue.length;
    void this.drain();
  }

  get pending(): readonly AgentJob[] {
    return this.queue;
  }

  private result(job: AgentJob, partial: Partial<AgentResult> & { status: AgentResult['status'] }): AgentResult {
    return { jobId: job.jobId, durationMs: 0, agentVersion: this.opts.agentVersion, fromCache: false, ...partial };
  }

  private canStart(job: AgentJob): boolean {
    const lane = companyLane(job);
    if (isWriteJob(job.type)) return !this.runningWrites.has(lane);
    return (this.runningReads.get(lane) ?? 0) < this.opts.readConcurrency;
  }

  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (let i = 0; i < this.queue.length; i++) {
          const job = this.queue[i];
          if (job.notBefore && Date.parse(job.notBefore) > this.now()) continue;
          if (!this.canStart(job)) continue;
          this.queue.splice(i, 1);
          this.counters.queued = this.queue.length;
          progressed = true;
          void this.run(job).finally(() => void this.drain());
          break;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async run(job: AgentJob): Promise<void> {
    const lane = companyLane(job);
    const write = isWriteJob(job.type);
    if (write) this.runningWrites.add(lane);
    else this.runningReads.set(lane, (this.runningReads.get(lane) ?? 0) + 1);
    this.counters.running++;
    try {
      this.emit(await this.executeOnce(job));
    } finally {
      this.counters.running--;
      if (write) this.runningWrites.delete(lane);
      else this.runningReads.set(lane, (this.runningReads.get(lane) ?? 1) - 1);
    }
  }

  /** Tek işin yaşam döngüsü — testler bunu doğrudan çağırır. */
  async executeOnce(job: AgentJob): Promise<AgentResult> {
    if (!isAgentJobType(job.type)) {
      return this.result(job, { status: 'REJECTED', errorCode: 'job_type_rejected', errorRaw: String(job.type) });
    }
    const issued = Date.parse(job.issuedAt);
    if (job.ttlSec > 0 && Number.isFinite(issued) && this.now() - issued > job.ttlSec * 1000) {
      this.counters.failed++;
      return this.result(job, { status: 'EXPIRED', errorCode: 'job_expired', errorRaw: `ttl ${job.ttlSec}s` });
    }
    if (isWrite(job) && job.idempotencyKey) {
      const cached = this.opts.store.get(job.idempotencyKey);
      if (cached) {
        this.log(`[runner] idempotent tekrar: ${job.idempotencyKey} → kasadan (ERP'ye gidilmedi)`);
        return this.result(job, { status: cached.status, data: cached.data, errorCode: cached.errorCode, fromCache: true });
      }
    }
    const res = await this.opts.executor(job);
    if (res.status === 'OK') this.counters.ok++;
    else this.counters.failed++;
    if (isWrite(job) && job.idempotencyKey && (res.status === 'OK' || (res.status === 'FAILED' && res.errorCode !== 'erp_timeout'))) {
      this.opts.store.put(job.idempotencyKey, {
        jobId: job.jobId,
        status: res.status,
        data: res.data,
        errorCode: res.errorCode,
        completedAt: new Date(this.now()).toISOString(),
      });
    }
    return res;
  }
}

const isWrite = (job: AgentJob) => isWriteJob(job.type);
