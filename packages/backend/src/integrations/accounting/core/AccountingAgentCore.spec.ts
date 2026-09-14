import { NotImplementedException } from '@nestjs/common';
import { assertCapability, canAutoPushInvoice } from './AccountingCapabilities';
import { buildSessionKey, parseSessionKey, tokenCacheKey, writeLockName } from './AccountingSessionKey';
import { findCredentialLeak, stripNonServerFields, visibleFields } from './AccountingCredentialSchema';
import {
  CapabilityContractRequiredError,
  CatalogQueryRejectedError,
  CatalogSchemaDriftError,
  IntegrationNotVerifiedError,
} from './AccountingErrors';
import { AccountingProviderRegistry } from './AccountingProviderRegistry';
import { AccountingProviderDescriptor, AccountingProviderSchema, CapabilityStatus } from './AccountingTypes';
import {
  AGENT_JOB_TYPES,
  isAgentJobType,
  isProtocolVersionAccepted,
  PROTOCOL_VERSION,
} from './agent/AgentProtocol';
import {
  assertExpectedColumns,
  assertReadOnlySql,
  CatalogManifest,
  resolveQuery,
  validateCatalogParams,
} from './catalog/CatalogManifest';
import { AgentTransport } from './transport/AgentTransport';
import { DirectTransport } from './transport/DirectTransport';

describe('assertCapability (K3 — sahte başarı yok)', () => {
  it.each([
    [CapabilityStatus.NOT_SUPPORTED, NotImplementedException],
    [CapabilityStatus.CONTRACT_REQUIRED, CapabilityContractRequiredError],
    [CapabilityStatus.DOCUMENTATION_REQUIRED, IntegrationNotVerifiedError],
    [CapabilityStatus.UNKNOWN, IntegrationNotVerifiedError],
    [undefined, IntegrationNotVerifiedError],
  ])('%s → fırlatır', (status, err) => {
    expect(() => assertCapability('P', 'invoicePush', status as any, 'MOCK')).toThrow(err as any);
    expect(() => assertCapability('P', 'invoicePush', status as any, 'PRODUCTION')).toThrow(err as any);
  });

  it('MOCK_ONLY yalnızca MOCK ortamında geçer', () => {
    expect(() => assertCapability('P', 'x', CapabilityStatus.MOCK_ONLY, 'MOCK')).not.toThrow();
    expect(() => assertCapability('P', 'x', CapabilityStatus.MOCK_ONLY, 'TEST')).toThrow(IntegrationNotVerifiedError);
  });

  it('SUPPORTED geçer; canAutoPushInvoice (K11) yalnızca geri okunabilen ERP için true', () => {
    expect(() => assertCapability('P', 'x', CapabilityStatus.SUPPORTED, 'PRODUCTION')).not.toThrow();
    expect(canAutoPushInvoice(CapabilityStatus.SUPPORTED, 'PRODUCTION')).toBe(true);
    expect(canAutoPushInvoice(CapabilityStatus.MOCK_ONLY, 'MOCK')).toBe(true);
    expect(canAutoPushInvoice(CapabilityStatus.MOCK_ONLY, 'PRODUCTION')).toBe(false);
    expect(canAutoPushInvoice(CapabilityStatus.DOCUMENTATION_REQUIRED, 'MOCK')).toBe(false);
  });
});

describe('SessionKey (K4 — firma ekseni)', () => {
  it('iki farklı companyNo aynı token anahtarını paylaşmaz', () => {
    const a = tokenCacheKey('int1', { companyNo: '2', periodNo: '2026' });
    const b = tokenCacheKey('int1', { companyNo: '3', periodNo: '2026' });
    expect(a).not.toBe(b);
    expect(buildSessionKey('int1', { companyNo: '2' })).toBe('int1:2:-:-');
    expect(writeLockName('int1', { companyNo: '2', periodNo: '2026', branchCode: '0' })).toBe('lock:write:int1:2:2026:0');
    expect(parseSessionKey('int1:2:2026:-')).toEqual({ integrationId: 'int1', companyNo: '2', periodNo: '2026', branchCode: null });
    expect(() => buildSessionKey('int1', { companyNo: '' })).toThrow();
  });
});

