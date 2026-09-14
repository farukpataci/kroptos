import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Agent } from '../src/agent';
import { defaultConfig } from '../src/config';
import { MemoryProtector, Vault } from '../src/vault';
import { IdempotencyStore } from '../src/idempotency-store';
import { JobRunner } from '../src/job-runner';
import { loadCatalog, CatalogLoadError } from '../src/catalog';
import { MikroExecutor } from '../src/mikro/executor';
import { deriveSifre, formatLocalDate } from '../src/mikro/sifre';
import { generateAgentKeyPair, seal, open, fingerprintOf } from '../src/credential-envelope';
import { Tunnel, SocketLike } from '../src/tunnel';
import { AgentJob, PROTOCOL_VERSION } from '../src/protocol';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kroptos-agent-'));
const catalogDir = path.join(__dirname, '..', 'catalog', 'mikro');

const job = (over: Partial<AgentJob> = {}): AgentJob => ({
  jobId: over.jobId ?? `j-${Math.random().toString(36).slice(2)}`,
  protocolVersion: PROTOCOL_VERSION,
  agentId: 'a1',
  integrationId: 'int1',
  companyKey: { companyNo: '1', periodNo: '2026' },
  type: 'INVOICE_PUSH',
  payload: { method: 'FaturaKaydet', path: '/Api/APIMethods/FaturaKaydetV2', body: { cha_evrakno_seri: 'MYT' } },
  idempotencyKey: 'KRP-ORDER-1',
  attempt: 1,
  issuedAt: new Date().toISOString(),
  ttlSec: 3600,
  jobTimeoutSec: 5,
  ...over,
});

const okFetch = (status = 200, body: any = { cha_evrakno_seri: 'MYT', cha_evrakno_sira: 39 }) =>
  jest.fn(async (_url: string, _init: any) => ({ status, headers: { get: () => null as string | null }, text: async () => JSON.stringify(body) }));
const sentBody = (fetchFn: jest.Mock, i = 0) => JSON.parse((fetchFn.mock.calls[i] as any)[1].body);

const executor = (fetchFn: any, now?: () => Date, catalog = loadCatalog(catalogDir)) =>
  new MikroExecutor({ baseUrl: 'http://localhost', port: 8094, sifreFormat: '{date} {password}', clockSkewLimitSec: 300, agentVersion: 't', catalog, fetch: fetchFn, now });

const creds = { apiKey: 'K', kullaniciKodu: 'U', password: 'P' };

describe('A1 — aynı idempotencyKey ile ikinci iş → ERP\'ye çağrı YOK, fromCache:true', () => {
  it('runner kasadan döner', async () => {
    const dir = tmp();
    const fetchFn = okFetch();
    const ex = executor(fetchFn);
    const store = new IdempotencyStore(path.join(dir, 'idem.json'), 7 * 86400e3);
    const runner = new JobRunner({ executor: (j) => ex.execute(j, creds), store, agentVersion: 't', readConcurrency: 2 }, () => undefined);
    const first = await runner.executeOnce(job({ jobId: 'j1' }));
    const second = await runner.executeOnce(job({ jobId: 'j2' }));
    expect(first.status).toBe('OK');
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.data).toEqual(first.data);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // kasa diskte kalıcı — yeniden yükleme sonrası da tekrar korunur
    const store2 = new IdempotencyStore(path.join(dir, 'idem.json'), 7 * 86400e3);
    store2.load();
    expect(store2.get('KRP-ORDER-1')?.jobId).toBe('j1');
  });

  it('7 gün TTL: süresi dolan kayıt tekrar korumaz', () => {
    let t = Date.now();
    const store = new IdempotencyStore(path.join(tmp(), 'idem.json'), 7 * 86400e3, () => t);
    store.put('k', { jobId: 'j', status: 'OK', completedAt: new Date(t).toISOString() });
    t += 6 * 86400e3;
    expect(store.get('k')).toBeDefined();
    t += 2 * 86400e3;
    expect(store.get('k')).toBeUndefined();
  });

  it('zaman aşımı sonucu (sonuç bilinmiyor) kasaya YAZILMAZ', async () => {
    const fetchFn = jest.fn((_u: string, init: any) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))));
    const store = new IdempotencyStore(path.join(tmp(), 'idem.json'), 7 * 86400e3);
    const runner = new JobRunner({ executor: (j) => executor(fetchFn).execute(j, creds), store, agentVersion: 't', readConcurrency: 2 }, () => undefined);
    const r = await runner.executeOnce(job({ jobTimeoutSec: 0.05 }));
    expect(r.status).toBe('FAILED');
    expect(r.errorCode).toBe('erp_timeout');
    expect(store.size).toBe(0);
  });
});

