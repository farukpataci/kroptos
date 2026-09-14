/**
 * docs/mikro.agent.md GÖREV 4 — Agent rotası uygunluk paketi.
 * Registry'deki HER sağlayıcı otomatik kapsanır; yeni connector için buraya satır EKLENMEZ.
 * "Ağ isteği yapılmadı" iddiası yorumla değil SAYAÇLA kanıtlanır (SpyTransport + HTTP casusu).
 */
import { NotImplementedException } from '@nestjs/common';
import { AccountingProviderRegistry } from '../AccountingProviderRegistry';
import {
  AGENT_ROUTE_CAPABILITY_KEYS,
  AccountingContext,
  CapabilityStatus,
  CORE_CAPABILITY_KEYS,
} from '../AccountingTypes';
import {
  CapabilityContractRequiredError,
  IntegrationNotVerifiedError,
} from '../AccountingErrors';
import { AGENT_JOB_TYPES, isAgentJobType } from '../agent/AgentProtocol';
import { tokenCacheKey } from '../AccountingSessionKey';
import { findCredentialLeak, stripNonServerFields, visibleFields } from '../AccountingCredentialSchema';
import { SpyTransport } from '../transport/DirectTransport';
import { CORE_FORBIDDEN_PAYLOAD_KEYS } from '../transport/AgentTransport';
import { assertReadOnlySql } from '../catalog/CatalogManifest';
import { canAutoPushInvoice } from '../AccountingCapabilities';
import { AccountingHttpClient } from '../AccountingHttpClient';
// registry yüklemesi — mevcut paketle aynı liste
import '../../parasut';
import '../../kolaybi';
import '../../bizimhesap';
import '../../sap-s4hana-cloud';
import '../../ms-dynamics-bc-online';
import '../../sage-accounting';
import '../../xero';
import '../../quickbooks';
import '../../odoo';
import '../../datev';
import '../../lexware-office';
import '../../sevdesk';
import '../../freeagent';
import '../../exact-online';
import '../../visma-net-erp';
import '../../fortnox';
import '../../netsuite';
import '../../fatture-in-cloud';
import '../../cegid-xrp-flex';
import '../../pennylane';
import '../../logo-rest';
import '../../logo-objects';
import '../../netsis';
import '../../mikro';

const VALID = new Set<string>(Object.values(CapabilityStatus));

/** Gerçek HTTP'ye çıkışı sayar — connector hangi yolu kullanırsa kullansın. */
let httpCalls = 0;
const httpSpy = jest.spyOn(AccountingHttpClient.prototype as any, 'request').mockImplementation(async () => {
  httpCalls++;
  throw new Error('conformance: ağ çağrısı yasak');
});
const fetchSpy =
  typeof (global as any).fetch === 'function'
    ? jest.spyOn(global as any, 'fetch' as any).mockImplementation(async () => {
        httpCalls++;
        throw new Error('conformance: fetch yasak');
      })
    : null;

afterAll(() => {
  httpSpy.mockRestore();
  fetchSpy?.mockRestore();
});

const invoiceReq = (ref = 'KRP-ORDER-1') => ({
  companyId: '1',
  referenceCode: ref,
  issueDate: '2026-09-14',
  currency: 'TRY',
  contact: { name: 'Test', taxNumber: '1234567890', address: 'Adres' },
  items: [{ sku: 'S1', name: 'Ürün', quantity: 1, unitPrice: 100, vatRate: 20, vatAmount: 20, totalAmount: 120 }],
  subtotal: 100,
  vatTotal: 20,
  grandTotal: 120,
});

const providers = AccountingProviderRegistry.all();