describe('Credential schema (K1/K2)', () => {
  const schema: AccountingProviderSchema = {
    provider: 'X',
    name: 'X',
    fields: [
      { key: 'baseUrl', label: 'u', type: 'url', required: true, storage: 'SERVER_ENCRYPTED' },
      { key: 'apiKey', label: 'k', type: 'password', required: true, storage: 'AGENT_LOCAL' },
      { key: 'password', label: 'p', type: 'password', required: true, storage: 'AGENT_LOCAL' },
      { key: 'sifre', label: 's', type: 'password', required: false, storage: 'AGENT_LOCAL', derived: { from: ['password'], strategy: 'MIKRO_DATE_MD5' } },
    ],
  };

  it('AGENT_LOCAL ve derived alanlar sunucu kaydından ayıklanır (test 24)', () => {
    expect(stripNonServerFields(schema, { baseUrl: 'http://x', apiKey: 'A', password: 'P', sifre: 'S', rogue: 'R' })).toEqual({ baseUrl: 'http://x' });
  });

  it('AGENT_LOCAL bildirmeyen şema olduğu gibi kalır (eski bulut sağlayıcılar)', () => {
    const cloud: AccountingProviderSchema = { provider: 'C', name: 'C', fields: [{ key: 'apiToken', label: 't', type: 'password', required: true }] };
    expect(stripNonServerFields(cloud, { apiToken: 'T', accessToken: 'A' })).toEqual({ apiToken: 'T', accessToken: 'A' });
  });

  it('derived alanlar formda gösterilmez (test 36)', () => {
    expect(visibleFields(schema).map((f) => f.key)).toEqual(['baseUrl', 'apiKey', 'password']);
  });

  it('kimlik sızıntısı iç içe nesnede de yakalanır, büyük/küçük harf duyarsız (test 32)', () => {
    expect(findCredentialLeak({ a: { b: [{ Sifre: 'x' }] } }, ['sifre'])).toBe('$.a.b[0].Sifre');
    expect(findCredentialLeak({ Mikro: {} }, ['Mikro'])).toBe('$.Mikro');
    expect(findCredentialLeak({ items: [{ code: 'x' }] }, ['Mikro', 'ApiKey'])).toBeNull();
  });
});

describe('AgentProtocol (K6 — kapalı küme)', () => {
  it('14 iş tipi; küme dışı reddedilir', () => {
    expect(AGENT_JOB_TYPES).toHaveLength(14);
    expect(isAgentJobType('INVOICE_PUSH')).toBe(true);
    expect(isAgentJobType('RUN_SQL')).toBe(false);
    expect(isAgentJobType('SHELL')).toBe(false);
  });

  it('protokol N ve N-1 kabul, N+1 ret', () => {
    expect(isProtocolVersionAccepted(PROTOCOL_VERSION)).toBe(true);
    expect(isProtocolVersionAccepted(PROTOCOL_VERSION + 1)).toBe(false);
  });
});

describe('Catalog (K7)', () => {
  const manifest: CatalogManifest = {
    provider: 'MIKRO',
    version: '1',
    queries: [
      { queryId: 'q.by_ref', params: [{ name: 'ref', type: 'string', required: true, maxLength: 64 }], expectedColumns: ['external_ref', 'document_id'], maxRows: 1, timeoutSec: 10 },
    ],
  };

  it('manifest dışı queryId ve tanımsız parametre reddedilir (test 39)', () => {
    expect(() => resolveQuery(manifest, 'q.nope')).toThrow(CatalogQueryRejectedError);
    const spec = resolveQuery(manifest, 'q.by_ref');
    expect(() => validateCatalogParams(spec, { ref: 'a', extra: 1 })).toThrow(CatalogQueryRejectedError);
    expect(() => validateCatalogParams(spec, {})).toThrow(CatalogQueryRejectedError);
    expect(() => validateCatalogParams(spec, { ref: 'x'.repeat(65) })).toThrow(CatalogQueryRejectedError);
    expect(validateCatalogParams(spec, { ref: 'KRP-ORDER-1' })).toEqual({ ref: 'KRP-ORDER-1' });
  });

  it.each([
    'DELETE FROM t',
    'SELECT 1; DROP TABLE t',
    'SELECT 1 -- x',
    'SELECT 1 /* x */',
    'EXEC sp_who',
    'UPDATE t SET a=1',
    'INSERT INTO t VALUES (1)',
    'SELECT * INTO t2 FROM t',
    'CREATE TABLE t (a int)',
    '',
  ])('SELECT dışı / tehlikeli SQL reddedilir (test 40): %s', (sql) => {
    expect(() => assertReadOnlySql(sql, 'q')).toThrow(CatalogQueryRejectedError);
  });

  it('salt-okunur SELECT/WITH geçer', () => {
    expect(() => assertReadOnlySql('SELECT a AS product_code FROM t WHERE r = @ref')).not.toThrow();
    expect(() => assertReadOnlySql('WITH x AS (SELECT 1 AS a) SELECT a FROM x')).not.toThrow();
  });

  it('beklenen kolon yoksa akış durur, boş sonuçla devam etmez (test 41)', () => {
    const spec = resolveQuery(manifest, 'q.by_ref');
    expect(() => assertExpectedColumns(spec, [{ external_ref: 'x' }])).toThrow(CatalogSchemaDriftError);
    expect(() => assertExpectedColumns(spec, [])).toThrow(CatalogSchemaDriftError);
    expect(() => assertExpectedColumns(spec, [], ['external_ref', 'document_id'])).not.toThrow();
    expect(() => assertExpectedColumns(spec, [{ external_ref: 'x', document_id: 1 }])).not.toThrow();
  });
});

