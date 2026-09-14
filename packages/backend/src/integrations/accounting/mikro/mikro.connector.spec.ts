import { BadRequestException, NotImplementedException } from '@nestjs/common';
import { MikroConnector } from './mikro.connector';
import { MikroRequestMapper } from './mikro.request-mapper';
import { MikroResponseMapper } from './mikro.response-mapper';
import { MIKRO_DESCRIPTOR } from './mikro.descriptor';
import { MIKRO_METHOD_VERSIONS, MIKRO_PATHS } from './mikro.types';
import { SpyTransport } from '../core/transport/DirectTransport';
import {
  AccountingApiError,
  CapabilityContractRequiredError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';
import { findCredentialLeak } from '../core/AccountingCredentialSchema';

const invoice = (ref = 'KRP-ORDER-1', contact: any = { name: 'A', taxNumber: '1234567890' }) => ({
  companyId: '1',
  referenceCode: ref,
  issueDate: '2026-09-14',
  currency: 'TRY',
  contact,
  items: [{ sku: 'S1', name: 'Ürün', quantity: 2, unitPrice: 50, vatRate: 20, vatAmount: 20, totalAmount: 120 }],
  subtotal: 100,
  vatTotal: 20,
  grandTotal: 120,
});

describe('MIKRO descriptor (§7)', () => {
  it('SCAFFOLDED, lastVerifiedAt null, AGENT rotası, methodVersions açık', () => {
    expect(MIKRO_DESCRIPTOR.readiness).toBe('SCAFFOLDED');
    expect(MIKRO_DESCRIPTOR.lastVerifiedAt).toBeNull();
    expect(MIKRO_DESCRIPTOR.supportedRoutes).toEqual(['AGENT']);
    expect(MIKRO_DESCRIPTOR.supportsTest).toBe(false);
    expect(MIKRO_DESCRIPTOR.supportsProduction).toBe(false);
    expect(MIKRO_DESCRIPTOR.methodVersions).toBe(MIKRO_METHOD_VERSIONS);
  });

  it('MIKRO_PATHS dokümandaki hâliyle — normalize edilmemiş (büyük/küçük harf farkı korunur)', () => {
    expect(MIKRO_PATHS.APILogin).toBe('/Api/APIMethods/APILogin');
    expect(MIKRO_PATHS.SqlVeriOku).toBe('/api/apimethods/SqlVeriOku');
    const c = new MikroConnector({}, 'MOCK');
    expect(c.methodPath('SqlVeriOku')).toBe('/api/apimethods/SqlVeriOkuV2');
    expect(c.methodPath('APILogin')).toBe('/Api/APIMethods/APILogin');
    expect(c.methodPath('FaturaKaydet')).toBe('/Api/APIMethods/FaturaKaydetV2');
  });

  it('FirmaKodu/CalismaYili credential şemasında YOK; sifre derived ve AGENT_LOCAL', () => {
    const keys = MIKRO_DESCRIPTOR.credentialSchema.fields.map((f) => f.key);
    expect(keys).not.toContain('firmaKodu');
    expect(keys).not.toContain('calismaYili');
    const sifre = MIKRO_DESCRIPTOR.credentialSchema.fields.find((f) => f.key === 'sifre')!;
    expect(sifre.storage).toBe('AGENT_LOCAL');
    expect(sifre.derived).toEqual({ from: ['password'], strategy: 'MIKRO_DATE_MD5' });
  });
});

describe('MikroConnector — K3 kapıları, ağ 0', () => {
  it('MOCK testConnection isMock; TEST/PRODUCTION IntegrationNotVerifiedError; transport 0', async () => {
    const spy = new SpyTransport();
    const mock = new MikroConnector({ companyId: '7' }, 'MOCK', { transport: spy });
    const r = await mock.testConnection();
    expect(r.isMock).toBe(true);
    expect(r.companyId).toBe('7');
    for (const env of ['TEST', 'PRODUCTION'] as const) {
      await expect(new MikroConnector({}, env, { transport: spy }).testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    }
    expect(spy.callCount).toBe(0);
  });

  it('DOCUMENTATION_REQUIRED yetenekler MOCK\'ta bile fırlatır; NOT_SUPPORTED NotImplemented; iptal CONTRACT_REQUIRED', async () => {
    const spy = new SpyTransport();
    const c = new MikroConnector({}, 'MOCK', { transport: spy, invoiceSeries: 'MYT' });
    await expect(c.createInvoice(invoice())).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(c.findInvoiceByReference('KRP-ORDER-1')).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(c.cancelInvoice('MYT-39')).rejects.toThrow(CapabilityContractRequiredError);
    await expect(c.mapProduct({ companyId: '1', sku: 'S', name: 'N' })).rejects.toThrow(IntegrationNotVerifiedError);
    expect(spy.callCount).toBe(0);
    // AlimSatimEvragiSil hiçbir işte kullanılmıyor (K12)
    expect(spy.operations.some((o) => JSON.stringify(o).includes('AlimSatimEvragiSil'))).toBe(false);
  });
});

describe('MikroRequestMapper (§7.5 — sağlayıcıdan bağımsız kurallar)', () => {
  it('fatura gövdesi: seri var, sira YOK, user_tablo.KROPTOS_REF = externalRef, kimlik anahtarı yok', () => {
    const body = MikroRequestMapper.toInvoiceBody(invoice(), 'MYT', 'KRP-ORDER-1');
    expect(body.cha_evrakno_seri).toBe('MYT');
    expect(body).not.toHaveProperty('cha_evrakno_sira');
    expect(body.user_tablo).toEqual({ KROPTOS_REF: 'KRP-ORDER-1' });
    expect(findCredentialLeak(body, ['Mikro', 'ApiKey', 'Sifre', 'KullaniciKodu'])).toBeNull();
  });

  it('zorunlu alanlar: seri, ≥1 satır, pozitif miktar, negatif olmayan fiyat, KDV 0–100', () => {
    expect(() => MikroRequestMapper.toInvoiceBody(invoice(), '', 'R')).toThrow(BadRequestException);
    expect(() => MikroRequestMapper.toInvoiceBody({ ...invoice(), items: [] }, 'MYT', 'R')).toThrow(BadRequestException);
    const bad = (patch: any) => ({ ...invoice(), items: [{ ...invoice().items[0], ...patch }] });
    expect(() => MikroRequestMapper.toInvoiceBody(bad({ quantity: 0 }), 'MYT', 'R')).toThrow(/Miktar/);
    expect(() => MikroRequestMapper.toInvoiceBody(bad({ unitPrice: -1 }), 'MYT', 'R')).toThrow(/Fiyat/);
    expect(() => MikroRequestMapper.toInvoiceBody(bad({ vatRate: 101 }), 'MYT', 'R')).toThrow(/KDV/);
  });

  it('cari anahtarı: VKN/TCKN → ERP kodu; isim ASLA anahtar değil', () => {
    expect(MikroRequestMapper.partnerKey({ taxNumber: '123 456 78 90', name: 'X' })).toEqual({ kind: 'taxNumber', value: '1234567890' });
    expect(MikroRequestMapper.partnerKey({ taxNumber: '12345678901' })).toEqual({ kind: 'taxNumber', value: '12345678901' });
    expect(MikroRequestMapper.partnerKey({ erpCode: 'C-1', name: 'X' })).toEqual({ kind: 'erpCode', value: 'C-1' });
    expect(() => MikroRequestMapper.partnerKey({ name: 'Sadece İsim' })).toThrow(BadRequestException);
    expect(() => MikroRequestMapper.toInvoiceBody(invoice('R', { name: 'Sadece İsim' }), 'MYT', 'R')).toThrow(BadRequestException);
  });

  it('telefon ve e-posta normalizasyonu', () => {
    expect(MikroRequestMapper.normalizePhone('0532 111 22 33')).toBe('+905321112233');
    expect(MikroRequestMapper.normalizePhone('5321112233')).toBe('+905321112233');
    expect(MikroRequestMapper.normalizePhone('+49 30 123')).toBe('+4930123');
    expect(MikroRequestMapper.normalizePhone('')).toBeUndefined();
    expect(MikroRequestMapper.normalizeEmail(' A@B.CO ')).toBe('a@b.co');
    expect(MikroRequestMapper.normalizeEmail('bozuk')).toBeUndefined();
  });

  it('changedSince gönderilirse REDDET (stockDelta NOT_SUPPORTED)', () => {
    expect(() => MikroRequestMapper.toStockListBody({ changedSince: '2026-01-01' })).toThrow(/delta/i);
    expect(MikroRequestMapper.toStockListBody({ depoNo: 1, limit: 100 })).toEqual({ depoNo: 1, limit: 100 });
  });

  it('externalRef deterministik; iptal sonrası sürüm eki, sourceId değişmez', () => {
    expect(MikroRequestMapper.externalRef('order', '123')).toBe('KRP-ORDER-123');
    expect(MikroRequestMapper.externalRef('order', '123', 2)).toBe('KRP-ORDER-123:2');
  });
});

describe('MikroResponseMapper — tanımadığı zarfta HATA, boş dizi/sahte no yok', () => {
  it('nesne olmayan / evrak numarasız cevap → AccountingApiError', () => {
    expect(() => MikroResponseMapper.toInvoiceResult(null, 'R')).toThrow(AccountingApiError);
    expect(() => MikroResponseMapper.toInvoiceResult([], 'R')).toThrow(AccountingApiError);
    expect(() => MikroResponseMapper.toInvoiceResult({ ok: true }, 'R')).toThrow(AccountingApiError);
    expect(MikroResponseMapper.toInvoiceResult({ cha_evrakno_seri: 'MYT', cha_evrakno_sira: 39 }, 'R')).toMatchObject({ externalId: 'MYT-39' });
  });

  it('katalog satırı: external_ref uyuşmazlığı ve boş document_id reddedilir', () => {
    expect(() => MikroResponseMapper.toInvoiceResultFromCatalogRow({ external_ref: 'X', document_id: 1 }, 'R')).toThrow(/uyuşmuyor/);
    expect(() => MikroResponseMapper.toInvoiceResultFromCatalogRow({ external_ref: 'R', document_id: '' }, 'R')).toThrow(/document_id/);
    expect(MikroResponseMapper.toInvoiceResultFromCatalogRow({ external_ref: 'R', document_id: 5, document_no: 'MYT-5' }, 'R')).toEqual(
      expect.objectContaining({ externalId: '5', externalNumber: 'MYT-5' }),
    );
  });

  it('"Geçersiz api key" metni 401\'e eşlenir', () => {
    expect(() => MikroResponseMapper.toTestConnectionResult({ Hata: 'Geçersiz api key' }, '1')).toThrow(/api key/);
  });
});

describe('NotImplementedException sınıfı', () => {
  it('companyList NOT_SUPPORTED → NotImplementedException (assertCapability üzerinden)', () => {
    const { assertCapability } = require('../core/AccountingCapabilities');
    expect(() => assertCapability('MIKRO', 'companyList', MIKRO_DESCRIPTOR.capabilities.companyList, 'MOCK')).toThrow(NotImplementedException);
  });
});
