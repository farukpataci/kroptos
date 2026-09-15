import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionPool, ProblemReporter } from '../src/nebim/session-pool';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nebim-session-')), 'sessions.json');

describe('GÖREV N3 — Nebim V3 Agent SessionPool (S1–S7, K14–K16)', () => {
  const sessionKey = 'int-nebim-1:V3_TEST:-:OFFICE1';

  it('S1 & S3 & S5: Tavan 1 iken iki eşzamanlı istek -> tek Connect, ikinci istek kuyrukta bekler', async () => {
    const storageFile = tmpFile();
    let connectCalls = 0;
    const connect = jest.fn(async () => {
      connectCalls++;
      return 'SECRET_SESSION_ID_1';
    });
    const disconnect = jest.fn(async () => undefined);

    const pool = new SessionPool({
      storageFile,
      connect,
      disconnect,
    });

    // 1. Birinci oturum edinilir
    const lease1 = await pool.acquire(sessionKey, 1);
    expect(connectCalls).toBe(1);

    // S1 kontrolü: Connect döner dönmez yerel depoda olmalı
    const savedData = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    expect(savedData[sessionKey]).toBeDefined();
    expect(savedData[sessionKey].sessionId).toBe('SECRET_SESSION_ID_1');

    // 2. İkinci oturum talebi (tavan 1 iken) kuyruğa düşer, yeni Connect çağrılmaz (S3, S5)
    let lease2Resolved = false;
    const lease2Promise = pool.acquire(sessionKey, 1, 1000).then((l) => {
      lease2Resolved = true;
      return l;
    });

    // Küçük bir bekleme; ikinci istek beklemeli ve henüz resolve olmamalı
    await new Promise((r) => setTimeout(r, 50));
    expect(lease2Resolved).toBe(false);
    expect(connectCalls).toBe(1);

    // 3. Birinci oturum bırakılınca (release) ikinci istek uyanmalı ve AYNI oturumu devralmalı
    pool.release(lease1);
    const lease2 = await lease2Promise;
    expect(lease2Resolved).toBe(true);
    expect(connectCalls).toBe(1); // Hala tek connect! İkinci connect çağrılmadı (S3)
    expect(lease2.sessionId).toBe('SECRET_SESSION_ID_1');

    pool.release(lease2);
  });

  it('S4: withLease ile oturum finally içinde bırakılır, iş hata fırlatsa bile havuz boşa çıkar', async () => {
    const storageFile = tmpFile();
    const pool = new SessionPool({
      storageFile,
      connect: async () => 'SESSION_ERR_TEST',
      disconnect: async () => undefined,
    });

    // Hata fırlatan bir işlem çalıştır
    await expect(
      pool.withLease(sessionKey, 1, async () => {
        throw new Error('İş sırasında beklenmedik hata');
      }),
    ).rejects.toThrow('İş sırasında beklenmedik hata');

    // Havuz kontrolü: inUse 0 olmalı, boşta 1 oturum olmalı
    const stats = pool.getStats(sessionKey);
    expect(stats.inUse).toBe(0);
    expect(stats.idle).toBe(1);

    // Yeni bir işlem havuzu bloke olmadan hemen kullanabilmeli
    const result = await pool.withLease(sessionKey, 1, async (lease) => {
      return `ok-${lease.sessionId}`;
    });
    expect(result).toBe('ok-SESSION_ERR_TEST');
  });

  it('S2: Agent çökme simülasyonu -> açılışta recoverOrphans ile yetim oturum için Disconnect denenir', async () => {
    const storageFile = tmpFile();
    // Çökmeden kalmış bir yetim kayıt oluştur
    fs.mkdirSync(path.dirname(storageFile), { recursive: true });
    fs.writeFileSync(
      storageFile,
      JSON.stringify({
        [sessionKey]: {
          sessionKey,
          sessionId: 'ORPHAN_SESSION_123',
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          status: 'ACTIVE',
        },
      }),
    );

    const disconnectedSessions: string[] = [];
    const pool = new SessionPool({
      storageFile,
      disconnectSupported: true,
      connect: async () => 'NEW_SESSION',
      disconnect: async (_key, sid) => {
        disconnectedSessions.push(sid);
      },
    });

    const { recovered, leaked } = await pool.recoverOrphans();
    expect(recovered).toBe(1);
    expect(leaked).toBe(0);
    expect(disconnectedSessions).toContain('ORPHAN_SESSION_123');

    // Depodan silinmiş olmalı
    const remaining = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    expect(remaining[sessionKey]).toBeUndefined();
  });

  it('S2: Disconnect başarısız -> yerel kayıt silinmez, session_leaked problem bildirilir', async () => {
    const storageFile = tmpFile();
    fs.mkdirSync(path.dirname(storageFile), { recursive: true });
    fs.writeFileSync(
      storageFile,
      JSON.stringify({
        [sessionKey]: {
          sessionKey,
          sessionId: 'ORPHAN_LEAKED_SESSION',
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          status: 'ACTIVE',
        },
      }),
    );

    const problems: any[] = [];
    const reporter: ProblemReporter = (p) => problems.push(p);

    const pool = new SessionPool({
      storageFile,
      disconnectSupported: true,
      connect: async () => 'NEW_SESSION',
      disconnect: async () => {
        throw new Error('ERP ağ bağlantısı koptu / 500 error');
      },
      reportProblem: reporter,
    });

    const { recovered, leaked } = await pool.recoverOrphans();
    expect(recovered).toBe(0);
    expect(leaked).toBe(1);

    // S2 gereği: kayıt SİLİNMEZ, LEAKED olarak işaretlenir
    const remaining = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    expect(remaining[sessionKey]).toBeDefined();
    expect(remaining[sessionKey].status).toBe('LEAKED');

    // Problem kaydı açılmış olmalı
    expect(problems.length).toBe(1);
    expect(problems[0].code).toBe('session_leaked');
    expect(problems[0].sessionKey).toBe(sessionKey);
  });

  it('S6: Tavan 0 iken hiçbir iş ağa çıkmaz, kuyrukta bekler ve zaman aşımında erp_session_limit fırlatır', async () => {
    const storageFile = tmpFile();
    const connect = jest.fn(async () => 'SHOULD_NOT_CONNECT');
    const problems: any[] = [];

    const pool = new SessionPool({
      storageFile,
      connect,
      disconnect: async () => undefined,
      reportProblem: (p) => problems.push(p),
    });

    // maxSessions = 0 iken acquire çağrısı kuyrukta bekler ve timeout süresinde patlar
    await expect(pool.acquire(sessionKey, 0, 100)).rejects.toThrow('Oturum limiti aşıldı');
    expect(connect).not.toHaveBeenCalled();

    // erp_session_limit problemi bildirilmiş olmalı
    expect(problems.some((p) => p.code === 'erp_session_limit')).toBe(true);
  });

  it('S7: Disconnect desteklenmiyorsa (disconnectSupported:false) evict oturumu kapatmaz, tek lisansı canlı tutar', async () => {
    const storageFile = tmpFile();
    const disconnect = jest.fn(async () => undefined);

    const pool = new SessionPool({
      storageFile,
      disconnectSupported: false, // S7 durumu: DOCUMENTATION_REQUIRED
      connect: async () => 'SESSION_PERMANENT',
      disconnect,
    });

    const lease = await pool.acquire(sessionKey, 1);
    pool.release(lease);

    // Evict çağrısı yapılıyor
    await pool.evict(sessionKey);

    // S7 gereği disconnect çağrılmamalı, oturum boşa gitmemeli
    expect(disconnect).not.toHaveBeenCalled();
    const stats = pool.getStats(sessionKey);
    expect(stats.idle).toBe(1);
  });
});
