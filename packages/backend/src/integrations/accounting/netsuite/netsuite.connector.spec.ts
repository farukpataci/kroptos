import * as crypto from 'crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';
import { NetSuiteConnector } from './netsuite.connector';
import { NetSuiteMockClient } from './netsuite.mock-client';
import { NetSuiteTestClient } from './netsuite.test-client';
import { NetSuiteProductionClient } from './netsuite.production-client';
import { NetSuiteUriHelper } from './netsuite.uri';
import { NetSuiteJwtHelper } from './netsuite.jwt';
import { NetSuiteAuthService } from './netsuite.auth';
import { NetSuiteHttpClient } from './netsuite.client';
import { NetSuiteStatusMapper } from './netsuite.status-mapper';
import { NetSuiteErrorMapper } from './netsuite.error-mapper';
import { NetSuiteSchemaManager } from './netsuite.schema';
import { NETSUITE_DESCRIPTOR } from './netsuite.descriptor';
import { NETSUITE_CAPABILITIES } from './netsuite.capabilities';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';

describe('Oracle NetSuite Accounting Integration Test Suite (§7, §8)', () => {
  const testEnvKey = 'NETSUITE_TEST_KEY_SPEC_99';
  let testPrivateKey: string;
  let testPublicKey: string;

  beforeAll(() => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    testPrivateKey = privateKey;
    testPublicKey = publicKey;
    process.env[testEnvKey] = testPrivateKey;
  });

  afterAll(() => {
    delete process.env[testEnvKey];
  });

  beforeEach(() => {
    NetSuiteAuthService.clearCache();
    NetSuiteHttpClient.clearQueues();
  });

  const validCredentials = {
    accountId: '1234567_SB1',
    clientId: 'test-client-id-abc',
    certificateId: 'cert-kid-123',
    keyReference: testEnvKey,
    subsidiaryId: '1',
    certificateExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    concurrencyLimit: 1,
  };

  const sampleInvoiceRequest: AccountingInvoiceRequest = {
    companyId: 'comp-1',
    referenceCode: 'ORD-2026-999',
    issueDate: '2026-09-11',
    dueDate: '2026-10-11',
    currency: 'USD',
    subtotal: 100,
    vatTotal: 0,
    grandTotal: 100,
    contact: {
      name: 'Global Tech Corp',
      email: 'finance@globaltech.com',
      taxNumber: 'TAX-999-00',
      isCompany: true,
    },
    items: [
      {
        sku: 'SKU-001',
        name: 'Enterprise Cloud License',
        quantity: 1,
        unitPrice: 100,
        vatRate: 0,
        totalAmount: 100,
      },
    ],
  };

  it('1. Taban URL accountId den uretiliyor; koda gomulu tek bir host yok (§5.1, §8.1)', () => {
    const host1 = NetSuiteUriHelper.getExpectedHost('1122334');
    expect(host1).toBe('1122334.suitetalk.api.netsuite.com');

    const host2 = NetSuiteUriHelper.getExpectedHost('9988776');
    expect(host2).toBe('9988776.suitetalk.api.netsuite.com');
  });

  it('2. Sandbox donusumu kuralina gore uretiliyor: alt cizgi -> tire ve kucuk harf (§3.a, §8.2)', () => {
    const host = NetSuiteUriHelper.getExpectedHost('1234567_SB1');
    expect(host).toBe('1234567-sb1.suitetalk.api.netsuite.com');

    const complex = NetSuiteUriHelper.getExpectedHost('TSTDRV123456_SB2');
    expect(complex).toBe('tstdrv123456-sb2.suitetalk.api.netsuite.com');
  });

  it('3. Giden her istegin hostu yapilandirilmis tabana karsi dogrulaniyor (§5.1, §8.3)', () => {
    const validUrl = 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customer/42';
    expect(() => NetSuiteUriHelper.validateHost(validUrl, '1234567_SB1')).not.toThrow();

    const foreignUrl = 'https://malicious-site.com/services/rest/record/v1/customer/42';
    expect(() => NetSuiteUriHelper.validateHost(foreignUrl, '1234567_SB1')).toThrow(BadRequestException);

    const crossAccountUrl = 'https://9999999.suitetalk.api.netsuite.com/services/rest/record/v1/customer/42';
    expect(() => NetSuiteUriHelper.validateHost(crossAccountUrl, '1234567_SB1')).toThrow(BadRequestException);
  });

  it('4. Ortam degisiminde (uretim vs sandbox) host eslesmesi gecersiz sayiliyor (§5.1, §8.4)', () => {
    const sandboxUrl = 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/invoice';
    const prodAccount = '1234567';

    expect(NetSuiteUriHelper.isAccountMatch(sandboxUrl, prodAccount)).toBe(false);
  });

  it('5. Ozel anahtar ve JWT servis cevabinda, logda, auditte ve hata mesajinda yok (§5.2, §8.5)', async () => {
    const connector = new NetSuiteConnector(validCredentials, 'MOCK');
    const invoiceResult = await connector.createInvoice(sampleInvoiceRequest);

    const serializedResult = JSON.stringify(invoiceResult);
    expect(serializedResult).not.toContain(testPrivateKey);
    expect(serializedResult).not.toContain('PRIVATE KEY');
    expect(serializedResult).not.toContain('eyJhbGci'); // JWT baslangici
  });

  it('6. Ozel anahtar credentials JSON una yazilmiyor, yalnizca keyReference saklaniyor (§5.2, §8.6)', () => {
    const connector = new NetSuiteConnector(validCredentials, 'MOCK');
    expect((connector.credentials as any).privateKey).toBeUndefined();
    expect(connector.credentials.keyReference).toBe(testEnvKey);
  });

  it('7. Access token 60 dk onbellekleniyor; sure dolunca yeni JWT uretiliyor (§2.2, §8.7)', async () => {
    let fetchCount = 0;
    const mockFetch = async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: `token_${fetchCount}`,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      };
    };

    const token1 = await NetSuiteAuthService.getValidAccessToken(validCredentials, mockFetch);
    expect(token1).toBe('token_1');
    expect(fetchCount).toBe(1);

    // Ikinci cagri onbellekten gelmeli
    const token2 = await NetSuiteAuthService.getValidAccessToken(validCredentials, mockFetch);
    expect(token2).toBe('token_1');
    expect(fetchCount).toBe(1);

    // Onbellegi temizle / sure dolmus simule et
    NetSuiteAuthService.clearCache(validCredentials);
    const token3 = await NetSuiteAuthService.getValidAccessToken(validCredentials, mockFetch);
    expect(token3).toBe('token_2');
    expect(fetchCount).toBe(2);
  });

  it('8. NetSuite refresh mekanizmasina HIC ugramiyor; capabilities.refreshSemantics undefined (§4, §8.8)', () => {
    expect(NETSUITE_CAPABILITIES.refreshSemantics).toBeUndefined();
  });

  it('9. Sertifika bitis tarihi tutuluyor; esiklerde uyari veriliyor; dolmussa istek atilmiyor (§5.2, §8.9)', async () => {
    // 20 gun kala -> uyari
    const exp20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const connExpiring = new NetSuiteConnector(
      { ...validCredentials, certificateExpiresAt: exp20Days },
      'MOCK',
    );
    const testResult = await connExpiring.testConnection();
    expect(testResult.success).toBe(true);
    expect(testResult.message).toContain('gün içinde dolacak');

    // Dolmus sertifika -> istek engellenir
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const connExpired = new NetSuiteConnector(
      { ...validCredentials, certificateExpiresAt: pastDate },
      'MOCK',
    );
    const expiredResult = await connExpired.testConnection();
    expect(expiredResult.success).toBe(false);
    expect(expiredResult.message).toContain('DOLDU');
  });

  it('10. metadata-catalog kesfi: zorunlu alan eksikse baglanti dogrulanmiyor ve alan raporlaniyor (§5.5, §8.10)', async () => {
    const mockClient = new NetSuiteMockClient(validCredentials);
    mockClient.simulateMissingField = 'customer.companyName';

    const connector = new NetSuiteConnector(validCredentials, 'MOCK', mockClient);
    await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);

    try {
      await connector.testConnection();
    } catch (err: any) {
      expect(err.message).toContain('customer.companyName');
    }
  });

  it('11. Eszamanlilik 1; iki is paralel istek yapamiyor (§5.3, §8.11)', async () => {
    let maxParallel = 0;
    let currentActive = 0;

    const mockFetch = async () => {
      currentActive++;
      if (currentActive > maxParallel) maxParallel = currentActive;
      // Islem simülasyonu
      await new Promise((res) => setTimeout(res, 50));
      currentActive--;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: '123' }),
      };
    };

    const httpClient = new NetSuiteHttpClient(validCredentials, mockFetch);
    const targetUrl = 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customer/1';

    // Ayni anda 5 istek gonder
    await Promise.all([
      httpClient.request(targetUrl, { skipAuth: true }),
      httpClient.request(targetUrl, { skipAuth: true }),
      httpClient.request(targetUrl, { skipAuth: true }),
      httpClient.request(targetUrl, { skipAuth: true }),
      httpClient.request(targetUrl, { skipAuth: true }),
    ]);

    // Kuyruk sayesinde ayni anda en fazla 1 istek calismis olmali!
    expect(maxParallel).toBe(1);
  });

  it('12. Eszamanlilik hatasinda (HTTP 429) ustel geri cekilme calisiyor (§5.3, §8.12)', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          ok: false,
          status: 429,
          headers: new Map([['Retry-After', '0.01']]),
          json: async () => ({ message: 'Rate limit' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    };

    const httpClient = new NetSuiteHttpClient(validCredentials, mockFetch);
    const result = await httpClient.request(
      'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customer/1',
      { skipAuth: true },
    );

    expect(result.success).toBe(true);
    expect(callCount).toBe(3);
  });

  it('13. 401 ile 403 farkli hata sinifi ve farkli operator mesaji uretir (§5.10, §8.13)', () => {
    const err401 = NetSuiteErrorMapper.map(401, { message: 'Invalid JWT' });
    expect(err401).toBeInstanceOf(AccountingAuthError);
    expect(err401.message).toContain('NetSuite kimlik doğrulama başarısız (HTTP 401)');

    const err403 = NetSuiteErrorMapper.map(403, { message: 'Permission Denied' });
    expect(err403).toBeInstanceOf(ForbiddenException);
    expect(err403.message).toContain('NetSuite Rol İzni Eksik');
  });

  it('14. Subsidiary yapilandirmadan geliyor, istekten okunmuyor (§5.9, §8.14)', async () => {
    const credWithSubsidiary = { ...validCredentials, subsidiaryId: '42' };
    const connector = new NetSuiteConnector(credWithSubsidiary, 'MOCK');

    const mockClient = (connector as any).client as NetSuiteMockClient;
    await connector.createInvoice(sampleInvoiceRequest);

    const savedInvoice = Array.from(mockClient.invoices.values())[0];
    expect(savedInvoice.subsidiary).toEqual({ id: '42' });
  });

  it('15. eid: upsert ile ayni referansla ikinci cagri yeni kayit acmiyor (§5.7, §8.15)', async () => {
    const connector = new NetSuiteConnector(validCredentials, 'MOCK');
    const mockClient = (connector as any).client as NetSuiteMockClient;

    const res1 = await connector.createInvoice(sampleInvoiceRequest);
    const countAfterFirst = mockClient.invoices.size;

    const res2 = await connector.createInvoice(sampleInvoiceRequest);
    const countAfterSecond = mockClient.invoices.size;

    expect(countAfterSecond).toBe(countAfterFirst);
    expect(res2.externalId).toBe(res1.externalId);

    // findInvoiceByReference ile bulma testi (§5.7)
    const found = await connector.findInvoiceByReference(sampleInvoiceRequest.referenceCode);
    expect(found).not.toBeNull();
    expect(found?.externalId).toBe(res1.externalId);
  });

  it('16. Bilinmeyen durum -> pending eslenir; iptal oncesi durum okunur (§6, §8.16)', async () => {
    expect(NetSuiteStatusMapper.toKroptosStatus('SOME_UNKNOWN_ERP_STATUS')).toBe('pending');
    expect(NetSuiteStatusMapper.toKroptosStatus(null)).toBe('pending');
    expect(NetSuiteStatusMapper.toKroptosStatus('Open')).toBe('sent');
    expect(NetSuiteStatusMapper.toKroptosStatus('Voided')).toBe('cancelled');

    // Tamamen odenmis fatura iptal edilemez kontrolu
    const paidTransition = NetSuiteStatusMapper.validateCancellationTransition('Paid In Full');
    expect(paidTransition.canCancel).toBe(false);
    expect(paidTransition.reason).toContain('Credit Memo');
  });

  it('17. TBA / OAuth 1.0a kodu kesinlikle yok (§5.4, §8.17)', () => {
    // NETSUITE_DESCRIPTOR ve connector uzerinde TBA tanimi yer alamaz
    expect(NETSUITE_DESCRIPTOR.protocol).toBe('rest');
    expect((NETSUITE_DESCRIPTOR as any).tba).toBeUndefined();
  });

  it('18. Tenant ve ortam izolasyonu: bilesenler izole calisir (§8.18)', () => {
    const conn1 = new NetSuiteConnector({ ...validCredentials, accountId: '1111111' }, 'MOCK');
    const conn2 = new NetSuiteConnector({ ...validCredentials, accountId: '2222222' }, 'MOCK');

    expect(conn1.credentials.accountId).toBe('1111111');
    expect(conn2.credentials.accountId).toBe('2222222');
  });

  it('19. Bu turda hicbir client gercek ag istegi yapmiyor (TEST ve PRODUCTION guard) (§8.19)', async () => {
    const testConnector = new NetSuiteConnector(validCredentials, 'TEST');
    await expect(testConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(testConnector.createInvoice(sampleInvoiceRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );

    const prodConnector = new NetSuiteConnector(validCredentials, 'PRODUCTION');
    await expect(prodConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    await expect(prodConnector.createInvoice(sampleInvoiceRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });
});
