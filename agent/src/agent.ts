import * as os from 'os';
import * as path from 'path';
import { AgentConfig } from './config';
import { Vault, Protector } from './vault';
import { IdempotencyStore } from './idempotency-store';
import { CatalogEntry, loadCatalog } from './catalog';
import { MikroExecutor, FetchLike } from './mikro/executor';
import { JobRunner } from './job-runner';
import { Tunnel, SocketLike } from './tunnel';
import { open as openEnvelope, fingerprintOf } from './credential-envelope';
import { AgentEnvelopeAckMessage, AgentResult, PROTOCOL_VERSION } from './protocol';

export const AGENT_VERSION = '0.1.0';

export interface AgentDeps {
  protector: Protector;
  fetch: FetchLike;
  connect?: (url: string) => SocketLike;
  now?: () => Date;
  log?: (line: string) => void;
}

/**
 * Agent kompozisyonu. Başlatma sırası: katalog (SELECT dışı ifade → BAŞLAMAZ) → kasa → runner → tünel.
 * Sunucuya giden tek şey iş sonucudur; kimlik kasadan executor'a gider, hiçbir log satırına düşmez.
 */
export class Agent {
  readonly vault: Vault;
  readonly store: IdempotencyStore;
  readonly catalog: Map<string, CatalogEntry>;
  readonly executor: MikroExecutor;
  readonly runner: JobRunner;
  tunnel: Tunnel | null = null;
  /** Tünel yokken üretilen sonuçlar — en az bir kez teslim (§9.5) */
  readonly pendingResults: AgentResult[] = [];
  stoppedByRevoke = false;
  private readonly log: (line: string) => void;

  constructor(
    readonly config: AgentConfig,
    private readonly deps: AgentDeps,
  ) {
    this.log = deps.log ?? ((l) => console.log(l));
    this.catalog = loadCatalog(config.catalogDir); // fırlatırsa Agent başlamaz (K7)
    this.vault = new Vault(path.join(config.dataDir, 'vault.bin'), deps.protector);
    this.vault.load();
    this.store = new IdempotencyStore(
      path.join(config.dataDir, 'idempotency.json'),
      config.idempotencyTtlDays * 24 * 3600 * 1000,
      () => (deps.now ?? (() => new Date()))().getTime(),
    );
    this.store.load();
    this.executor = new MikroExecutor({
      baseUrl: config.erp.baseUrl,
      port: config.erp.port,
      sifreFormat: config.erp.sifreFormat,
      clockSkewLimitSec: config.clockSkewLimitSec,
      agentVersion: AGENT_VERSION,
      catalog: this.catalog,
      fetch: deps.fetch,
      now: deps.now,
      log: this.log,
    });
    this.runner = new JobRunner(
      {
        executor: (job) => this.executor.execute(job, this.vault.getCredentials(job.integrationId)),
        store: this.store,
        agentVersion: AGENT_VERSION,
        readConcurrency: config.readConcurrency,
        now: () => (deps.now ?? (() => new Date()))().getTime(),
        log: this.log,
      },
      (result) => this.deliver(result),
    );
  }

  private deliver(result: AgentResult): void {
    if (this.tunnel?.connected && this.tunnel.sendResult(result)) return;
    this.pendingResults.push(result);
  }

  private flushPending(): void {
    while (this.pendingResults.length && this.tunnel?.connected) {
      const r = this.pendingResults[0];
      if (!this.tunnel.sendResult(r)) break;
      this.pendingResults.shift();
    }
  }

  start(): void {
    const id = this.vault.identity;
    if (!id.agentId || !id.agentSecret) throw new Error('Agent kayıtlı değil — önce `enroll <kod>` çalıştırın');
    this.tunnel = new Tunnel(
      {
        serverUrl: this.config.serverUrl,
        agentId: id.agentId,
        agentSecret: id.agentSecret,
        agentVersion: AGENT_VERSION,
        osVersion: `${os.platform()} ${os.release()}`,
        heartbeatSec: this.config.heartbeatSec,
        deadAfterSec: this.config.deadAfterSec,
        reconnectMaxSec: this.config.reconnectMaxSec,
        counters: () => ({ ...this.runner.counters }),
        connect: this.deps.connect,
        now: this.deps.now,
        log: this.log,
      },
      {
        onHelloAck: () => this.flushPending(),
        onJob: (m) => this.runner.enqueue(m.job),
        onCredentialEnvelope: (m) => this.onEnvelope(m.envelopeId, m.integrationId, m.blob, m.fingerprint),
        onRevoked: (reason) => this.onRevoked(reason),
      },
    );
    this.tunnel.start();
  }

  /** K2: blob yalnızca burada çözülür; alanlar kasaya yazılır; düz metin bellekte tutulmaz. */
  onEnvelope(envelopeId: string, integrationId: string, blob: string, fingerprint: string): void {
    const ack = (ok: boolean, error?: string) => {
      const m: AgentEnvelopeAckMessage = { kind: 'credential_ack', protocolVersion: PROTOCOL_VERSION, agentId: this.vault.identity.agentId!, envelopeId, ok, error };
      this.tunnel?.send(m);
    };
    try {
      if (fingerprintOf(blob) !== fingerprint) throw new Error('parmak izi uyuşmuyor');
      const pk = this.vault.identity.privateKeyPem;
      if (!pk) throw new Error('özel anahtar yok');
      const fields = openEnvelope(pk, blob);
      this.vault.setCredentials(integrationId, fields);
      for (const k of Object.keys(fields)) fields[k] = '';
      this.log(`[agent] kimlik teslim alındı integration=${integrationId} fp=${fingerprint.slice(0, 12)}`);
      ack(true);
    } catch (e: any) {
      this.log(`[agent] kimlik zarfı reddedildi: ${e?.message ?? e}`);
      ack(false, String(e?.message ?? e));
    }
  }

  /** §9.3: REVOKED → yerel kasa silinir, Agent durur. */
  onRevoked(reason: string): void {
    this.log(`[agent] REVOKED (${reason}) — kasa siliniyor, durduruluyor`);
    this.vault.wipe();
    this.stoppedByRevoke = true;
    this.tunnel?.stop();
  }

  stop(): void {
    this.tunnel?.stop();
  }
}
