import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { AgentService } from './agent.service';
import { AgentJobService } from './agent-job.service';
import { verifyHelloSignature } from './agent-gateway.service';
import { decrypt } from '../../common/utils/encryption.util';
import { PROTOCOL_VERSION } from '../../integrations/accounting/core/agent/AgentProtocol';
import { AccountingNetworkError } from '../../integrations/accounting/core/AccountingErrors';
import '../../integrations/accounting/mikro';
import '../../integrations/accounting/parasut';

const PUB = '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function prismaMock() {
  const state: any = { codes: [] as any[], agents: [] as any[], envelopes: [] as any[], problems: [] as any[], jobs: [] as any[], integrations: [] as any[] };
  const prisma: any = {
    agentEnrollmentCode: {
      create: jest.fn(async ({ data }: any) => { const row = { id: `code-${state.codes.length + 1}`, usedAt: null, ...data }; state.codes.push(row); return row; }),
      findUnique: jest.fn(async ({ where }: any) => state.codes.find((c: any) => c.codeHash === where.codeHash) ?? null),
      update: jest.fn(async ({ where, data }: any) => { const c = state.codes.find((x: any) => x.id === where.id); Object.assign(c, data); return c; }),
    },
    agentInstance: {
      upsert: jest.fn(async ({ where, create }: any) => {
        let a = state.agents.find((x: any) => x.agencyId === where.agencyId_name.agencyId && x.name === where.agencyId_name.name);
        if (!a) { a = { id: `agent-${state.agents.length + 1}`, ...create }; state.agents.push(a); } else Object.assign(a, create);
        return a;
      }),
      findUnique: jest.fn(async ({ where }: any) => state.agents.find((a: any) => a.id === where.id) ?? null),
      findFirst: jest.fn(async ({ where }: any) => state.agents.find((a: any) => a.id === where.id && a.agencyId === where.agencyId) ?? null),
      findMany: jest.fn(async ({ where }: any) => state.agents.filter((a: any) => a.agencyId === where.agencyId)),
      update: jest.fn(async ({ where, data }: any) => { const a = state.agents.find((x: any) => x.id === where.id); Object.assign(a, data); return a; }),
    },
    accountingIntegration: {
      findFirst: jest.fn(async ({ where }: any) => state.integrations.find((i: any) => i.id === where.id && i.agencyId === where.agencyId) ?? null),
      findUnique: jest.fn(async ({ where }: any) => state.integrations.find((i: any) => i.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => { const i = state.integrations.find((x: any) => x.id === where.id); Object.assign(i, data); return i; }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    agentCredentialEnvelope: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async ({ data }: any) => { const e = { id: `env-${state.envelopes.length + 1}`, ...data }; state.envelopes.push(e); return e; }),
      findUnique: jest.fn(async ({ where }: any) => state.envelopes.find((e: any) => e.id === where.id) ?? null),
      delete: jest.fn(async ({ where }: any) => { state.envelopes = state.envelopes.filter((e: any) => e.id !== where.id); }),
      findMany: jest.fn(async () => state.envelopes),
    },
    accountingProblem: {
      findFirst: jest.fn(async ({ where }: any) => state.problems.find((p: any) => p.agencyId === where.agencyId && p.integrationId === where.integrationId && p.code === where.code && p.companyKey === where.companyKey) ?? null),
      create: jest.fn(async ({ data }: any) => { const p = { id: `p-${state.problems.length + 1}`, occurrences: 1, ...data }; state.problems.push(p); return p; }),
      update: jest.fn(async ({ where, data }: any) => { const p = state.problems.find((x: any) => x.id === where.id); p.occurrences += data.occurrences?.increment ?? 0; Object.assign(p, { resolvedAt: data.resolvedAt ?? p.resolvedAt }); return p; }),
    },
    agentJob: {
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }: any) => { state.jobs.push(data); return data; }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { prisma, state };
}

