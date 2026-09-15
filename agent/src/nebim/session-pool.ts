import * as fs from 'fs';
import * as path from 'path';

/**
 * docs/nebim.v3.agent.md §8 — Agent Oturum ve Lisans Yöneticisi (SessionPool).
 *
 * Kurallar:
 * - K14 / S5: maxSessions varsayılan 1'dir. Tavan dolduğunda kuyrukta bekler.
 * - K15 / S3: Aynı SessionKey için bırakılmamış oturum varken yeni oturum açılmaz.
 * - K16: SessionKey = <integrationId>:<databaseName>:<periodNo|- >:<officeCode>
 * - S1: SessionID açılır açılmaz yerel dayanıklı depoya yazılır (işten önce).
 * - S2: Açılışta yetim kayıtlar için Disconnect denenir; hata alsa da silinmez, session_leaked bildirilir.
 * - S4: Oturum bırakma finally içindedir.
 * - S6: maxSessions = 0 iken işler kuyrukta bekler, ağa çıkmaz.
 * - S7: Disconnect doğrulanana kadar (disconnectSupported=false) tek oturum canlı tutulur, kapatılmaz.
 * - GÜVENLİK: SessionID hiçbir log veya hata mesajında yer almaz.
 */

export interface SessionLease {
  leaseId: string;
  sessionKey: string;
  sessionId: string;
  acquiredAt: number;
}

export interface PersistedSession {
  sessionKey: string;
  sessionId: string;
  createdAt: string;
  lastUsedAt: string;
  status: 'ACTIVE' | 'LEAKED';
}

export type ConnectFn = (sessionKey: string) => Promise<string>;
export type DisconnectFn = (sessionKey: string, sessionId: string) => Promise<void>;
export type ProblemReporter = (problem: { code: 'session_leaked' | 'erp_session_limit'; sessionKey: string; details?: string }) => void;

export interface SessionPoolOptions {
  storageFile: string;
  connect: ConnectFn;
  disconnect: DisconnectFn;
  reportProblem?: ProblemReporter;
  idleTimeoutMs?: number;
  disconnectSupported?: boolean;
  now?: () => number;
  log?: (msg: string) => void;
}

interface QueuedRequest {
  sessionKey: string;
  maxSessions: number;
  resolve: (lease: SessionLease) => void;
  reject: (err: Error) => void;
  timeoutTimer: NodeJS.Timeout;
}

interface PoolEntry {
  sessionId: string;
  lastUsedAt: number;
}

export class SessionPool {
  private readonly storageFile: string;
  private readonly connectFn: ConnectFn;
  private readonly disconnectFn: DisconnectFn;
  private readonly reportProblem: ProblemReporter;
  private readonly idleTimeoutMs: number;
  private readonly disconnectSupported: boolean;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;

  // Key: sessionKey -> Boşta olan oturumlar
  private readonly idleSessions = new Map<string, PoolEntry[]>();
  // Key: sessionKey -> Kullanımda olan oturum sayısı
  private readonly inUseCounts = new Map<string, number>();
  // Key: leaseId -> SessionLease
  private readonly activeLeases = new Map<string, SessionLease>();
  // Key: sessionKey -> Bekleyen istekler kuyruğu
  private readonly waitQueue = new Map<string, QueuedRequest[]>();

  constructor(opts: SessionPoolOptions) {
    this.storageFile = opts.storageFile;
    this.connectFn = opts.connect;
    this.disconnectFn = opts.disconnect;
    this.reportProblem = opts.reportProblem ?? (() => undefined);
    this.idleTimeoutMs = opts.idleTimeoutMs ?? 10 * 60 * 1000;
    this.disconnectSupported = opts.disconnectSupported ?? false;
    this.now = opts.now ?? (() => Date.now());
    this.log = opts.log ?? (() => undefined);
  }

  // --- Yerel Depo (S1, S2) ---

  private readStorage(): Record<string, PersistedSession> {
    try {
      if (!fs.existsSync(this.storageFile)) return {};
      const raw = fs.readFileSync(this.storageFile, 'utf8');
      return JSON.parse(raw) as Record<string, PersistedSession>;
    } catch {
      return {};
    }
  }

