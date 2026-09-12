import { PennylaneConnector } from './pennylane.connector';
import { PennylaneMockClient } from './pennylane.mock-client';
import { PennylaneHttpClient } from './pennylane.client';
import { PennylaneSerializer } from './pennylane.serialize';
import { PennylaneWindowLimiter } from './pennylane.window-limiter';
import { PennylaneStatusMapper } from './pennylane.status-mapper';
import { PennylaneErrorMapper } from './pennylane.error-mapper';
import {
  AccountingInvoiceRequest,
  CapabilityStatus,
} from '../core/AccountingTypes';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';

describe('Pennylane Connector (§9 Test Kontrol Listesi - 17 Senaryo)', () => {
  const baseCredentials = {
    apiToken: 'test_token_pennylane_sec_12345',
    baseUrl: 'https://app.pennylane.com/api/external/v2/',
    defaultVatRate: 'FR_200',
  };

  const sampleInvoiceRequest: AccountingInvoiceRequest = {
    companyId: 'comp_1',
    referenceCode: 'KROP-INV-9901',
    issueDate: '2026-09-12',
    dueDate: '2026-10-12',
    currency: 'EUR',
    subtotal: 100.0,
    vatTotal: 20.0,
    grandTotal: 120.0,
    contact: {
      id: 'CUST-DUPONT',
      name: 'Société Dupont SAS',
      taxNumber: 'FR12345678901',
      email: 'dupont@example.fr',
      city: 'Paris',
    },
    items: [
      {
        sku: 'SKU-DANISMANLIK',
        name: 'Prestation Informatique',
        quantity: 1,
        unitPrice: 100.0,
        vatRate: 20,
        totalAmount: 120.0,
      },
    ],
  };

  // Test 1: Her fatura oluşturma isteğinde draft: true var (§5.1, §9.1)
  it('1. Her fatura oluşturma isteğinde draft: true açıkça gönderilmeli', async () => {
    const mockClient = new PennylaneMockClient();
    const createSpy = jest.spyOn(mockClient, 'createInvoice');
    const finalizeSpy = jest.spyOn(mockClient, 'finalizeInvoice');

    const connector = new PennylaneConnector(baseCredentials, 'MOCK', mockClient);
    const result = await connector.createInvoice(sampleInvoiceRequest);

    expect(createSpy).toHaveBeenCalled();
    const payload = createSpy.mock.calls[0][0];
    expect(payload.draft).toBe(true);
    expect(finalizeSpy).toHaveBeenCalled();
    expect(result.externalId).toBeDefined();
    expect(result.externalNumber).toBe('INV-2026-2001');
    expect(result.rawResponse?.draft).toBe(false);
  });

  // Test 2: Mutabakat tutmadan kesinleştirme çağrılmıyor (§5.1, §9.2)
  it('2. Mutabakat uyuşmazlığında kesinleştirme çağrılmamalı, taslakta bırakılmalı', async () => {
    const mockClient = new PennylaneMockClient();
    mockClient.simulateMismatch = true; // Fark yarat
    const finalizeSpy = jest.spyOn(mockClient, 'finalizeInvoice');

    const connector = new PennylaneConnector(baseCredentials, 'MOCK', mockClient);
    const result = await connector.createInvoice(sampleInvoiceRequest);

    expect(finalizeSpy).not.toHaveBeenCalled();
    expect(result.rawResponse?.draft).toBe(true); // Taslakta kaldı
    expect(result.rawResponse?.discrepancy).toBe(true);
  });

  // Test 3: raw_currency_unit_price ve diğer ondalıklı alanlar string tipinde (§5.2, §9.3)
  it('3. raw_currency_unit_price giden istekte string tipinde olmalı, sayı gönderilirse reddedilmeli', async () => {
    const mockClient = new PennylaneMockClient();
    const createSpy = jest.spyOn(mockClient, 'createInvoice');

    const connector = new PennylaneConnector(baseCredentials, 'MOCK', mockClient);
    await connector.createInvoice(sampleInvoiceRequest);

    const payload = createSpy.mock.calls[0][0];
    expect(payload.invoice_lines).toBeDefined();
    for (const line of payload.invoice_lines) {
      expect(typeof line.raw_currency_unit_price).toBe('string');
    }

    // Doğrudan sayı tipi verilirse hata fırlatmalı
    expect(() =>
      PennylaneSerializer.assertLinePriceIsString({
        raw_currency_unit_price: 100.0 as any,
      }),
    ).toThrow();
  });

  // Test 4: Biçimlendirme yalnızca pennylane.serialize.ts üzerinden (§5.2, §9.4)
  it('4. Parasal biçimlendirme tek merkezden yapılmalı', () => {
    expect(PennylaneSerializer.formatMonetary(50)).toBe('50.00');
    expect(PennylaneSerializer.formatMonetary('12.34')).toBe('12.34');
    expect(PennylaneSerializer.formatQuantity(3)).toBe('3.00');
  });

  // Test 5: KDV oranı vat_rate koduna eşlenemiyorsa fatura gönderilmiyor (§5.4, §9.5)
  it('5. KDV oranı eşlenemediğinde fatura gönderilmemeli, açık hata fırlatılmalı', async () => {
    const connector = new PennylaneConnector(baseCredentials, 'MOCK');
    const invalidRequest = {
      ...sampleInvoiceRequest,
      items: [
        {
          sku: 'SKU-ERR',
          name: 'Ürün',
          quantity: 1,
          unitPrice: 100,
          vatRate: 18, // Fransa'da %18 KDV yoktur
          totalAmount: 118,
        },
      ],
    };

    await expect(connector.createInvoice(invalidRequest)).rejects.toThrow(
      'Pennylane KDV eşleme hatası',
    );
  });

  // Test 6: Pencere tabanlı limit: 5 saniyede 25 istek geçiyor, 26. bekletiliyor (§5.3, §9.6)
  it('6. 5 saniyede 25 istek geçmeli, 26. istek bekletilmeli', async () => {
    let virtualTime = 500000;
    const delays: number[] = [];
    const limiter = new PennylaneWindowLimiter({
      windowMs: 5000,
      maxRequests: 25,
      nowFn: () => virtualTime,
      sleepFn: async (ms) => {
        delays.push(ms);
        virtualTime += ms;
      },
    });

    await limiter.acquire(); // t=500_000
    virtualTime = 500500;
    for (let i = 1; i < 25; i++) {
      await limiter.acquire();
    }

    expect(limiter.canPassImmediately()).toBe(false);
    await limiter.acquire(); // 26. istek
    expect(delays.length).toBe(1);
    expect(delays[0]).toBe(4500);
  });

  // Test 7: 429'da retry-after ve ratelimit-reset zaman damgasına uyuluyor (§9.7)
  it('7. 429 yanıtında retry-after ve ratelimit-reset başlıkları doğru yorumlanmalı', () => {
    expect(PennylaneWindowLimiter.computeRetryWaitMs('3', null, 1)).toBe(3000);
    const nowSec = Math.floor(Date.now() / 1000);
    const wait = PennylaneWindowLimiter.computeRetryWaitMs(null, String(nowSec + 4), 1);
    expect(wait).toBeGreaterThanOrEqual(3000);
    expect(wait).toBeLessThanOrEqual(5000);
  });

  // Test 8: v1 yolu hiçbir istekte üretilmiyor (§2.1, §9.8)
  it('8. v1 yolu (/v1/) hiçbir istekte üretilmemeli, engellenmeli', () => {
    expect(
      () =>
        new PennylaneHttpClient({
          apiToken: 'tok',
          baseUrl: 'https://app.pennylane.com/api/external/v1/',
        }),
    ).toThrow('Pennylane API v1 tamamen emekliye ayrılmıştır');
  });

  // Test 9: Fatura ile birlikte müşteri yaratma denemesi yok, v2 ayrı oluşturur (§2.2, §9.9)
  it('9. Müşteri faturayla birlikte değil, öncesinde bağımsız oluşturulmalı', async () => {
    const mockClient = new PennylaneMockClient();
    const custSpy = jest.spyOn(mockClient, 'createCustomer');
    const invSpy = jest.spyOn(mockClient, 'createInvoice');

    const connector = new PennylaneConnector(baseCredentials, 'MOCK', mockClient);
    await connector.createInvoice(sampleInvoiceRequest);

    expect(custSpy).toHaveBeenCalled();
    expect(invSpy).toHaveBeenCalled();
    const invPayload = invSpy.mock.calls[0][0];
    expect(typeof invPayload.customer_id).toBe('number');
    expect((invPayload as any).customer).toBeUndefined();
  });

  // Test 10: external_reference her faturada KroptOS referansıyla dolu (§5.5, §9.10)
  it('10. external_reference her faturada KroptOS referansıyla gönderilmeli', async () => {
    const mockClient = new PennylaneMockClient();
    const invSpy = jest.spyOn(mockClient, 'createInvoice');

    const connector = new PennylaneConnector(baseCredentials, 'MOCK', mockClient);
    await connector.createInvoice(sampleInvoiceRequest);

    const invPayload = invSpy.mock.calls[0][0];
    expect(invPayload.external_reference).toBe('KROP-INV-9901');
  });

  // Test 11: findByReference doğrulanmadıkça DOCUMENTATION_REQUIRED (§5.5, §9.11)
  it('11. findInvoiceByReference yeteneği DOCUMENTATION_REQUIRED olarak tanımlanmalı', () => {
    const connector = new PennylaneConnector(baseCredentials, 'MOCK');
    expect(connector.capabilities.findInvoiceByReference).toBe(
      CapabilityStatus.DOCUMENTATION_REQUIRED,
    );
  });

  // Test 12: Cursor sayfalama kullanılıyor (§2.2, §9.12)
  it('12. Cursor sayfalama desteklenmeli', async () => {
    const mockClient = new PennylaneMockClient();
    const listRes = await mockClient.listInvoices();
    expect(listRes).toHaveProperty('items');
    expect(listRes).toHaveProperty('has_more');
    expect(listRes).toHaveProperty('next_cursor');
  });

  // Test 13: E-fatura içe aktarma uçları çağrılmıyor (§6, §9.13)
  it('13. Factur-X / e-fatura içe aktarma uçları çağrılamamalı, engellenmeli', async () => {
    const client = new PennylaneHttpClient({
      apiToken: 'test_token',
      fetchFn: jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as any),
    });

    await expect(
      (client as any).request('POST', 'customer_invoices/e_invoices/imports', {}),
    ).rejects.toThrow('kapsam dışıdır');
  });

  // Test 14: Bilinmeyen durum -> pending; iptal öncesi durum okunuyor (§7, §9.14, Conformance #18)
  it('14. Bilinmeyen durum pending olmalı; taslak silinebilmeli, kesinleşmiş fatura silinememeli', async () => {
    expect(PennylaneStatusMapper.toAccountingDocumentStatus('unknown_status', false)).toBe(
      'pending',
    );

    const mockClient = new PennylaneMockClient();
    const connector = new PennylaneConnector(baseCredentials, 'MOCK', mockClient);

    // 1. Taslak fatura oluştur
    const inv = await mockClient.createInvoice({
      customer_id: 1,
      date: '2026-09-12',
      deadline: '2026-10-12',
      draft: true,
      invoice_lines: [
        {
          label: 'Test',
          quantity: 1,
          raw_currency_unit_price: '50.00',
          vat_rate: 'FR_200',
        },
      ],
    });

    // Taslakken doğrudan silinebilmeli (DIRECT_DELETE)
    const cancelRes = await connector.cancelInvoice(String(inv.id));
    expect(cancelRes.success).toBe(true);
    expect(cancelRes.cancellationType).toBe('voided');

    // 2. Kesinleşmiş fatura oluştur
    const inv2 = await mockClient.createInvoice({
      customer_id: 1,
      date: '2026-09-12',
      deadline: '2026-10-12',
      draft: true,
      invoice_lines: [
        {
          label: 'Test',
          quantity: 1,
          raw_currency_unit_price: '50.00',
          vat_rate: 'FR_200',
        },
      ],
    });
    await mockClient.finalizeInvoice(inv2.id);

    // Kesinleştiği için doğrudan silme reddedilmeli
    await expect(connector.cancelInvoice(String(inv2.id))).rejects.toThrow(
      'kesinleştirilmiştir',
    );
  });

  // Test 15: Token / sır maskeleme (§9.15)
  it('15. Hata mesajlarında Bearer token ve apiToken maskelenmeli', () => {
    const raw = 'Auth error with Bearer secret_pennylane_token_abc and "apiToken":"my_secret"';
    const masked = PennylaneErrorMapper.maskSensitive(raw);
    expect(masked).not.toContain('secret_pennylane_token_abc');
    expect(masked).not.toContain('my_secret');
    expect(masked).toContain('[REDACTED]');
  });

  // Test 16: Tenant izolasyonu
  it('16. MOCK ortamında testConnection başarılı olmalı, TEST ve PROD reddedilmeli (§9.16)', async () => {
    const mockConnector = new PennylaneConnector(baseCredentials, 'MOCK');
    const res = await mockConnector.testConnection();
    expect(res.success).toBe(true);

    const testConnector = new PennylaneConnector(baseCredentials, 'TEST');
    await expect(testConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );

    const prodConnector = new PennylaneConnector(baseCredentials, 'PRODUCTION');
    await expect(prodConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });

  // Test 17: Bu turda hiçbir client gerçek ağ isteği yapmıyor (§9.17)
  it('17. TEST ve PROD ortamlarında tüm metodlar IntegrationNotVerifiedError fırlatmalı', async () => {
    const testConnector = new PennylaneConnector(baseCredentials, 'TEST');
    await expect(testConnector.createInvoice(sampleInvoiceRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );

    const prodConnector = new PennylaneConnector(baseCredentials, 'PRODUCTION');
    await expect(prodConnector.createInvoice(sampleInvoiceRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });
});
