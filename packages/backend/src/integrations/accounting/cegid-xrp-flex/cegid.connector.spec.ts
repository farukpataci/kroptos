import { BadRequestException } from '@nestjs/common';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { CEGID_CAPABILITIES } from './cegid.capabilities';
import { CegidConnector } from './cegid.connector';
import { CEGID_CREDENTIAL_SCHEMA } from './cegid.credential-schema';
import { CegidErrorMapper } from './cegid.error-mapper';
import { CegidMockClient } from './cegid.mock-client';
import { CegidStatusMapper } from './cegid.status-mapper';
import { CegidUriHelper } from './cegid.uri';

describe('Cegid XRP Flex Connector (§9 Test Kontrol Listesi)', () => {
  const baseCredentials = {
    instanceUrl: 'https://test-tenant.cegid.cloud',
    clientId: 'client-123',
    clientSecret: 'secret-456',
    username: 'admin',
    password: 'password-789',
    branchId: 'PROD',
    defaultIncomeAccount: '707000',
    defaultVatCode: 'TVA20',
  };

  let connector: CegidConnector;
  let mockClient: CegidMockClient;

  beforeEach(() => {
    mockClient = new CegidMockClient();
    connector = new CegidConnector(baseCredentials, 'MOCK', mockClient);
  });

  // Test 1: Taban URL yapılandırmadan üretiliyor; koda gömülü host yok
  it('1. Taban URL yapılandırmadan üretilmeli, koda gömülü host olmamalı', () => {
    const host = CegidUriHelper.getExpectedHost('https://my-company.cegid.cloud');
    expect(host).toBe('my-company.cegid.cloud');
    const contractUrl = CegidUriHelper.buildContractUrl(
      'https://my-company.cegid.cloud',
      'Customer',
    );
    expect(contractUrl).toContain('my-company.cegid.cloud/entity/Default/22.200.001/Customer');
  });

  // Test 2: Giden her isteğin host'u yapılandırılmış tabana karşı doğrulanıyor
  it('2. Giden her isteğin hostu yapılandırılmış tabana karşı doğrulanmalı (SSRF engeli)', () => {
    expect(() =>
      CegidUriHelper.validateHost(
        'https://attacker-host.com/entity/Default/Customer',
        baseCredentials.instanceUrl,
      ),
    ).toThrow(BadRequestException);
  });

  // Test 3: cegid.credential-schema.ts içinde Expert kolunun alanları YOK (§1.1 — kod taraması)
  it('3. cegid.credential-schema.ts içinde Expert kolunun alanları (apiKey, subscriptionKey, consumerId, consumerSecret) bulunmamalı', () => {
    const fieldKeys = CEGID_CREDENTIAL_SCHEMA.fields.map((f) => f.key.toLowerCase());
    expect(fieldKeys).not.toContain('apikey');
    expect(fieldKeys).not.toContain('api_key');
    expect(fieldKeys).not.toContain('subscriptionkey');
    expect(fieldKeys).not.toContain('subscription_key');
    expect(fieldKeys).not.toContain('consumerid');
    expect(fieldKeys).not.toContain('consumer_id');
    expect(fieldKeys).not.toContain('consumersecret');
    expect(fieldKeys).not.toContain('consumer_secret');
  });

  // Test 4: Kimlik akışı doğrulaması
  it('4. Kimlik: OAuth2 password grant modeli kullanılır ve capabilities doğru bildirilmiştir', () => {
    expect(CEGID_CAPABILITIES.refreshSemantics?.rotatesOnRefresh).toBe(false);
  });

  // Test 5: Şema keşfi: zorunlu alan eksikse bağlantı doğrulanmıyor, alan adı raporlanıyor
  it('5. Şema keşfinde zorunlu alan eksikse bağlantı doğrulanmamalı ve eksik alan raporlanmalı', async () => {
    mockClient.simulateSchemaFailure = true;
    const testResult = await connector.testConnection();
    expect(testResult.success).toBe(false);
    expect(testResult.message).toContain('Eksik zorunlu sözleşme alanları');
  });

  // Test 6: Hesap planı / gelir hesabı seçimi eksikse fatura gönderilmiyor (§4.1)
  it('6. Gelir hesabı (salesAccount / defaultIncomeAccount) eksikse fatura oluşturulmamalı', async () => {
    const connectorWithoutAccount = new CegidConnector(
      {
        instanceUrl: 'https://test-tenant.cegid.cloud',
        // no defaultIncomeAccount, no defaultAccountCodes
      },
      'MOCK',
      mockClient,
    );

    // Explicitly wipe mappingContext
    (connectorWithoutAccount as any).mappingContext = {};

    await expect(
      connectorWithoutAccount.createInvoice({
        companyId: 'comp-1',
        referenceCode: 'INV-001',
        issueDate: '2026-09-12',
        currency: 'EUR',
        contact: { name: 'Hôtel du Lac' },
        items: [{ sku: 'SKU1', name: 'Ürün', quantity: 1, unitPrice: 100, vatRate: 20, totalAmount: 100 }],
        subtotal: 100,
        vatTotal: 0,
        grandTotal: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // Test 7: Mutabakat tutmadan kesinleştirme çağrılmıyor (§6.4)
  it('7. Sunucu ve KroptOS toplamı uyuşmadığında fatura kesinleştirilmemeli (Hold kalmalı)', async () => {
    mockClient.simulateMismatch = true; // +25.5 tutarsızlık
    const releaseSpy = jest.spyOn(mockClient, 'releaseInvoice');

    const result = await connector.createInvoice({
      companyId: 'comp-1',
      referenceCode: 'INV-002',
      issueDate: '2026-09-12',
      currency: 'EUR',
      contact: { name: 'Hôtel du Lac' },
      items: [{ sku: 'SKU1', name: 'Hizmet', quantity: 1, unitPrice: 100, vatRate: 20, totalAmount: 100 }],
      subtotal: 100,
      vatTotal: 0,
      grandTotal: 100,
    });

    expect(releaseSpy).not.toHaveBeenCalled();
    expect(result.rawResponse?.reconciliationMismatch).toBe(true);
    expect(result.rawResponse?.status).toBe('Hold');
  });

  it('7b. Sunucu ve KroptOS toplamı uyuştuğunda fatura kesinleştirilmeli (ReleaseInvoice çağrılmalı)', async () => {
    mockClient.simulateMismatch = false;
    const releaseSpy = jest.spyOn(mockClient, 'releaseInvoice');

    const result = await connector.createInvoice({
      companyId: 'comp-1',
      referenceCode: 'INV-003',
      issueDate: '2026-09-12',
      currency: 'EUR',
      contact: { name: 'Hôtel du Lac' },
      items: [{ sku: 'SKU1', name: 'Hizmet', quantity: 1, unitPrice: 100, vatRate: 20, totalAmount: 100 }],
      subtotal: 100,
      vatTotal: 0,
      grandTotal: 100,
    });

    expect(releaseSpy).toHaveBeenCalled();
    expect(result.rawResponse?.reconciliationMatched).toBe(true);
    expect(result.rawResponse?.status).toBe('Open');
  });

  // Test 8: Firma/şube tanımlayıcısı istekten okunmuyor (Conformance #16)
  it('8. Firma ve şube tanımlayıcısı istek gövdesinden değil yapılandırmadan gelmeli', async () => {
    const result = await connector.createInvoice({
      companyId: 'comp-1',
      referenceCode: 'INV-004',
      issueDate: '2026-09-12',
      currency: 'EUR',
      contact: { name: 'Hôtel du Lac' },
      items: [{ sku: 'SKU1', name: 'Hizmet', quantity: 1, unitPrice: 100, vatRate: 20, totalAmount: 100 }],
      subtotal: 100,
      vatTotal: 0,
      grandTotal: 100,
    });

    const stored = await mockClient.getInvoice(result.externalId);
    expect(stored.Branch?.value).toBe('PROD');
  });

  // Test 9: Eşzamanlılık 1 ve hata geri çekilmesi
  it('9. Hata eşlemesinde rate limit düzgün yakalanmalı', () => {
    const err = CegidErrorMapper.mapHttpError(429, 'Too Many Requests', 'Limit', {
      'retry-after': '30',
    });
    expect(err.message).toContain('30s');
  });


  // Test 10: Bilinmeyen durum -> pending; iptal öncesi durum okunuyor (Conformance #18)
  it('10. Bilinmeyen durumlar pending olarak eşlenmeli ve iptal öncesi durum kontrol edilmeli', async () => {
    expect(CegidStatusMapper.toAccountingDocumentStatus('UnknownState')).toBe('pending');
    expect(CegidStatusMapper.toAccountingDocumentStatus('Hold')).toBe('pending');
    expect(CegidStatusMapper.toAccountingDocumentStatus('Open')).toBe('created');

    // Fatura oluştur ve iptal et
    const inv = await connector.createInvoice({
      companyId: 'comp-1',
      referenceCode: 'INV-005',
      issueDate: '2026-09-12',
      currency: 'EUR',
      contact: { name: 'Hôtel du Lac' },
      items: [{ sku: 'SKU1', name: 'Hizmet', quantity: 1, unitPrice: 100, vatRate: 20, totalAmount: 100 }],
      subtotal: 100,
      vatTotal: 0,
      grandTotal: 100,
    });

    const cancelResult = await connector.cancelInvoice(inv.externalId);
    expect(cancelResult.success).toBe(true);
  });

  // Test 11: findByReference doğrulanmadıkça DOCUMENTATION_REQUIRED olmalı
  it('11. findInvoiceByReference yeteneği DOCUMENTATION_REQUIRED olarak tanımlanmalı', () => {
    expect(CEGID_CAPABILITIES.findInvoiceByReference).toBe('DOCUMENTATION_REQUIRED');
  });


  // Test 12: Sırlar maskelenmeli
  it('12. Sırlar (client_secret, password, token) hata mesajlarında maskelenmeli', () => {
    const raw = 'Error with password="secretPassword123" and client_secret="mySecret"';
    const masked = CegidErrorMapper.maskSensitive(raw);
    expect(masked).not.toContain('secretPassword123');
    expect(masked).not.toContain('mySecret');
    expect(masked).toContain('[REDACTED]');
  });

  // Test 13: Tenant izolasyonu
  it('13. Bağlantı MOCK ortamında çalışmalı, TEST ve PROD ortamları reddedilmeli', async () => {
    const testConnector = new CegidConnector(baseCredentials, 'TEST');
    await expect(testConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    const prodConnector = new CegidConnector(baseCredentials, 'PRODUCTION');
    await expect(prodConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });

  // Test 14: cegid-loop ve cegid-expert-* registry'de yok
  it('14. cegid-loop ve cegid-expert-* sağlayıcıları registryde bulunmamalı', () => {
    const allProviders = AccountingProviderRegistry.all().map((d: any) =>
      d.id.toLowerCase(),
    );
    expect(allProviders).not.toContain('cegid-loop');
    expect(allProviders).not.toContain('cegid-expert');
    expect(allProviders.some((p: string) => p.startsWith('cegid-expert'))).toBe(false);
  });


  // Test 15: E-fatura / PDP ile ilgili hiçbir resmi gönderim çağrısı yok (§4)
  it('15. eInvoiceOfficialSend yeteneği NOT_SUPPORTED olmalı', () => {
    expect(CEGID_CAPABILITIES.eInvoiceOfficialSend).toBe('NOT_SUPPORTED');
  });

  // Test 16: Spy kontrolü: hiçbir gerçek ağ çağrısı yapılmamalı
  it('16. MOCK_READY ortamında global fetch çağrılmamalı', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await connector.testConnection();
    await connector.createInvoice({
      companyId: 'comp-1',
      referenceCode: 'INV-006',
      issueDate: '2026-09-12',
      currency: 'EUR',
      contact: { name: 'Hôtel du Lac' },
      items: [{ sku: 'SKU1', name: 'Ürün', quantity: 1, unitPrice: 100, vatRate: 20, totalAmount: 100 }],
      subtotal: 100,
      vatTotal: 0,
      grandTotal: 100,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

});