describe('AgentService — kayıt (§9.3)', () => {
  it('kod yalnızca cevapta görünür, sunucuda hash; kullanılmış/dolmuş kod reddedilir; sır şifreli saklanır', async () => {
    const { prisma, state } = prismaMock();
    const svc = new AgentService(prisma);
    const { code } = await svc.createEnrollmentCode({ agencyId: 'ag1' }, {}, { id: 'u1' });
    expect(state.codes[0].codeHash).toBe(sha(code));
    expect(JSON.stringify(state.codes[0])).not.toContain(code);

    const r = await svc.enroll({ code, name: 'SRV01', publicKey: PUB, agentVersion: '0.1.0', osVersion: 'win32', protocolVersion: PROTOCOL_VERSION });
    expect(r.agentId).toBe('agent-1');
    expect(r.agentSecret).toHaveLength(64);
    expect(state.agents[0].tunnelSecret).not.toContain(r.agentSecret);
    expect(decrypt(state.agents[0].tunnelSecret)).toBe(r.agentSecret);
    expect(state.codes[0].usedAt).toBeTruthy();

    // ikinci kullanım → 403 (nötr)
    await expect(svc.enroll({ code, name: 'SRV02', publicKey: PUB, agentVersion: '0.1.0', osVersion: 'w', protocolVersion: PROTOCOL_VERSION })).rejects.toThrow(ForbiddenException);
    // süresi dolmuş
    const { code: c2 } = await svc.createEnrollmentCode({ agencyId: 'ag1' }, {}, { id: 'u1' });
    state.codes[1].expiresAt = new Date(Date.now() - 1000);
    await expect(svc.enroll({ code: c2, name: 'SRV03', publicKey: PUB, agentVersion: '0.1.0', osVersion: 'w', protocolVersion: PROTOCOL_VERSION })).rejects.toThrow(ForbiddenException);
    // protokol N+1
    await expect(svc.enroll({ code: c2, name: 'S', publicKey: PUB, agentVersion: '0', osVersion: 'w', protocolVersion: PROTOCOL_VERSION + 1 })).rejects.toThrow(BadRequestException);
  });

  it('list/get cevabında tunnelSecret YOK', async () => {
    const { prisma, state } = prismaMock();
    state.agents.push({ id: 'a1', agencyId: 'ag1', name: 'X', status: 'ACTIVE', tunnelSecret: 'enc' });
    const svc = new AgentService(prisma);
    expect((await svc.list({ agencyId: 'ag1' }))[0]).not.toHaveProperty('tunnelSecret');
    expect(await svc.get({ agencyId: 'ag1' }, 'a1')).not.toHaveProperty('tunnelSecret');
    await expect(svc.get({ agencyId: 'OTHER' }, 'a1')).rejects.toThrow(); // tenant izolasyonu
  });
});

describe('verifyHelloSignature', () => {
  const secret = 'abc';
  const mk = (issuedAt: string, sig?: string) => {
    const nonce = 'n1';
    const signature = sig ?? createHmac('sha256', secret).update(`a1|${nonce}|${issuedAt}`).digest('hex');
    return { agentId: 'a1', auth: { nonce, signature, issuedAt } };
  };
  it('doğru imza geçer; yanlış sır, bozuk imza ve 5 dk\'dan eski hello (replay) reddedilir', () => {
    const now = Date.now();
    expect(verifyHelloSignature(secret, mk(new Date(now).toISOString()), now)).toBe(true);
    expect(verifyHelloSignature('other', mk(new Date(now).toISOString()), now)).toBe(false);
    expect(verifyHelloSignature(secret, mk(new Date(now).toISOString(), 'ff'), now)).toBe(false);
    expect(verifyHelloSignature(secret, mk(new Date(now - 6 * 60_000).toISOString()), now)).toBe(false);
  });
});

describe('AgentService — Agent atama ve kimlik zarfı (K5/K9/K2)', () => {
  it('AGENT rotasını desteklemeyen sağlayıcıya Agent atanamaz; Mikro atanır ve route AGENT olur', async () => {
    const { prisma, state } = prismaMock();
    state.agents.push({ id: 'a1', agencyId: 'ag1', name: 'X', status: 'ACTIVE' });
    state.integrations.push({ id: 'i-parasut', agencyId: 'ag1', provider: 'PARASUT', deletedAt: null, route: 'DIRECT', exclusiveAgentId: null });
    state.integrations.push({ id: 'i-mikro', agencyId: 'ag1', provider: 'MIKRO', deletedAt: null, route: 'DIRECT', exclusiveAgentId: null, credentials: 'enc' });
    const svc = new AgentService(prisma);
    await expect(svc.assignToIntegration({ agencyId: 'ag1' }, 'i-parasut', { agentId: 'a1' }, {})).rejects.toThrow(BadRequestException);
    const r = await svc.assignToIntegration({ agencyId: 'ag1' }, 'i-mikro', { agentId: 'a1', transportSecurity: 'PLAINTEXT_LAN' }, {});
    expect(r).toMatchObject({ route: 'AGENT', exclusiveAgentId: 'a1', transportSecurity: 'PLAINTEXT_LAN' });
    expect(r).not.toHaveProperty('credentials');
  });

  it('K9: açık iş varken ikinci Agent devralamaz — agent_failover_blocked', async () => {
    const { prisma, state } = prismaMock();
    state.agents.push({ id: 'a1', agencyId: 'ag1', name: 'X', status: 'ACTIVE' }, { id: 'a2', agencyId: 'ag1', name: 'Y', status: 'ACTIVE' });
    state.integrations.push({ id: 'i-mikro', agencyId: 'ag1', provider: 'MIKRO', deletedAt: null, route: 'AGENT', exclusiveAgentId: 'a1' });
    prisma.agentJob.count.mockResolvedValue(2);
    const svc = new AgentService(prisma);
    await expect(svc.assignToIntegration({ agencyId: 'ag1' }, 'i-mikro', { agentId: 'a2' }, {})).rejects.toThrow(/agent_failover_blocked/);
    expect(state.problems[0]).toMatchObject({ code: 'agent_failover_blocked' });
  });

  it('K2: zarf yalnızca kuyruğa girer, parmak izi doğrulanır, teslimde silinir; kalan iz credentialSetAt/By/Fingerprint', async () => {
    const { prisma, state } = prismaMock();
    state.integrations.push({ id: 'i-mikro', agencyId: 'ag1', provider: 'MIKRO', deletedAt: null, route: 'AGENT', agentId: 'a1', exclusiveAgentId: 'a1' });
    const svc = new AgentService(prisma);
    const blob = Buffer.from('opaque').toString('base64');
    await expect(svc.submitCredentialEnvelope({ agencyId: 'ag1' }, { integrationId: 'i-mikro', blob, fingerprint: 'bad' }, { id: 'u1' })).rejects.toThrow(/Parmak izi/);
    const r = await svc.submitCredentialEnvelope({ agencyId: 'ag1' }, { integrationId: 'i-mikro', blob, fingerprint: sha(blob) }, { id: 'u1', email: 'u@x' });
    expect(state.envelopes).toHaveLength(1);
    expect(state.integrations[0]).toMatchObject({ credentialSetBy: 'u@x', credentialFingerprint: sha(blob) });
    expect(state.integrations[0].credentialSetAt).toBeInstanceOf(Date);
    await svc.envelopeDelivered(r.envelopeId, true);
    expect(state.envelopes).toHaveLength(0);
  });

  it('problem kuyruğu: aynı kod tekrarında sayaç artar, yeni satır açılmaz', async () => {
    const { prisma, state } = prismaMock();
    const svc = new AgentService(prisma);
    await svc.raiseProblem('ag1', 'i1', 'a1', 'agent_offline');
    await svc.raiseProblem('ag1', 'i1', 'a1', 'agent_offline');
    await svc.raiseProblem('ag1', 'i1', 'a1', 'agent_offline');
    expect(state.problems).toHaveLength(1);
    expect(state.problems[0].occurrences).toBe(3);
  });
});