describe('Agent-route conformance — tüm sağlayıcılar', () => {
  it('registry boş değil', () => expect(providers.length).toBeGreaterThan(0));

  describe.each(providers.map((p) => [p.id, p] as const))('%s', (_id, d) => {
    const agentRoute = !!d.supportedRoutes?.length;
    // Eski sağlayıcılarda 3. kurucu argümanı mock-client override'ıdır; bağlam yalnızca Agent rotasına verilir
    const make = (env: 'MOCK' | 'TEST' | 'PRODUCTION' = 'MOCK', transport = new SpyTransport()) =>
      agentRoute
        ? new d.connectorClass({}, env, { transport, integrationId: 'int', companyKey: { companyNo: '1', periodNo: '2026' } })
        : new d.connectorClass({}, env);

    it('1. capabilities eksiksiz — çekirdek anahtarlar; Agent rotasında 15 anahtarın hepsi tanımlı', () => {
      for (const k of CORE_CAPABILITY_KEYS) expect(VALID.has((d.capabilities as any)[k])).toBe(true);
      if (agentRoute) for (const k of AGENT_ROUTE_CAPABILITY_KEYS) expect(VALID.has((d.capabilities as any)[k])).toBe(true);
    });

    it('2. NOT_SUPPORTED yetenek çağrısı → NotImplementedException, ağ 0', async () => {
      const spy = new SpyTransport();
      const c: any = make('MOCK', spy);
      httpCalls = 0;
      const pairs: Array<[string, () => Promise<unknown>]> = [
        ['salesInvoice', () => c.createInvoice(invoiceReq())],
        ['payment', () => c.recordPayment({ companyId: '1', invoiceExternalId: 'x', referenceCode: 'P1', amount: 1, currency: 'TRY', paymentDate: '2026-09-14' })],
        ['contactSync', () => c.syncContact({ companyId: '1', kroptosKey: 'k', name: 'N', taxNumber: '1234567890' })],
        ['productMapping', () => c.mapProduct({ companyId: '1', sku: 'S', name: 'N' })],
      ];
      for (const [key, call] of pairs) {
        if ((d.capabilities as any)[key] === CapabilityStatus.NOT_SUPPORTED) {
          await expect(call()).rejects.toThrow();
          if (agentRoute) await expect(call()).rejects.toThrow(NotImplementedException);
        }
      }
      expect(spy.callCount).toBe(0);
      expect(httpCalls).toBe(0);
    });

    it('3. doğrulanmamış yetenek (DOCUMENTATION_REQUIRED/UNKNOWN) → IntegrationNotVerifiedError, ağ 0', async () => {
      const spy = new SpyTransport();
      const c: any = make('MOCK', spy);
      httpCalls = 0;
      const unverified = [CapabilityStatus.DOCUMENTATION_REQUIRED, CapabilityStatus.UNKNOWN];
      if (unverified.includes(d.capabilities.salesInvoice)) {
        await expect(c.createInvoice(invoiceReq())).rejects.toThrow(agentRoute ? IntegrationNotVerifiedError : Error);
      }
      // Eski bulut sağlayıcılar DOCUMENTATION_REQUIRED findInvoiceByReference için mock'ta null döner
      // (bulunamadı); K3'ün katı biçimi yalnızca Agent rotası sağlayıcılarına uygulanır.
      if (agentRoute && unverified.includes(d.capabilities.findInvoiceByReference) && typeof c.findInvoiceByReference === 'function') {
        await expect(c.findInvoiceByReference('KRP-ORDER-1')).rejects.toThrow(IntegrationNotVerifiedError);
      }
      expect(spy.callCount).toBe(0);
      expect(httpCalls).toBe(0);
    });

    it('4. readiness < PRODUCTION_READY iken hiçbir yetenek ağa çıkmıyor (TEST/PRODUCTION)', async () => {
      if (d.readiness === 'PRODUCTION_READY' || d.isOffline) return;
      httpCalls = 0;
      for (const env of ['TEST', 'PRODUCTION'] as const) {
        if ((env === 'TEST' && d.supportsTest) || (env === 'PRODUCTION' && d.supportsProduction)) continue;
        const spy = new SpyTransport();
        const c: any = make(env, spy);
        await expect(c.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
        await expect(c.createInvoice(invoiceReq())).rejects.toThrow();
        expect(spy.callCount).toBe(0);
      }
      expect(httpCalls).toBe(0);
    });

    it('5. supportsTest/supportsProduction true ise lastVerifiedAt dolu (offline sağlayıcı hariç)', () => {
      if (d.isOffline) return;
      if (d.supportsTest || d.supportsProduction) expect(d.lastVerifiedAt).toBeTruthy();
    });

    it('6. MOCK testConnection: Agent rotasında isMock:true ve mesajda "MOCK"; ağ 0', async () => {
      if (!agentRoute) return;
      const spy = new SpyTransport();
      const c: any = make('MOCK', spy);
      httpCalls = 0;
      const r = await c.testConnection();
      expect(r.isMock).toBe(true);
      expect(r.message).toMatch(/MOCK/);
      expect(spy.callCount).toBe(0);
      expect(httpCalls).toBe(0);
    });

    it('11. secret alanlar maskeli; ham değer cevapta yok', () => {
      const { AccountingCredentialService } = require('../AccountingCredentialService');
      const svc = new AccountingCredentialService();
      const raw: Record<string, string> = {};
      for (const f of d.credentialSchema.fields) raw[f.key] = `RAW_${f.key}_VALUE_1234567890`;
      const masked = svc.maskCredentials(d.id, raw);
      for (const f of d.credentialSchema.fields) {
        if (f.type === 'password' || f.secret) expect(masked[f.key]).not.toBe(raw[f.key]);
      }
    });

    it('20. registry kaydı ile connector capabilities aynı', () => {
      const c: any = make();
      expect(c.capabilities).toEqual(d.capabilities);
      expect(c.provider).toBe(d.id);
    });

    it('21. transport\'a giden her jobType kapalı kümede; sağlayıcı kümeye ekleme yapmıyor', async () => {
      const spy = new SpyTransport();
      const c: any = make('MOCK', spy);
      // yalnızca SUPPORTED/MOCK_ONLY yetenekler transport'a ulaşabilir
      await c.testConnection().catch(() => undefined);
      await c.createInvoice(invoiceReq()).catch(() => undefined);
      for (const op of spy.operations) expect(isAgentJobType(op.type)).toBe(true);
      expect(AGENT_JOB_TYPES).toHaveLength(14);
    });

    it('22. iki farklı companyNo aynı token anahtarını paylaşmıyor', () => {
      expect(tokenCacheKey('int', { companyNo: '2' })).not.toBe(tokenCacheKey('int', { companyNo: '3' }));
    });

    it('23. AccountingContext hiçbir credential alanı taşımıyor (tip + çalışma zamanı)', () => {
      const ctx: AccountingContext = {
        integrationId: 'int',
        tenant: { agencyId: 'a' },
        companyKey: { companyNo: '1' },
        environment: 'MOCK',
        transport: new SpyTransport(),
        isTestMode: true,
      };
      const forbidden = [...CORE_FORBIDDEN_PAYLOAD_KEYS, 'credentials', 'secret', 'token', ...d.credentialSchema.fields.filter((f) => f.secret || f.type === 'password').map((f) => f.key)];
      expect(findCredentialLeak({ ...ctx, transport: undefined }, forbidden)).toBeNull();
      // @ts-expect-error — tip düzeyinde credential alanı yok
      const bad: AccountingContext = { ...ctx, credentials: {} };
      expect(bad).toBeDefined();
    });

    it('24. AGENT_LOCAL ve derived alanlar sunucu kaydından ayıklanıyor', () => {
      const raw: Record<string, string> = {};
      for (const f of d.credentialSchema.fields) raw[f.key] = 'v';
      const kept = stripNonServerFields(d.credentialSchema, raw);
      for (const f of d.credentialSchema.fields) {
        if (f.storage === 'AGENT_LOCAL' || f.derived) expect(kept).not.toHaveProperty(f.key);
        else expect(kept).toHaveProperty(f.key);
      }
    });

    it('32. connector\'ın ürettiği gövdede sağlayıcı yasak anahtarları (Mikro/ApiKey/Sifre…) yok', () => {
      const c: any = make();
      if (typeof c.buildRequestPreview !== 'function') return;
      const forbidden = [...CORE_FORBIDDEN_PAYLOAD_KEYS, ...(c.forbiddenBodyKeys ?? [])];
      const previews = [
        c.buildRequestPreview('invoice', invoiceReq()),
        c.buildRequestPreview('partner', { companyId: '1', kroptosKey: 'k', name: 'N', taxNumber: '1234567890', phone: '0532 111 22 33', email: ' A@B.CO ' }),
        c.buildRequestPreview('receipt', { companyId: '1', invoiceExternalId: 'x', referenceCode: 'KRP-PAYMENT-1', amount: 1, currency: 'TRY', paymentDate: '2026-09-14' }),
        c.buildRequestPreview('stock', {}),
      ];
      for (const p of previews) expect(findCredentialLeak(p, forbidden)).toBeNull();
    });

    it('36. derived alanlar formda gösterilmiyor', () => {
      for (const f of visibleFields(d.credentialSchema)) expect(f.derived).toBeUndefined();
    });

    it('39/40. katalog: SELECT dışı SQL reddediliyor (sağlayıcıdan bağımsız doğrulayıcı)', () => {
      expect(() => assertReadOnlySql('DELETE FROM x', d.id)).toThrow();
      expect(() => assertReadOnlySql('SELECT 1 AS a', d.id)).not.toThrow();
    });

    it('42. invoiceFindByRef SUPPORTED değilken otomatik pushInvoice reddediliyor (K11)', () => {
      const status = d.capabilities.invoiceFindByRef ?? d.capabilities.findInvoiceByReference;
      expect(canAutoPushInvoice(status, 'PRODUCTION')).toBe(status === CapabilityStatus.SUPPORTED);
    });

    it('43. cancelInvoice silme ucunu kendiliğinden çağırmıyor: CONTRACT_REQUIRED → fırlatır, transport 0', async () => {
      const spy = new SpyTransport();
      const c: any = make('MOCK', spy);
      if (typeof c.cancelInvoice !== 'function') return;
      const status = d.capabilities.invoiceCancel ?? d.capabilities.cancelInvoice;
      if (status === CapabilityStatus.CONTRACT_REQUIRED) {
        await expect(c.cancelInvoice('X')).rejects.toThrow(CapabilityContractRequiredError);
        expect(spy.callCount).toBe(0);
      }
    });

    it('44. metot sürümleri descriptor\'dan okunuyor', () => {
      if (!d.methodVersions) return;
      const c: any = make();
      expect(typeof c.methodPath).toBe('function');
      for (const [m, v] of Object.entries(d.methodVersions)) expect(c.methodPath(m).endsWith(v)).toBe(true);
    });

    it('45. stockDelta NOT_SUPPORTED iken delta isteği ağa çıkmıyor', () => {
      if (d.capabilities.stockDelta !== CapabilityStatus.NOT_SUPPORTED) return;
      const c: any = make();
      if (typeof c.buildRequestPreview !== 'function') return;
      expect(() => c.buildRequestPreview('stock', { changedSince: '2026-01-01' })).toThrow();
    });
  });
});
