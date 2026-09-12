import { LogoRestConnector } from './logo-rest.connector';
import { LogoRestMockClient } from './logo-rest.mock-client';
import { LogoRestSessionManager, buildLogoRestTokenRequest } from './logo-rest.session';
import { AccountingAuthError, IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';

const creds = {
  baseUrl: 'http://10.0.0.5',
  clientId: 'cid',
  clientSecret: 'sec',
  username: 'LOGO',
  password: 'pw',
  companyId: '2',
};

const invoice = (referenceCode: string): AccountingInvoiceRequest => ({
  companyId: '2',
  referenceCode,
  issueDate: '2026-09-12',
  currency: 'TRY',
  contact: { name: 'Musteri', taxNumber: '1234567890' },
  items: [{ sku: 'S1', name: 'Urun', quantity: 1, unitPrice: 100, vatRate: 20, vatAmount: 20, totalAmount: 120 }],
  subtotal: 100,
  vatTotal: 20,
  grandTotal: 120,
});

describe('LogoRest token request (docs/logo.agent.md 1.1)', () => {
  it('builds the verified token contract: /api/v1/token, Basic clientId:secret, firmno in body, default port 32001', () => {
    const req = buildLogoRestTokenRequest(creds, '2');
    expect(req.url).toBe('http://10.0.0.5:32001/api/v1/token');
    expect(req.headers.Authorization).toBe(`Basic ${Buffer.from('cid:sec').toString('base64')}`);
    expect(req.body).toEqual({ grant_type: 'password', username: 'LOGO', password: 'pw', firmno: '2' });
  });

  it('keeps an explicit port and strips trailing slash', () => {
    expect(buildLogoRestTokenRequest({ ...creds, baseUrl: 'https://erp.local:5000/' }, '1').url).toBe(
      'https://erp.local:5000/api/v1/token',
    );
  });
});

describe('LogoRestSessionManager (5.3 - token key = firmno)', () => {
  it('never shares a token between two firms and single-flights concurrent calls', async () => {
    const fetchToken = jest.fn(async (req) => ({ access_token: `tok-${req.body.firmno}`, expires_in: 600 }));
    const sm = new LogoRestSessionManager(creds, fetchToken);

    const [a, b, a2] = await Promise.all([sm.getToken('2'), sm.getToken('3'), sm.getToken('2')]);
    expect(a).toBe('tok-2');
    expect(b).toBe('tok-3');
    expect(a2).toBe('tok-2');
    expect(fetchToken).toHaveBeenCalledTimes(2);

    expect(await sm.getToken('3')).toBe('tok-3'); // cached
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('wraps token failure as AccountingAuthError and does not cache', async () => {
    const fetchToken = jest.fn().mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({ access_token: 'ok' });
    const sm = new LogoRestSessionManager(creds, fetchToken);
    await expect(sm.getToken('1')).rejects.toThrow(AccountingAuthError);
    expect(await sm.getToken('1')).toBe('ok');
  });
});

describe('LogoRestConnector', () => {
  beforeEach(() => LogoRestMockClient.resetStore());

  it('MOCK: testConnection echoes firm number', async () => {
    const c = new LogoRestConnector(creds);
    const r = await c.testConnection();
    expect(r.success).toBe(true);
    expect(r.companyId).toBe('2');
    expect(r.environment).toBe('MOCK');
  });

  it('MOCK: createInvoice is idempotent per (firm, referenceCode) and findInvoiceByReference reads it back', async () => {
    const c = new LogoRestConnector(creds);
    const first = await c.createInvoice(invoice('KRP-ORDER-1'));
    const second = await c.createInvoice(invoice('KRP-ORDER-1'));
    expect(second.externalId).toBe(first.externalId);
    expect(first.externalId).toMatch(/^mock-inv-2-/);
    expect(first.externalNumber).toBeUndefined();
    expect(await c.findInvoiceByReference('KRP-ORDER-1')).toEqual(first);

    const otherFirm = new LogoRestConnector({ ...creds, companyId: '3' });
    expect(await otherFirm.findInvoiceByReference('KRP-ORDER-1')).toBeNull();
  });

  it('MOCK: contact match key is tax number, not name', async () => {
    const c = new LogoRestConnector(creds);
    const a = await c.syncContact({ companyId: '2', kroptosKey: 'k1', name: 'A Ltd', taxNumber: '111' });
    const b = await c.syncContact({ companyId: '2', kroptosKey: 'k2', name: 'A LTD.', taxNumber: '111' });
    expect(b.externalId).toBe(a.externalId);
  });

  it('MOCK: trigger flags surface typed errors', async () => {
    const c = new LogoRestConnector(creds);
    await expect(c.createInvoice(invoice('TRIGGER_AUTH_FAIL'))).rejects.toThrow(AccountingAuthError);
  });

  it.each(['TEST', 'PRODUCTION'] as const)('%s: every operation throws IntegrationNotVerifiedError (zero network)', async (env) => {
    const c = new LogoRestConnector(creds, env);
    await expect(c.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(c.createInvoice(invoice('X'))).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(c.findInvoiceByReference('X')).rejects.toThrow(IntegrationNotVerifiedError);
  });
});