describe('Transport', () => {
  it('AgentTransport: küme dışı tip, idempotencyKey eksik yazma ve kimlik sızıntısı dispatcher\'a ULAŞMAZ', async () => {
    const dispatch = jest.fn().mockResolvedValue({ jobId: 'j', status: 'OK', data: { ok: 1 }, durationMs: 1, agentVersion: '0', fromCache: false });
    const t = new AgentTransport({ dispatch }, { agentId: 'a', agencyId: 'g', extraForbiddenKeys: ['Mikro'] });
    const base = { integrationId: 'i', companyKey: { companyNo: '1' } };

    await expect(t.execute({ ...base, type: 'RUN_SQL' as any, payload: {} })).rejects.toThrow(/K6/);
    await expect(t.execute({ ...base, type: 'INVOICE_PUSH', payload: {} })).rejects.toThrow(/idempotencyKey/);
    await expect(t.execute({ ...base, type: 'STOCK_SNAPSHOT', payload: { body: { Mikro: {} } } })).rejects.toThrow(/K1/);
    expect(dispatch).not.toHaveBeenCalled();
    expect(t.callCount).toBe(0);

    const r = await t.execute<{ ok: number }>({ ...base, type: 'INVOICE_PUSH', idempotencyKey: 'KRP-ORDER-1', payload: { x: 1 } });
    expect(r.data.ok).toBe(1);
    expect(t.callCount).toBe(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({ type: 'INVOICE_PUSH', idempotencyKey: 'KRP-ORDER-1', protocolVersion: PROTOCOL_VERSION });
  });

  it('AgentTransport: RETRYABLE/EXPIRED ağ sınıfı hata, FAILED API hatası', async () => {
    const mk = (status: string) => new AgentTransport({ dispatch: async () => ({ jobId: 'j', status: status as any, durationMs: 0, agentVersion: '0', fromCache: false, errorCode: 'erp_auth_failed' }) }, { agentId: 'a', agencyId: 'g' });
    const op = { type: 'CONNECTION_TEST' as const, integrationId: 'i', companyKey: { companyNo: '1' }, payload: {} };
    await expect(mk('RETRYABLE').execute(op)).rejects.toThrow(/Network/);
    await expect(mk('EXPIRED').execute(op)).rejects.toThrow(/Network/);
    await expect(mk('FAILED').execute(op)).rejects.toThrow(/erp_auth_failed/);
  });

  it('DirectTransport yürütücüsüz NotImplementedException', async () => {
    const t = new DirectTransport();
    await expect(t.execute({ type: 'CONNECTION_TEST', integrationId: 'i', companyKey: { companyNo: '1' }, payload: {} })).rejects.toThrow(NotImplementedException);
    expect(t.callCount).toBe(0);
  });
});

describe('Registry descriptor değişmezleri (kayıt anında)', () => {
  const base = (): AccountingProviderDescriptor => ({
    id: 'T',
    displayName: 'T',
    country: 'TR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: { provider: 'T', name: 'T', fields: [] },
    capabilities: {
      salesInvoice: CapabilityStatus.MOCK_ONLY, payment: CapabilityStatus.MOCK_ONLY, contactSync: CapabilityStatus.MOCK_ONLY,
      productMapping: CapabilityStatus.MOCK_ONLY, stockSync: CapabilityStatus.NOT_SUPPORTED, eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
      cancelInvoice: CapabilityStatus.NOT_SUPPORTED, findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
    },
    supportsMock: true, supportsTest: false, supportsProduction: false, lastVerifiedAt: null,
    connectorClass: class {},
  });

  it('eksik capabilities reddedilir', () => {
    const d = base(); delete (d.capabilities as any).payment;
    expect(() => AccountingProviderRegistry.assertValid(d)).toThrow(/payment/);
  });
  it('supportedRoutes bildiren sağlayıcıda Agent yetenekleri zorunlu', () => {
    const d = base(); d.supportedRoutes = ['AGENT'];
    expect(() => AccountingProviderRegistry.assertValid(d)).toThrow(/connectionTest/);
  });
  it('lastVerifiedAt boşken supportsTest açılamaz', () => {
    const d = base(); d.supportsTest = true;
    expect(() => AccountingProviderRegistry.assertValid(d)).toThrow(/lastVerifiedAt/);
  });
  it('readiness < PRODUCTION_READY iken supportsProduction açılamaz', () => {
    const d = base(); d.supportsProduction = true; d.lastVerifiedAt = '2026-01-01';
    expect(() => AccountingProviderRegistry.assertValid(d)).toThrow(/supportsProduction/);
  });
  it('isOffline sağlayıcı muaf', () => {
    const d = base(); d.supportsProduction = true; d.supportsTest = true; d.isOffline = true;
    expect(() => AccountingProviderRegistry.assertValid(d)).not.toThrow();
  });
});
