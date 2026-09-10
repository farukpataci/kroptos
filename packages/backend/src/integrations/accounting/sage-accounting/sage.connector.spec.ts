import { BadRequestException } from '@nestjs/common';
import {
  AccountingAmountMismatchError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingTokenStore } from '../core/AccountingTokenStore';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { SageConnector } from './sage.connector';
import { SageErrorMapper } from './sage.error-mapper';
import { fetchAllSagePages } from './sage.pagination';
import { SageStatusMapper } from './sage.status-mapper';
import './sage.descriptor'; // register into registry

describe('SageConnector (§8 & §9 Mock and Integration Tests)', () => {
  let connector: SageConnector;
  let tokenStore: AccountingTokenStore;

  const validRequest: AccountingInvoiceRequest = {
    companyId: 'biz-sage-uk-01',
    referenceCode: 'ORD-2026-001',
    issueDate: '2026-09-10',
    dueDate: '2026-09-24',
    currency: 'GBP',
    contact: {
      name: 'Acme Retail Ltd',
      email: 'billing@acme.com',
      taxNumber: 'GB123456789',
    },
    items: [
      {
        sku: 'SKU-001',
        name: 'Wireless Mouse',
        quantity: 2,
        unitPrice: 50,
        vatRate: 20,
        totalAmount: 120, // 100 net + 20 tax = 120
      },
    ],
    subtotal: 100,
    vatTotal: 20,
    grandTotal: 120,
  };

  beforeEach(() => {
    tokenStore = new AccountingTokenStore();
    connector = new SageConnector(
      {
        businessId: 'biz-sage-uk-01',
        defaultLedgerAccountId: '4000',
        defaultTaxRateId: 'GB_STANDARD',
      },
      'MOCK',
      tokenStore,
    );
  });

  it('1. testConnection returns company details in MOCK', async () => {
    const res = await connector.testConnection();
    expect(res.success).toBe(true);
    expect(res.companyId).toBe('biz-sage-uk-01');
    expect(res.companyName).toBe('KroptOS UK Ltd');
    expect(res.environment).toBe('MOCK');
  });

  it('2. Fatura oluşturma ve tutar mutabakatı (§4.6 reconciliation)', async () => {
    const result = await connector.createInvoice(validRequest);
    expect(result.externalId).toMatch(/^inv-sage-/);
    expect(result.externalNumber).toBeDefined();
    expect(result.rawResponse).toBeDefined();
    expect(result.rawResponse?.total_amount).toBe(120);
  });

  it('3. Fatura tutar mutabakatı başarısız olursa (reconciliation mismatch) hata yükselir', async () => {
    const mismatchedRequest: AccountingInvoiceRequest = {
      ...validRequest,
      grandTotal: 999.99, // Mismatches Sage's calculated 120
    };

    await expect(connector.createInvoice(mismatchedRequest)).rejects.toThrow(
      AccountingAmountMismatchError,
    );
  });

  it('4. Gelir hesabı (defaultLedgerAccountId) seçilmemişse fatura gönderilmez (§6)', async () => {
    const unconfigured = new SageConnector(
      {
        businessId: 'biz-sage-uk-01',
        defaultTaxRateId: 'GB_STANDARD',
      },
      'MOCK',
      tokenStore,
    );

    await expect(unconfigured.createInvoice(validRequest)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('5. Vergi oranı (defaultTaxRateId) seçilmemişse fatura gönderilmez (§6)', async () => {
    const unconfigured = new SageConnector(
      {
        businessId: 'biz-sage-uk-01',
        defaultLedgerAccountId: '4000',
      },
      'MOCK',
      tokenStore,
    );

    await expect(unconfigured.createInvoice(validRequest)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('6. reference alanı boş bırakılamaz (§4.5 & §9 test 14)', async () => {
    const emptyRefRequest: AccountingInvoiceRequest = {
      ...validRequest,
      referenceCode: '   ',
    };

    await expect(connector.createInvoice(emptyRefRequest)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('7. Tahsilat akışı çağrıldığında IntegrationNotVerifiedError fırlatır (§4.7)', async () => {
    await expect(
      connector.recordPayment({
        companyId: 'biz-sage-uk-01',
        invoiceExternalId: 'inv-123',
        referenceCode: 'PAY-1',
        amount: 120,
        currency: 'GBP',
        paymentDate: '2026-09-10',
      }),
    ).rejects.toThrow(IntegrationNotVerifiedError);
  });

  it('8. TEST ve PRODUCTION ortamları kesinlikle ağ isteği yapmaz (IntegrationNotVerifiedError)', async () => {
    const testConnector = new SageConnector(
      { businessId: 'biz-1' },
      'TEST',
      tokenStore,
    );
    const prodConnector = new SageConnector(
      { businessId: 'biz-1' },
      'PRODUCTION',
      tokenStore,
    );

    await expect(testConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    await expect(prodConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    await expect(testConnector.createInvoice(validRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    await expect(prodConnector.createInvoice(validRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });

  it('9. §3.4 $next tam URL takip ediliyor; offset ile URL kurulmuyor', async () => {
    const pages: any[] = [
      {
        $total: 4,
        $page: 1,
        $itemsPerPage: 2,
        $next: 'https://api.accounting.sage.com/v3.1/sales_invoices?page=2',
        $items: [{ id: '1' }, { id: '2' }],
      },
      {
        $total: 4,
        $page: 2,
        $itemsPerPage: 2,
        $next: null,
        $items: [{ id: '3' }, { id: '4' }],
      },
    ];

    const visitedUrls: (string | undefined)[] = [];
    const fetchPage = jest.fn().mockImplementation(async (url?: string) => {
      visitedUrls.push(url);
      return url ? pages[1] : pages[0];
    });

    const items = await fetchAllSagePages(fetchPage);
    expect(items).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]);
    expect(visitedUrls).toEqual([
      undefined,
      'https://api.accounting.sage.com/v3.1/sales_invoices?page=2',
    ]);
  });

  it('10. §9 Rule 18: Bilinmeyen fatura durumu pending döner (asla sent veya cancelled olamaz)', () => {
    expect(SageStatusMapper.toKroptosStatus('DRAFT')).toBe('pending');
    expect(SageStatusMapper.toKroptosStatus('UNPAID')).toBe('sent');
    expect(SageStatusMapper.toKroptosStatus('PAID')).toBe('sent');
    expect(SageStatusMapper.toKroptosStatus('VOID')).toBe('cancelled');
    expect(SageStatusMapper.toKroptosStatus('FUTURE_UNKNOWN_STATUS')).toBe('pending');
    expect(SageStatusMapper.toKroptosStatus(null)).toBe('pending');
    expect(SageStatusMapper.toKroptosStatus('')).toBe('pending');
  });

  it('11. Rate limit 429 ve Retry-After başlığı doğru ayrıştırılır', () => {
    const headers = new Headers();
    headers.set('retry-after', '45');

    const parsed = SageErrorMapper.parseResponse(
      429,
      { $dataCode: 'RateLimitExceeded' },
      headers,
    );

    expect(parsed.statusCode).toBe(429);
    expect(parsed.dataCode).toBe('RateLimitExceeded');
    expect(parsed.retryAfterSeconds).toBe(45);
    expect(parsed.isTransient).toBe(true);

    const domainErr = SageErrorMapper.toDomainError(parsed);
    expect(domainErr.name).toBe('AccountingRateLimitExceededError');
  });

  it('12. Sağlayıcı ayrımı: sage-x3, sage-intacct, sage-200, sage-50 registryde YOK (§2 & §9 test 20)', () => {
    const allProviders = AccountingProviderRegistry.all();
    const providerIds = allProviders.map((p) => p.id);

    expect(providerIds).toContain('SAGE-ACCOUNTING');
    expect(AccountingProviderRegistry.get('sage-accounting')).toBeDefined();
    expect(providerIds).not.toContain('sage-x3');
    expect(providerIds).not.toContain('sage-intacct');
    expect(providerIds).not.toContain('sage-200');
    expect(providerIds).not.toContain('sage-50');
  });

  it('13. Yapılandırma listeleri (businesses, ledger_accounts, tax_rates) listelenebilir (§6)', async () => {
    const businesses = await connector.listBusinesses();
    expect(businesses.length).toBeGreaterThan(0);
    expect(businesses[0].id).toBe('biz-sage-uk-01');

    const accounts = await connector.listLedgerAccounts();
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0].id).toBe('4000');

    const taxRates = await connector.listTaxRates();
    expect(taxRates.length).toBeGreaterThan(0);
    expect(taxRates[0].id).toBe('GB_STANDARD');
  });
});