describe('AgentJobService.dispatch — K9 ve kalıcı kuyruk', () => {
  it('iş yalnızca exclusiveAgentId Agent\'ına gider; başkasına REDDEDİLİR ve problem yazılır', async () => {
    const { prisma, state } = prismaMock();
    state.integrations.push({ id: 'i1', agencyId: 'ag1', provider: 'MIKRO', exclusiveAgentId: 'a1', agentId: 'a1' });
    const gateway: any = { isConnected: jest.fn(() => true), dispatch: jest.fn(async () => ({ jobId: 'j1', status: 'OK', data: {}, durationMs: 1, agentVersion: '0', fromCache: false })) };
    const svc = new AgentJobService(prisma, gateway, new AgentService(prisma));
    const job: any = { jobId: 'j1', protocolVersion: PROTOCOL_VERSION, agentId: 'a2', integrationId: 'i1', companyKey: { companyNo: '1' }, type: 'CONNECTION_TEST', payload: {}, idempotencyKey: null, attempt: 1, issuedAt: new Date().toISOString(), ttlSec: 60, jobTimeoutSec: 5 };
    await expect(svc.dispatch(job)).rejects.toThrow(AccountingNetworkError);
    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(state.problems[0]).toMatchObject({ code: 'agent_failover_blocked' });

    const ok = await svc.dispatch({ ...job, agentId: 'a1' });
    expect(ok.status).toBe('OK');
    expect(state.jobs[0]).toMatchObject({ agentId: 'a1', companyKey: 'i1:1:-:-', status: 'queued' });
  });

  it('Agent çevrimdışıysa agent_offline problemi yazılır, cevap gelmezse AccountingNetworkError (→ stuck)', async () => {
    const { prisma, state } = prismaMock();
    state.integrations.push({ id: 'i1', agencyId: 'ag1', provider: 'MIKRO', exclusiveAgentId: 'a1', agentId: 'a1' });
    const gateway: any = { isConnected: jest.fn(() => false), dispatch: jest.fn(async () => { throw new Error('timeout'); }) };
    const svc = new AgentJobService(prisma, gateway, new AgentService(prisma));
    const job: any = { jobId: 'j2', protocolVersion: PROTOCOL_VERSION, agentId: 'a1', integrationId: 'i1', companyKey: { companyNo: '1' }, type: 'INVOICE_PUSH', payload: {}, idempotencyKey: 'KRP-ORDER-1', attempt: 1, issuedAt: new Date().toISOString(), ttlSec: 60, jobTimeoutSec: 1 };
    await expect(svc.dispatch(job)).rejects.toThrow(AccountingNetworkError);
    expect(state.problems.some((p: any) => p.code === 'agent_offline')).toBe(true);
    expect(state.jobs[0].status).toBe('queued'); // Agent bağlanınca yeniden gönderilir
  });
});