  private writeStorage(data: Record<string, PersistedSession>): void {
    const dir = path.dirname(this.storageFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
  }

  private persistSession(sessionKey: string, sessionId: string): void {
    const data = this.readStorage();
    data[sessionKey] = {
      sessionKey,
      sessionId,
      createdAt: new Date(this.now()).toISOString(),
      lastUsedAt: new Date(this.now()).toISOString(),
      status: 'ACTIVE',
    };
    this.writeStorage(data);
  }

  private removePersistedSession(sessionKey: string): void {
    const data = this.readStorage();
    delete data[sessionKey];
    this.writeStorage(data);
  }

  private markPersistedLeaked(sessionKey: string): void {
    const data = this.readStorage();
    if (data[sessionKey]) {
      data[sessionKey].status = 'LEAKED';
      data[sessionKey].lastUsedAt = new Date(this.now()).toISOString();
      this.writeStorage(data);
    }
  }

  /**
   * S2: Agent açılışında yetim oturumlar taranır ve Disconnect denenir.
   * Başarısız olursa kayıt silinmez, session_leaked bildirilir.
   */
  async recoverOrphans(): Promise<{ recovered: number; leaked: number }> {
    const data = this.readStorage();
    let recovered = 0;
    let leaked = 0;

    for (const [sessionKey, entry] of Object.entries(data)) {
      if (!this.disconnectSupported) {
        // S7: Disconnect doğrulanana kadar oturum kapatılmaz, havuza alınır
        const idleList = this.idleSessions.get(sessionKey) ?? [];
        idleList.push({ sessionId: entry.sessionId, lastUsedAt: this.now() });
        this.idleSessions.set(sessionKey, idleList);
        recovered++;
        continue;
      }

      try {
        await this.disconnectFn(sessionKey, entry.sessionId);
        this.removePersistedSession(sessionKey);
        recovered++;
      } catch {
        this.markPersistedLeaked(sessionKey);
        this.reportProblem({
          code: 'session_leaked',
          sessionKey,
          details: 'Orphan session disconnect failed on startup',
        });
        leaked++;
      }
    }

    return { recovered, leaked };
  }

  // --- Oturum Edinme / Bırakma (S1, S3, S4, S5, S6) ---

  /**
   * S4 güvencesi sağlayan yardımcı sarmalayıcı.
   */
  async withLease<T>(
    sessionKey: string,
    maxSessions: number,
    fn: (lease: SessionLease) => Promise<T>,
    timeoutMs = 30000,
  ): Promise<T> {
    const lease = await this.acquire(sessionKey, maxSessions, timeoutMs);
    try {
      return await fn(lease);
    } finally {
      this.release(lease);
    }
  }

  async acquire(sessionKey: string, maxSessions: number, timeoutMs = 30000): Promise<SessionLease> {
    // S6: maxSessions <= 0 veya tavan dolu ise kuyrukta bekle
    const inUse = this.inUseCounts.get(sessionKey) ?? 0;
    const idleList = this.idleSessions.get(sessionKey) ?? [];

    // 1. Boşta oturum varsa doğrudan kullan
    if (idleList.length > 0 && maxSessions > 0) {
      const entry = idleList.pop()!;
      this.inUseCounts.set(sessionKey, inUse + 1);
      const lease: SessionLease = {
        leaseId: `lease-${Math.random().toString(36).slice(2)}`,
        sessionKey,
        sessionId: entry.sessionId,
        acquiredAt: this.now(),
      };
      this.activeLeases.set(lease.leaseId, lease);
      return lease;
    }

    // 2. Boşta oturum yok, yeni açılabilir mi? (toplam < maxSessions ve maxSessions > 0)
    const totalExisting = inUse + idleList.length;
    if (maxSessions > 0 && totalExisting < maxSessions) {
      this.inUseCounts.set(sessionKey, inUse + 1);
      try {
        const sessionId = await this.connectFn(sessionKey);
        // S1: Connect döner dönmez dayanıklı depoya yaz
        this.persistSession(sessionKey, sessionId);

        const lease: SessionLease = {
          leaseId: `lease-${Math.random().toString(36).slice(2)}`,
          sessionKey,
          sessionId,
          acquiredAt: this.now(),
        };
        this.activeLeases.set(lease.leaseId, lease);
        return lease;
      } catch (err) {
        this.inUseCounts.set(sessionKey, (this.inUseCounts.get(sessionKey) ?? 1) - 1);
        throw err;
      }
    }

    // 3. Tavan dolu (S5) veya maxSessions <= 0 (S6) -> kuyruğa al
    return new Promise<SessionLease>((resolve, reject) => {
      const timer = setTimeout(() => {
        const queue = this.waitQueue.get(sessionKey) ?? [];
        const idx = queue.findIndex((q) => q.resolve === resolve);
        if (idx >= 0) queue.splice(idx, 1);
        this.reportProblem({
          code: 'erp_session_limit',
          sessionKey,
          details: `Session wait timeout (${timeoutMs}ms) reached for maxSessions=${maxSessions}`,
        });
        reject(new Error(`Oturum limiti aşıldı (session limit reached for key: ${sessionKey})`));
      }, timeoutMs);

      const queue = this.waitQueue.get(sessionKey) ?? [];
      queue.push({
        sessionKey,
        maxSessions,
        resolve,
        reject,
        timeoutTimer: timer,
      });
      this.waitQueue.set(sessionKey, queue);
    });
  }

  release(lease: SessionLease): void {
    if (!this.activeLeases.has(lease.leaseId)) return;
    this.activeLeases.delete(lease.leaseId);

    const inUse = (this.inUseCounts.get(lease.sessionKey) ?? 1) - 1;
    this.inUseCounts.set(lease.sessionKey, Math.max(0, inUse));

    const idleList = this.idleSessions.get(lease.sessionKey) ?? [];
    idleList.push({
      sessionId: lease.sessionId,
      lastUsedAt: this.now(),
    });
    this.idleSessions.set(lease.sessionKey, idleList);

    // Kuyrukta bekleyen varsa uyandır
    this.drainQueue(lease.sessionKey);
  }

  private drainQueue(sessionKey: string): void {
    const queue = this.waitQueue.get(sessionKey);
    if (!queue || queue.length === 0) return;

    const idleList = this.idleSessions.get(sessionKey) ?? [];
    if (idleList.length === 0) return;

    const next = queue.shift()!;
    clearTimeout(next.timeoutTimer);

    const entry = idleList.pop()!;
    const inUse = (this.inUseCounts.get(sessionKey) ?? 0) + 1;
    this.inUseCounts.set(sessionKey, inUse);

    const lease: SessionLease = {
      leaseId: `lease-${Math.random().toString(36).slice(2)}`,
      sessionKey,
      sessionId: entry.sessionId,
      acquiredAt: this.now(),
    };
    this.activeLeases.set(lease.leaseId, lease);
    next.resolve(lease);
  }

  /**
   * Boşta süresi dolan veya SESSION_RELEASE ile istenen oturumu kapatır.
   */
  async evict(sessionKey: string): Promise<void> {
    if (!this.disconnectSupported) {
      // S7: Disconnect desteklenmiyorsa/doğrulanmadıysa tek oturum canlı tutulur, kapatılmaz
      this.log(`[session-pool] S7 gereği oturum kapatılmadı: ${sessionKey}`);
      return;
    }

    const idleList = this.idleSessions.get(sessionKey) ?? [];
    while (idleList.length > 0) {
      const entry = idleList.pop()!;
      try {
        await this.disconnectFn(sessionKey, entry.sessionId);
        this.removePersistedSession(sessionKey);
      } catch {
        // S2: Başarısız olsa bile silinmez, session_leaked bildirilir
        this.markPersistedLeaked(sessionKey);
        this.reportProblem({
          code: 'session_leaked',
          sessionKey,
          details: 'Failed to evict idle session',
        });
      }
    }
  }

  getStats(sessionKey: string): { inUse: number; idle: number; queued: number } {
    return {
      inUse: this.inUseCounts.get(sessionKey) ?? 0,
      idle: (this.idleSessions.get(sessionKey) ?? []).length,
      queued: (this.waitQueue.get(sessionKey) ?? []).length,
    };
  }
}
