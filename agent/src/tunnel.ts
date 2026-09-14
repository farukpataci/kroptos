import { createHmac, randomBytes } from 'crypto';
import {
  AgentHeartbeatMessage,
  AgentHelloMessage,
  AgentResult,
  AgentResultMessage,
  PROTOCOL_VERSION,
  ServerToAgentMessage,
  isProtocolVersionAccepted,
} from './protocol';

/** Node 22+ yerleşik WebSocket istemcisi — ek bağımlılık yok. Testlerde sahte soket verilir. */
export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface TunnelOptions {
  serverUrl: string;
  agentId: string;
  agentSecret: string;
  agentVersion: string;
  osVersion: string;
  heartbeatSec: number;
  deadAfterSec: number;
  reconnectMaxSec: number;
  counters: () => AgentHeartbeatMessage['counters'];
  connect?: (url: string) => SocketLike;
  now?: () => Date;
  log?: (line: string) => void;
  /** Kurumsal HTTP CONNECT proxy — Node yerleşik istemcisi env HTTPS_PROXY'yi kendisi okur */
}

export interface TunnelHandlers {
  onJob: (msg: Extract<ServerToAgentMessage, { kind: 'job' }>) => void;
  onCredentialEnvelope: (msg: Extract<ServerToAgentMessage, { kind: 'credential_envelope' }>) => void;
  onRevoked: (reason: string) => void;
  onHelloAck?: (msg: Extract<ServerToAgentMessage, { kind: 'hello_ack' }>) => void;
}

/**
 * §9.1 — yalnızca GİDEN bağlantı: müşteride açılan port yok. Kalp atışı 30 sn / ölü sayma 90 sn,
 * yeniden bağlanma üstel geri çekilme + jitter (üst sınır 60 sn), her mesajda protocolVersion.
 * Kimlik: kayıtta verilen agentSecret ile HMAC-imzalı hello (mTLS yerine — bkz. README sapma notu).
 */
export class Tunnel {
  private socket: SocketLike | null = null;
  private attempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private deadTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private lastServerMessageAt = 0;
  sessionToken: string | null = null;
  clockSkewSec = 0;
  private readonly now: () => Date;
  private readonly log: (line: string) => void;

  constructor(
    private readonly opts: TunnelOptions,
    private readonly handlers: TunnelHandlers,
  ) {
    this.now = opts.now ?? (() => new Date());
    this.log = opts.log ?? (() => undefined);
  }

  get connected(): boolean {
    return !!this.socket && !!this.sessionToken;
  }

  /** Üstel geri çekilme + jitter; üst sınır reconnectMaxSec (§9.1). */
  backoffMs(attempt: number, rand = Math.random()): number {
    const base = Math.min(this.opts.reconnectMaxSec, 2 ** Math.min(attempt, 10)) * 1000;
    return Math.round(base * (0.5 + rand * 0.5));
  }

  buildHello(): AgentHelloMessage {
    const nonce = randomBytes(16).toString('hex');
    const issuedAt = this.now().toISOString();
    const signature = createHmac('sha256', this.opts.agentSecret).update(`${this.opts.agentId}|${nonce}|${issuedAt}`).digest('hex');
    return {
      kind: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      agentId: this.opts.agentId,
      auth: { nonce, signature, issuedAt },
      agentVersion: this.opts.agentVersion,
      osVersion: this.opts.osVersion,
      clockIso: issuedAt,
    };
  }

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close(1000, 'stop');
    this.socket = null;
    this.sessionToken = null;
  }

  private open(): void {
    if (this.stopped) return;
    const connect = this.opts.connect ?? ((url: string) => new (globalThis as any).WebSocket(url) as SocketLike);
    let socket: SocketLike;
    try {
      socket = connect(this.opts.serverUrl);
    } catch (e: any) {
      this.log(`[tunnel] bağlantı kurulamadı: ${e?.message ?? e}`);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.log('[tunnel] açıldı, hello gönderiliyor');
      socket.send(JSON.stringify(this.buildHello()));
      this.touch();
    };
    socket.onmessage = (ev) => this.handle(String(ev.data));
    socket.onclose = (ev) => {
      this.log(`[tunnel] kapandı ${ev.code} ${ev.reason}`);
      this.socket = null;
      this.sessionToken = null;
      this.clearTimers();
      this.scheduleReconnect();
    };
    socket.onerror = () => undefined;
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const ms = this.backoffMs(this.attempts++);
    this.log(`[tunnel] ${Math.round(ms / 1000)} sn sonra yeniden bağlanılacak`);
    setTimeout(() => this.open(), ms).unref?.();
  }

  private touch(): void {
    this.lastServerMessageAt = this.now().getTime();
    if (this.deadTimer) clearTimeout(this.deadTimer);
    this.deadTimer = setTimeout(() => {
      this.log('[tunnel] sunucudan mesaj yok — ölü sayıldı');
      this.socket?.close(4000, 'dead');
    }, this.opts.deadAfterSec * 1000);
    this.deadTimer.unref?.();
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.deadTimer) clearTimeout(this.deadTimer);
    this.heartbeatTimer = null;
    this.deadTimer = null;
  }

  handle(raw: string): void {
    let msg: ServerToAgentMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.log('[tunnel] bozuk mesaj yok sayıldı');
      return;
    }
    if (!isProtocolVersionAccepted(msg.protocolVersion)) {
      this.log(`[tunnel] protokol sürümü reddedildi: ${String(msg.protocolVersion)}`);
      return;
    }
    this.touch();
    switch (msg.kind) {
      case 'hello_ack':
        this.attempts = 0;
        this.sessionToken = msg.sessionToken;
        this.clockSkewSec = msg.clockSkewSec;
        this.startHeartbeat();
        this.handlers.onHelloAck?.(msg);
        break;
      case 'job':
        this.handlers.onJob(msg);
        break;
      case 'credential_envelope':
        this.handlers.onCredentialEnvelope(msg);
        break;
      case 'revoked':
        // §9.3: kasa silinir, Agent durur — yeniden bağlanma YOK
        this.stopped = true;
        this.clearTimers();
        this.handlers.onRevoked(msg.reason);
        this.socket?.close(1000, 'revoked');
        this.socket = null;
        break;
      default:
        this.log(`[tunnel] bilinmeyen mesaj türü yok sayıldı: ${(msg as any).kind}`);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      const hb: AgentHeartbeatMessage = {
        kind: 'heartbeat',
        protocolVersion: PROTOCOL_VERSION,
        agentId: this.opts.agentId,
        clockIso: this.now().toISOString(),
        counters: this.opts.counters(),
      };
      this.send(hb);
    }, this.opts.heartbeatSec * 1000);
    this.heartbeatTimer.unref?.();
  }

  send(msg: object): boolean {
    if (!this.socket) return false;
    try {
      this.socket.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  sendResult(result: AgentResult): boolean {
    const m: AgentResultMessage = { kind: 'result', protocolVersion: PROTOCOL_VERSION, agentId: this.opts.agentId, result };
    return this.send(m);
  }
}
