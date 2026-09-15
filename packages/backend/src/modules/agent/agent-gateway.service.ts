import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import Redis from 'ioredis';
import { WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from '@common/prisma/prisma.service';
import {
  AgentJob,
  AgentResult,
  AgentToServerMessage,
  PROTOCOL_VERSION,
  ServerToAgentMessage,
  isProtocolVersionAccepted,
} from '../../integrations/accounting/core/agent/AgentProtocol';
import { AgentService } from './agent.service';

export const TUNNEL_PATH = '/api/agents/tunnel';
const SESSION_TTL_MS = 15 * 60 * 1000;
const HELLO_MAX_AGE_MS = 5 * 60 * 1000;
const DEAD_AFTER_MS = 90 * 1000;

interface Session {
  agentId: string;
  agencyId: string;
  socket: WebSocket;
  sessionToken: string;
  sessionExpiresAt: number;
  lastSeenAt: number;
}

/**
 * docs/mikro.agent.md §9.1–9.3 — AgentGateway: yalnızca GİDEN bağlantıyı kabul eden WSS ucu.
 * Dağıtık tuzak (§9.2): soket tek node'un belleğindedir; iş bırakan node `agent:{agentId}` Redis
 * kanalına yayınlar, soketi tutan node abonedir ve iletir. Sonuçlar `agent-results` kanalıyla
 * bütün node'lara döner. `connectedNodeId` yalnızca gözlemdir.
 */
@Injectable()
export class AgentGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentGatewayService.name);
  private wss?: WebSocketServer;
  private readonly sessions = new Map<string, Session>();
  private pub?: Redis;
  private sub?: Redis;
  private readonly nodeId = `${process.env.COMPUTERNAME ?? 'node'}:${process.pid}`;
  private readonly resultWaiters = new Map<string, (r: AgentResult) => void>();
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const server = this.adapterHost?.httpAdapter?.getHttpServer?.();
    if (!server || typeof server.on !== 'function') {
      this.logger.warn('HTTP sunucusu yok — AgentGateway devre dışı (test ortamı)');
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = (req.url ?? '').split('?')[0];
      if (url !== TUNNEL_PATH) return; // başka upgrade'lere dokunma
      this.wss!.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws));
    });

    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.pub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.sub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.pub.on('error', (e) => this.logger.warn(`redis pub: ${e.message}`));
      this.sub.on('error', (e) => this.logger.warn(`redis sub: ${e.message}`));
      void this.pub.connect().catch(() => undefined);
      void this.sub
        .connect()
        .then(() => this.sub!.subscribe('agent-results'))
        .then(() => {
          this.sub!.on('message', (channel, raw) => this.onRedisMessage(channel, raw));
        })
        .catch(() => undefined);
    } catch (e: any) {
      this.logger.warn(`Redis yok — gateway tek node modunda: ${e?.message}`);
    }

    this.sweeper = setInterval(() => this.sweep(), 30_000);
    this.sweeper.unref?.();
    this.logger.log(`AgentGateway hazır: ${TUNNEL_PATH} (node ${this.nodeId})`);
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const s of this.sessions.values()) s.socket.close(1001, 'shutdown');
    this.wss?.close();
    this.pub?.disconnect();
    this.sub?.disconnect();
  }

  // ------------------------------------------------------------------ bağlantı

  private onConnection(ws: WebSocket): void {
    let session: Session | null = null;
    const helloTimer = setTimeout(() => {
      if (!session) ws.close(4001, 'hello timeout');
    }, 10_000);

    ws.on('message', async (data) => {
      let msg: AgentToServerMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        ws.close(4002, 'bad json');
        return;
      }
      if (!isProtocolVersionAccepted(msg.protocolVersion)) {
        ws.close(4003, 'protocol version');
        return;
      }
      if (msg.kind === 'hello') {
        clearTimeout(helloTimer);
        session = await this.handleHello(ws, msg);
        return;
      }
      if (!session || session.agentId !== msg.agentId) {
        ws.close(4004, 'not authenticated');
        return;
      }
      if (session.sessionExpiresAt < Date.now()) {
        // §9.3: belirteç dolmuşsa Agent yeniden hello demek zorunda; REVOKED ise yeni belirteç verilmez
        ws.close(4005, 'session expired');
        return;
      }
      session.lastSeenAt = Date.now();
      switch (msg.kind) {
        case 'heartbeat':
          await this.handleHeartbeat(session, msg.clockIso, msg.erpVersion);
          break;
        case 'result':
          await this.handleResult(session, msg.result);
          break;
        case 'credential_ack':
          await this.agentService.envelopeDelivered(msg.envelopeId, msg.ok, msg.error);
          break;
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (session && this.sessions.get(session.agentId)?.socket === ws) {
        this.sessions.delete(session.agentId);
        void this.sub?.unsubscribe(`agent:${session.agentId}`).catch(() => undefined);
        void this.prisma.agentInstance
          .updateMany({ where: { id: session.agentId, status: 'ACTIVE' }, data: { status: 'OFFLINE', connectedNodeId: null } })
          .catch(() => undefined);
        this.logger.log(`agent ${session.agentId} ayrıldı`);
      }
    });
  }

  private async handleHello(ws: WebSocket, msg: Extract<AgentToServerMessage, { kind: 'hello' }>): Promise<Session | null> {
    const ident = await this.agentService.tunnelSecretOf(msg.agentId);
    if (!ident || ident.status === 'REVOKED') {
      this.send(ws, { kind: 'revoked', protocolVersion: PROTOCOL_VERSION, reason: ident ? 'revoked' : 'unknown agent' });
      ws.close(4006, 'revoked');
      return null;
    }
    if (!verifyHelloSignature(ident.secret, msg)) {
      ws.close(4007, 'bad signature');
      return null;
    }

    // aynı Agent'ın eski soketi varsa düşür (bağlantı başına tek aktif tünel)
    const prev = this.sessions.get(msg.agentId);
    if (prev && prev.socket !== ws) prev.socket.close(4008, 'superseded');

    const clockSkewSec = Math.round((Date.now() - Date.parse(msg.clockIso)) / 1000) || 0;
    const session: Session = {
      agentId: msg.agentId,
      agencyId: ident.agencyId,
      socket: ws,
      sessionToken: randomBytes(24).toString('hex'),
      sessionExpiresAt: Date.now() + SESSION_TTL_MS,
      lastSeenAt: Date.now(),
    };
    this.sessions.set(msg.agentId, session);
    await this.sub?.subscribe(`agent:${msg.agentId}`).catch(() => undefined);
    await this.prisma.agentInstance.update({
      where: { id: msg.agentId },
      data: {
        status: 'ACTIVE',
        agentVersion: msg.agentVersion,
        osVersion: msg.osVersion,
        protocolVersion: msg.protocolVersion,
        clockSkewSec,
        lastHeartbeatAt: new Date(),
        connectedNodeId: this.nodeId,
      },
    });
    if (Math.abs(clockSkewSec) > 300) {
      await this.agentService.raiseProblem(ident.agencyId, null, msg.agentId, 'erp_clock_skew', { clockSkewSec, stage: 'hello' });
    }
    this.send(ws, {
      kind: 'hello_ack',
      protocolVersion: PROTOCOL_VERSION,
      sessionToken: session.sessionToken,
      sessionExpiresAt: new Date(session.sessionExpiresAt).toISOString(),
      serverClockIso: new Date().toISOString(),
      clockSkewSec,
    });
    this.logger.log(`agent ${msg.agentId} bağlandı (v${msg.agentVersion}, skew ${clockSkewSec}s)`);

    // teslim edilmemiş kimlik zarfları ve kuyruktaki işler — en az bir kez teslim
    for (const env of await this.agentService.pendingEnvelopes(msg.agentId)) {
      this.send(ws, { kind: 'credential_envelope', protocolVersion: PROTOCOL_VERSION, envelopeId: env.id, integrationId: env.integrationId, blob: env.blob, fingerprint: env.fingerprint });
    }
    await this.flushQueuedJobs(msg.agentId);
    return session;
  }

  private async handleHeartbeat(session: Session, clockIso: string, erpVersion?: string): Promise<void> {
    const clockSkewSec = Math.round((Date.now() - Date.parse(clockIso)) / 1000) || 0;
    await this.prisma.agentInstance
      .update({ where: { id: session.agentId }, data: { lastHeartbeatAt: new Date(), clockSkewSec, status: 'ACTIVE' } })
      .catch(() => undefined);
    void erpVersion;
  }

  private async handleResult(session: Session, result: AgentResult): Promise<void> {
    const job = await this.prisma.agentJob.findUnique({ where: { id: result.jobId } });
    if (!job || job.agentId !== session.agentId) return; // başka Agent'ın işine sonuç yazılamaz
    const status = result.status === 'OK' ? 'ok' : result.status === 'EXPIRED' ? 'expired' : 'failed';
    await this.prisma.agentJob.update({
      where: { id: result.jobId },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: result.durationMs,
        errorCode: result.errorCode ?? null,
        resultRef: { status: result.status, fromCache: result.fromCache, errorCode: result.errorCode, errorRaw: result.errorRaw?.slice(0, 500) } as any,
      },
    });
    if (result.status === 'EXPIRED') {
      await this.agentService.raiseProblem(job.agencyId, job.integrationId, job.agentId, 'job_expired', { jobId: job.id, type: job.type }, job.companyKey);
    }
    if (result.status === 'REJECTED' && result.errorCode === 'job_type_rejected') {
      await this.agentService.raiseProblem(job.agencyId, job.integrationId, job.agentId, 'job_type_rejected', { jobId: job.id, type: job.type }, job.companyKey);
    }
    if (result.errorCode === 'erp_auth_failed' || result.errorCode === 'erp_clock_skew') {
      await this.agentService.raiseProblem(job.agencyId, job.integrationId, job.agentId, result.errorCode, { jobId: job.id }, job.companyKey);
    }
    // yerel bekleyen varsa çöz; diğer node'lar için yayınla
    this.resultWaiters.get(result.jobId)?.(result);
    await this.pub?.publish('agent-results', JSON.stringify(result)).catch(() => undefined);
  }

  // ------------------------------------------------------------------ iş yönlendirme

  isConnected(agentId: string): boolean {
    return this.sessions.has(agentId);
  }

  /** İş bırakan node: soket burada ise doğrudan, değilse Redis kanalı. Dönüş: sonuç sözü. */
  async dispatch(job: AgentJob, timeoutMs: number): Promise<AgentResult> {
    const waiter = new Promise<AgentResult>((resolve, reject) => {
      const t = setTimeout(() => {
        this.resultWaiters.delete(job.jobId);
        reject(new Error(`agent job ${job.jobId} zaman aşımı (${Math.round(timeoutMs / 1000)}s)`));
      }, timeoutMs);
      this.resultWaiters.set(job.jobId, (r) => {
        clearTimeout(t);
        this.resultWaiters.delete(job.jobId);
        resolve(r);
      });
    });
    const delivered = await this.deliver(job);
    if (!delivered) {
      await this.pub?.publish(`agent:${job.agentId}`, JSON.stringify({ kind: 'job', protocolVersion: PROTOCOL_VERSION, job })).catch(() => undefined);
    }
    return waiter;
  }

  private async deliver(job: AgentJob): Promise<boolean> {
    const s = this.sessions.get(job.agentId);
    if (!s) return false;
    this.send(s.socket, { kind: 'job', protocolVersion: PROTOCOL_VERSION, job });
    await this.prisma.agentJob.updateMany({ where: { id: job.jobId, status: 'queued' }, data: { status: 'dispatched' } }).catch(() => undefined);
    return true;
  }

  /** Agent bağlanınca DB'de kuyrukta bekleyen işler yeniden gönderilir (en az bir kez). */
  private async flushQueuedJobs(agentId: string): Promise<void> {
    const rows = await this.prisma.agentJob.findMany({
      where: { agentId, status: { in: ['queued', 'dispatched'] }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    for (const r of rows) {
      const job: AgentJob = {
        jobId: r.id,
        protocolVersion: PROTOCOL_VERSION,
        agentId: r.agentId,
        integrationId: r.integrationId,
        companyKey: parseCompanyKey(r.companyKey),
        type: r.type as AgentJob['type'],
        payload: r.payload,
        idempotencyKey: r.idempotencyKey,
        attempt: r.attempt + 1,
        issuedAt: r.createdAt.toISOString(),
        notBefore: r.notBefore?.toISOString(),
        ttlSec: Math.max(1, Math.round((r.expiresAt.getTime() - r.createdAt.getTime()) / 1000)),
        jobTimeoutSec: 120,
      };
      await this.deliver(job);
    }
    const expired = await this.prisma.agentJob.updateMany({
      where: { agentId, status: { in: ['queued', 'dispatched'] }, expiresAt: { lte: new Date() } },
      data: { status: 'expired', errorCode: 'job_expired', finishedAt: new Date() },
    });
    if (expired.count) this.logger.warn(`agent ${agentId}: ${expired.count} iş TTL dolduğu için expired`);
  }

  private onRedisMessage(channel: string, raw: string): void {
    try {
      if (channel === 'agent-results') {
        const r = JSON.parse(raw) as AgentResult;
        this.resultWaiters.get(r.jobId)?.(r);
        return;
      }
      if (channel.startsWith('agent:')) {
        const msg = JSON.parse(raw) as ServerToAgentMessage;
        const agentId = channel.slice('agent:'.length);
        const s = this.sessions.get(agentId);
        if (!s) return;
        this.send(s.socket, msg);
        if (msg.kind === 'job') {
          void this.prisma.agentJob.updateMany({ where: { id: msg.job.jobId, status: 'queued' }, data: { status: 'dispatched' } }).catch(() => undefined);
        }
      }
    } catch (e: any) {
      this.logger.warn(`redis mesajı işlenemedi: ${e?.message}`);
    }
  }

  /** Panelden iptal / zarf: soketi tutan node'a ulaşmak için aynı kanal. */
  async pushToAgent(agentId: string, msg: ServerToAgentMessage): Promise<void> {
    const s = this.sessions.get(agentId);
    if (s) {
      this.send(s.socket, msg);
      if (msg.kind === 'revoked') s.socket.close(4006, 'revoked');
      return;
    }
    await this.pub?.publish(`agent:${agentId}`, JSON.stringify(msg)).catch(() => undefined);
  }

  private send(ws: WebSocket, msg: ServerToAgentMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  /** 90 sn mesaj yoksa ölü say; OFFLINE işaretle. */
  private sweep(): void {
    const cutoff = Date.now() - DEAD_AFTER_MS;
    for (const s of this.sessions.values()) {
      if (s.lastSeenAt < cutoff) {
        this.logger.warn(`agent ${s.agentId} ölü sayıldı`);
        s.socket.close(4009, 'dead');
      }
    }
  }
}

/** HMAC-SHA256(agentId|nonce|issuedAt) — sabit zamanlı karşılaştırma; hello 5 dk'dan eski olamaz (replay). */
export function verifyHelloSignature(
  secret: string,
  msg: { agentId: string; auth: { nonce: string; signature: string; issuedAt: string } },
  now: number = Date.now(),
): boolean {
  const age = Math.abs(now - Date.parse(msg.auth.issuedAt));
  if (!Number.isFinite(age) || age >= HELLO_MAX_AGE_MS) return false;
  const expected = createHmac('sha256', secret).update(`${msg.agentId}|${msg.auth.nonce}|${msg.auth.issuedAt}`).digest('hex');
  if (expected.length !== msg.auth.signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(msg.auth.signature));
}

function parseCompanyKey(sessionKey: string): AgentJob['companyKey'] {
  const [, companyNo, periodNo, branchCode] = sessionKey.split(':');
  return { companyNo: companyNo ?? '', periodNo: periodNo === '-' ? null : periodNo, branchCode: branchCode === '-' ? null : branchCode };
}
