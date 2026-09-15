import { BadRequestException } from '@nestjs/common';
import { NebimV3Connector } from './nebim-v3.connector';
import { NebimV3RequestMapper } from './nebim-v3.request-mapper';
import { NebimV3ResponseMapper } from './nebim-v3.response-mapper';
import { NEBIM_V3_DESCRIPTOR } from './nebim-v3.descriptor';
import { NEBIM_V3_FORBIDDEN_BODY_KEYS, NEBIM_V3_PATHS } from './nebim-v3.types';
import { NEBIM_POSTING_DEFAULTS } from './nebim-v3.posting-defaults';
import { SpyTransport } from '../core/transport/DirectTransport';
import {
  IntegrationNotVerifiedError,
  PostingDefaultsMissingError,
} from '../core/AccountingErrors';
import { findCredentialLeak } from '../core/AccountingCredentialSchema';

const sampleInvoice = (ref = 'KRP-ORDER-1', contact: any = { name: 'A', taxNumber: '1234567890' }) => ({
  companyId: 'V3_DB',
  referenceCode: ref,
  issueDate: '2026-09-14',
  currency: 'TRY',
  contact,
  items: [{ sku: 'S1', name: 'Ürün', quantity: 2, unitPrice: 50, vatRate: 20, vatAmount: 20, totalAmount: 120 }],
  subtotal: 100,
  vatTotal: 20,
  grandTotal: 120,
});

describe('NEBIM-V3 descriptor (docs/nebim.v3.agent.md §7)', () => {
  it('SCAFFOLDED, lastVerifiedAt null, AGENT rotası, periodPolicy ERP_ENFORCED', () => {
    expect(NEBIM_V3_DESCRIPTOR.id).toBe('NEBIM-V3');
    expect(NEBIM_V3_DESCRIPTOR.readiness).toBe('SCAFFOLDED');
    expect(NEBIM_V3_DESCRIPTOR.lastVerifiedAt).toBeNull();
    expect(NEBIM_V3_DESCRIPTOR.supportedRoutes).toEqual(['AGENT']);
    expect(NEBIM_V3_DESCRIPTOR.supportsTest).toBe(false);
    expect(NEBIM_V3_DESCRIPTOR.supportsProduction).toBe(false);
    expect(NEBIM_V3_DESCRIPTOR.periodPolicy).toBe('ERP_ENFORCED');
    expect(NEBIM_V3_DESCRIPTOR.postingDefaultSpec).toEqual(NEBIM_POSTING_DEFAULTS);
  });

  it('credential şemasında maxSessions varsayılan 1 ve lisans uyarısı tanımlı (K14)', () => {
    const maxSessions = NEBIM_V3_DESCRIPTOR.credentialSchema.fields.find((f) => f.key === 'maxSessions');
    expect(maxSessions).toBeDefined();
    expect(maxSessions?.defaultValue).toBe(1);
    expect(NEBIM_V3_DESCRIPTOR.licensePrerequisite).toBe('accounting.nebim.prerequisite.userLicense');
  });

  it('databaseName ve officeCode credential şemasında YOK (AccountingCompany parçasıdır)', () => {
    const keys = NEBIM_V3_DESCRIPTOR.credentialSchema.fields.map((f) => f.key);
    expect(keys).not.toContain('databaseName');
    expect(keys).not.toContain('officeCode');
  });
});

describe('NebimV3Connector — K3 kapıları ve Mock modu', () => {
  it('MOCK testConnection isMock:true döner; TEST/PRODUCTION IntegrationNotVerifiedError fırlatır', async () => {
    const spy = new SpyTransport();
    const mock = new NebimV3Connector({ databaseName: 'TEST_DB' }, 'MOCK', { transport: spy });
    const r = await mock.testConnection();
    expect(r.isMock).toBe(true);
    expect(r.companyId).toBe('TEST_DB');
    expect(spy.callCount).toBe(0);

    for (const env of ['TEST', 'PRODUCTION'] as const) {
      await expect(
        new NebimV3Connector({}, env, { transport: spy }).testConnection(),
      ).rejects.toThrow(IntegrationNotVerifiedError);
    }
    expect(spy.callCount).toBe(0);
  });

  it('DOCUMENTATION_REQUIRED yetenekler çağrıldığında ağa çıkmadan önce fırlatır', async () => {
    const spy = new SpyTransport();
    const c = new NebimV3Connector({}, 'MOCK', { transport: spy });
    await expect(c.createInvoice(sampleInvoice())).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(c.findInvoiceByReference('REF-1')).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(c.syncContact({ companyId: '1', kroptosKey: 'K', name: 'N' })).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    expect(spy.callCount).toBe(0);
  });
});

describe('NebimV3RequestMapper — K1, K15, K17 kuralları', () => {
  it('D6 / K17: zorunlu kayıt parametreleri (storeCode, orderWarehouseCode) eksikken PostingDefaultsMissingError', () => {
    expect(() =>
      NebimV3RequestMapper.toInvoiceBody(sampleInvoice(), null, 'KRP-ORDER-1'),
    ).toThrow(PostingDefaultsMissingError);

    expect(() =>
      NebimV3RequestMapper.toInvoiceBody(sampleInvoice(), { storeCode: 'M1' }, 'KRP-ORDER-1'),
    ).toThrow(PostingDefaultsMissingError);

    // İkisi de tamken başarıyla oluşturulur
    const valid = NebimV3RequestMapper.toInvoiceBody(
      sampleInvoice(),
      { storeCode: 'M1', orderWarehouseCode: 'D1' },
      'KRP-ORDER-1',
    );
    expect(valid.storeCode).toBe('M1');
    expect(valid.orderWarehouseCode).toBe('D1');
  });

  it('K1 / K15: üretilen gövdelerde kimlik veya SessionID anahtarı sızmaz', () => {
    const inv = NebimV3RequestMapper.toInvoiceBody(
      sampleInvoice(),
      { storeCode: 'M1', orderWarehouseCode: 'D1' },
      'KRP-ORDER-1',
    );
    expect(findCredentialLeak(inv, NEBIM_V3_FORBIDDEN_BODY_KEYS)).toBeNull();

    const partner = NebimV3RequestMapper.toPartnerBody({
      companyId: '1',
      kroptosKey: 'K1',
      name: 'Test Cari',
      taxNumber: '1234567890',
    });
    expect(findCredentialLeak(partner, NEBIM_V3_FORBIDDEN_BODY_KEYS)).toBeNull();

    const receipt = NebimV3RequestMapper.toReceiptBody(
      {
        companyId: '1',
        invoiceExternalId: 'INV-1',
        referenceCode: 'REC-1',
        amount: 100,
        currency: 'TRY',
        paymentDate: '2026-09-14',
      },
      { storeCode: 'M1' },
      'REC-1',
    );
    expect(findCredentialLeak(receipt, NEBIM_V3_FORBIDDEN_BODY_KEYS)).toBeNull();
  });
});

describe('NebimV3ResponseMapper', () => {
  it('Connect yanıtından oturum varlığını doğrular', () => {
    const ok = NebimV3ResponseMapper.toTestConnectionResult(
      { SessionID: 'SESSION-XYZ', Status: 'Connection Created Successfully' },
      'V3_DB',
    );
    expect(ok.success).toBe(true);

    expect(() =>
      NebimV3ResponseMapper.toTestConnectionResult({ Status: 'Failed' }, 'V3_DB'),
    ).toThrow();
  });
});