describe('A2 — küme dışı type reddediliyor, çalıştırılmıyor, loglanıyor', () => {
  it('REJECTED + log satırı; executor çağrılmaz', async () => {
    const logs: string[] = [];
    const exec = jest.fn();
    const runner = new JobRunner({ executor: exec, store: new IdempotencyStore(path.join(tmp(), 'i.json'), 1e9), agentVersion: 't', readConcurrency: 2, log: (l) => logs.push(l) }, () => undefined);
    const results: any[] = [];
    const r2 = new JobRunner({ executor: exec, store: new IdempotencyStore(path.join(tmp(), 'i.json'), 1e9), agentVersion: 't', readConcurrency: 2, log: (l) => logs.push(l) }, (r) => results.push(r));
    r2.enqueue(job({ type: 'RUN_SHELL' as any }));
    const direct = await runner.executeOnce(job({ type: 'DROP_TABLE' as any }));
    expect(direct.status).toBe('REJECTED');
    expect(results[0]?.status).toBe('REJECTED');
    expect(exec).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes('küme dışı'))).toBe(true);
  });

  it('ttlSec dolmuş iş EXPIRED — sessizce atılmaz, çalıştırılmaz', async () => {
    const exec = jest.fn();
    const runner = new JobRunner({ executor: exec, store: new IdempotencyStore(path.join(tmp(), 'i.json'), 1e9), agentVersion: 't', readConcurrency: 2 }, () => undefined);
    const r = await runner.executeOnce(job({ issuedAt: new Date(Date.now() - 7200e3).toISOString(), ttlSec: 3600 }));
    expect(r.status).toBe('EXPIRED');
    expect(exec).not.toHaveBeenCalled();
  });

  it('çevrimdışı kuyruk: STOCK_SNAPSHOT coalesce olur, yazma işleri sırayı korur', () => {
    const results: any[] = [];
    const never = () => new Promise<any>(() => undefined);
    const runner = new JobRunner({ executor: never, store: new IdempotencyStore(path.join(tmp(), 'i.json'), 1e9), agentVersion: 't', readConcurrency: 0 }, (r) => results.push(r));
    runner.enqueue(job({ jobId: 's1', type: 'STOCK_SNAPSHOT', idempotencyKey: null, notBefore: new Date(Date.now() + 1e7).toISOString() }));
    runner.enqueue(job({ jobId: 'w1', notBefore: new Date(Date.now() + 1e7).toISOString(), idempotencyKey: 'A' }));
    runner.enqueue(job({ jobId: 's2', type: 'STOCK_SNAPSHOT', idempotencyKey: null, notBefore: new Date(Date.now() + 1e7).toISOString() }));
    runner.enqueue(job({ jobId: 'w2', notBefore: new Date(Date.now() + 1e7).toISOString(), idempotencyKey: 'B' }));
    expect(runner.pending.map((j) => j.jobId)).toEqual(['w1', 's2', 'w2']);
    expect(results.find((r) => r.jobId === 's1')?.status).toBe('EXPIRED');
  });
});

describe('A3 — REVOKED cevabı → yerel kasa siliniyor, Agent duruyor', () => {
  it('vault dosyası silinir, tünel yeniden bağlanmaz', () => {
    const dir = tmp();
    const config = defaultConfig({ dataDir: dir, catalogDir });
    const vault = new Vault(path.join(dir, 'vault.bin'), new MemoryProtector());
    vault.setIdentity({ agentId: 'a1', agentSecret: 's', privateKeyPem: 'x', publicKeyPem: 'y' });
    vault.setCredentials('int1', creds);
    expect(fs.existsSync(path.join(dir, 'vault.bin'))).toBe(true);

    const sockets: FakeSocket[] = [];
    const agent = new Agent(config, { protector: new MemoryProtector(), fetch: okFetch() as any, connect: () => { const s = new FakeSocket(); sockets.push(s); return s; }, log: () => undefined });
    agent.start();
    sockets[0].onopen?.({});
    sockets[0].receive({ kind: 'hello_ack', protocolVersion: PROTOCOL_VERSION, sessionToken: 't', sessionExpiresAt: '', serverClockIso: '', clockSkewSec: 0 });
    expect(agent.tunnel?.connected).toBe(true);
    sockets[0].receive({ kind: 'revoked', protocolVersion: PROTOCOL_VERSION, reason: 'panel' });
    expect(agent.stoppedByRevoke).toBe(true);
    expect(agent.vault.isEmpty).toBe(true);
    expect(fs.existsSync(path.join(dir, 'vault.bin'))).toBe(false);
    expect(sockets[0].closed).toBe(true);
    expect(sockets.length).toBe(1);
  });
});

describe('A4 — kimlik zarfı iki ardışık istekte İKİ kez türetiliyor (cache yok)', () => {
  it('envelopeDerivations artar; Sifre = MD5(tarih + şifre)', async () => {
    const fetchFn = okFetch();
    const now = new Date('2023-03-09T10:00:00');
    const ex = executor(fetchFn, () => now);
    await ex.execute(job({ jobId: '1' }), creds);
    await ex.execute(job({ jobId: '2' }), creds);
    expect(ex.envelopeDerivations).toBe(2);
    const sent = sentBody(fetchFn);
    expect(sent.Mikro).toEqual({ ApiKey: 'K', KullaniciKodu: 'U', Sifre: deriveSifre('P', '{date} {password}', now), FirmaKodu: '1', CalismaYili: '2026' });
    expect(sent.Mikro.Sifre).toHaveLength(32);
    expect(sent).not.toHaveProperty('password');
    expect(sent.cha_evrakno_seri).toBe('MYT');
  });

  it('kimlik hatasında zarf TAM BİR KEZ yeniden türetilir; ikincisinde erp_auth_failed, retry yok', async () => {
    const fetchFn = jest.fn(async () => ({ status: 200, headers: { get: () => null }, text: async () => 'Geçersiz api key' }));
    const ex = executor(fetchFn);
    const r = await ex.execute(job(), creds);
    expect(r.status).toBe('FAILED');
    expect(r.errorCode).toBe('erp_auth_failed');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(ex.envelopeDerivations).toBe(2);
  });
});

describe('A5 — gün sınırı: tarih değişince önceki zarf kullanılmıyor', () => {
  it('23:59:59 ve 00:00:01 farklı Sifre üretir', async () => {
    let now = new Date('2026-09-14T23:59:59');
    const fetchFn = okFetch();
    const ex = executor(fetchFn, () => now);
    await ex.execute(job({ jobId: '1' }), creds);
    now = new Date('2026-09-15T00:00:01');
    await ex.execute(job({ jobId: '2' }), creds);
    const s1 = sentBody(fetchFn, 0).Mikro.Sifre;
    const s2 = sentBody(fetchFn, 1).Mikro.Sifre;
    expect(s1).not.toBe(s2);
    expect(formatLocalDate(now)).toBe('2026-09-15');
  });

  it('saat farkı sınırı aşılınca iş çalıştırılmadan erp_clock_skew (localhost dışı ERP)', async () => {
    const fetchFn = jest.fn(async () => ({ status: 200, headers: { get: () => new Date(Date.now() + 3600e3).toUTCString() }, text: async () => '{}' }));
    const ex = new MikroExecutor({ baseUrl: 'http://10.0.0.9', port: 8094, sifreFormat: '{date} {password}', clockSkewLimitSec: 300, agentVersion: 't', catalog: loadCatalog(catalogDir), fetch: fetchFn });
    const r = await ex.execute(job(), creds);
    expect(r.status).toBe('FAILED');
    expect(r.errorCode).toBe('erp_clock_skew');
    expect(fetchFn).toHaveBeenCalledTimes(1); // yalnızca Date başlığı okuması; iş POST'u yok
  });
});

describe('A6 — katalog dosyasında SELECT dışı ifade → Agent BAŞLAMIYOR', () => {
  it('loadCatalog fırlatır; Agent kurucusu da fırlatır', () => {
    const dir = tmp();
    fs.copyFileSync(path.join(catalogDir, 'manifest.json'), path.join(dir, 'manifest.json'));
    fs.writeFileSync(path.join(dir, 'mikro.company_list.sql'), 'SELECT 1 AS company_no; DROP TABLE x');
    expect(() => loadCatalog(dir)).toThrow(CatalogLoadError);
    expect(() => new Agent(defaultConfig({ dataDir: tmp(), catalogDir: dir }), { protector: new MemoryProtector(), fetch: okFetch() as any, log: () => undefined })).toThrow(/reddedildi/);
  });

  it('template (doğrulanmamış) sorgu çağrılırsa catalog_query_unavailable; manifest dışı REJECTED; parametreli sorgu bağlama doğrulanana kadar reddedilir', async () => {
    const fetchFn = okFetch();
    const ex = executor(fetchFn);
    const r1 = await ex.execute(job({ type: 'CATALOG_QUERY', idempotencyKey: null, payload: { queryId: 'mikro.company_list' } }), creds);
    expect(r1.status).toBe('FAILED');
    expect(r1.errorCode).toBe('catalog_query_unavailable');
    const r2 = await ex.execute(job({ type: 'CATALOG_QUERY', idempotencyKey: null, payload: { queryId: 'mikro.nope' } }), creds);
    expect(r2.status).toBe('REJECTED');
    // doğrulanmış (gerçek) SQL'i olan ama parametreli sorgu: string birleştirme yapılmaz → reddedilir
    const dir = tmp();
    fs.copyFileSync(path.join(catalogDir, 'manifest.json'), path.join(dir, 'manifest.json'));
    fs.writeFileSync(path.join(dir, 'mikro.invoice_by_ref.sql'), 'SELECT a AS external_ref, b AS document_id, c AS document_no FROM t WHERE a = @ref');
    const r3 = await executor(fetchFn, undefined, loadCatalog(dir)).execute(job({ type: 'CATALOG_QUERY', idempotencyKey: null, payload: { queryId: 'mikro.invoice_by_ref', params: { ref: 'KRP-ORDER-1' } } }), creds);
    expect(r3.errorCode).toBe('catalog_binding_unverified');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('A7 — credential çözüldükten sonra hiçbir log satırında görünmüyor', () => {
  it('zarf açılır, kasaya yazılır, log kimlik içermez; parmak izi uyuşmazsa reddedilir', () => {
    const logs: string[] = [];
    const dir = tmp();
    const keys = generateAgentKeyPair();
    const vault = new Vault(path.join(dir, 'vault.bin'), new MemoryProtector());
    vault.setIdentity({ agentId: 'a1', agentSecret: 's', ...keys });
    const agent = new Agent(defaultConfig({ dataDir: dir, catalogDir }), { protector: new MemoryProtector(), fetch: okFetch() as any, log: (l) => logs.push(l) });
    const secret = { apiKey: 'API-SECRET-XYZ', kullaniciKodu: 'USER-1', password: 'Pa55-w0rd' };
    const blob = seal(keys.publicKeyPem, secret);
    expect(open(keys.privateKeyPem, blob)).toEqual(secret);
    agent.onEnvelope('env1', 'int1', blob, fingerprintOf(blob));
    expect(agent.vault.getCredentials('int1')).toEqual(secret);
    const all = logs.join('\n');
    for (const v of Object.values(secret)) expect(all).not.toContain(v);
    expect(all).not.toContain(blob);
    agent.onEnvelope('env2', 'int1', blob, 'deadbeef');
    expect(logs.some((l) => l.includes('reddedildi'))).toBe(true);
  });
});

describe('Tünel — kalp atışı, protokol sürümü, geri çekilme', () => {
  it('hello HMAC imzalı; N+1 protokol mesajı yok sayılır; backoff üst sınırı reconnectMaxSec', () => {
    const t = new Tunnel({ serverUrl: 'wss://x', agentId: 'a1', agentSecret: 'sec', agentVersion: 't', osVersion: 'w', heartbeatSec: 30, deadAfterSec: 90, reconnectMaxSec: 60, counters: () => ({ queued: 0, running: 0, ok: 0, failed: 0 }) }, { onJob: jest.fn(), onCredentialEnvelope: jest.fn(), onRevoked: jest.fn() });
    const hello = t.buildHello();
    expect(hello.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(hello.auth.signature).toHaveLength(64);
    const onJob = jest.fn();
    const t2 = new Tunnel({ serverUrl: 'wss://x', agentId: 'a1', agentSecret: 'sec', agentVersion: 't', osVersion: 'w', heartbeatSec: 30, deadAfterSec: 90, reconnectMaxSec: 60, counters: () => ({ queued: 0, running: 0, ok: 0, failed: 0 }) }, { onJob, onCredentialEnvelope: jest.fn(), onRevoked: jest.fn() });
    t2.handle(JSON.stringify({ kind: 'job', protocolVersion: PROTOCOL_VERSION + 1, job: job() }));
    expect(onJob).not.toHaveBeenCalled();
    t2.handle(JSON.stringify({ kind: 'job', protocolVersion: PROTOCOL_VERSION, job: job() }));
    expect(onJob).toHaveBeenCalledTimes(1);
    expect(t.backoffMs(0, 1)).toBe(1000);
    expect(t.backoffMs(20, 1)).toBe(60000);
    expect(t.backoffMs(20, 0)).toBe(30000);
  });
});

class FakeSocket implements SocketLike {
  sent: string[] = [];
  closed = false;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  receive(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}
