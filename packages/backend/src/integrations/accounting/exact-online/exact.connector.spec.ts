import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import {
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
} from '../core/AccountingTypes';
import { ExactOnlineConnector } from './exact.connector';
import { ExactMockClient } from './exact.mock-client';
import { ExactBudgetManager } from './exact.budget';
import './index'; // Registry auto-registration

describe('ExactOnlineConnector (§8)', () => {
  let connector: ExactOnlineConnector;
  let mockClient: ExactMockClient;
  let budgetManager: ExactBudgetManager;

  const validInvoiceRequest: AccountingInvoiceRequest = {
    companyId: '100001',
    referenceCode: 'KROP-EXACT-001',
    issueDate: '2026-09-11',
    currency: 'EUR',
    contact: {
      name: 'Van der Meer Logistics B.V.',
      taxNumber: 'NL888888888B01',
      email: 'invoice@vandermeer.nl',
      city: 'Rotterdam',
      address: 'Wilhelminakade 1',
    },
    items: [
      {
        sku: 'SKU-001',
        name: 'Logistiek Dienst',
        quantity: 2,
        unitPrice: 100,
        vatRate: 21,
        totalAmount: 242,
      },
    ],
    subtotal: 200,
    vatTotal: 42,
    grandTotal: 242,
  };

  beforeEach(() => {
    budgetManager = new ExactBudgetManager(500);
    budgetManager.reset();
    mockClient = new ExactMockClient(budgetManager);
    connector = new ExactOnlineConnector(
      { country: 'NL', division: 100001 },
      'MOCK',
      mockClient,
    );
  });

  it('1. should be registered in AccountingProviderRegistry as EXACT-ONLINE', () => {
    expect(AccountingProviderRegistry.has('EXACT-ONLINE')).toBe(true);
    const desc = AccountingProviderRegistry.get('EXACT-ONLINE');
    expect(desc).toBeDefined();
    expect(desc?.displayName).toBe('Exact Online');
    expect(desc?.country).toBe('NL');
    expect(desc?.readiness).toBe('MOCK_READY');
  });

  it('2. should declare valid capabilities and 5th RefreshSemantics profile', () => {
    const desc = AccountingProviderRegistry.get('EXACT-ONLINE')!;
    expect(desc.capabilities.salesInvoice).toBe('MOCK_ONLY');
    expect(desc.capabilities.payment).toBe('MOCK_ONLY');
    expect(desc.capabilities.stockSync).toBe('NOT_SUPPORTED');
    expect(desc.capabilities.findInvoiceByReference).toBe('MOCK_ONLY');

    const semantics = desc.capabilities.refreshSemantics;
    expect(semantics).toBeDefined();
    expect(semantics?.rotatesOnRefresh).toBe(true);
    expect(semantics?.previousTokenGraceMs).toBe(0);
    expect(semantics?.inactivityLimitDays).toBe(30);
    expect(semantics?.earliestRefreshAfterMs).toBe(570_000);
  });

  it('3. should instantiate successfully in MOCK environment', () => {
    const conn = new ExactOnlineConnector({ country: 'NL' }, 'MOCK');
    expect(conn.environment).toBe('MOCK');
  });

  it('4. should reject TEST environment if supportsTest is false', async () => {
    const testConnector = new ExactOnlineConnector({ country: 'NL' }, 'TEST');
    await expect(testConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
  });

  it('5. should reject PRODUCTION environment if supportsProduction is false', async () => {
    const prodConnector = new ExactOnlineConnector({ country: 'NL' }, 'PRODUCTION');
    await expect(prodConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
  });

  it('6. testConnection returns success with division details in MOCK', async () => {
    const result = await connector.testConnection();
    expect(result.success).toBe(true);
    expect(result.companyId).toBe('100001');
    expect(result.message).toContain('Exact Online (NL) bağlantısı başarılı');
  });

  it('7. createInvoice should execute flow, sync contact, and reconcile amount', async () => {
    const result = await connector.createInvoice(validInvoiceRequest);
    expect(result.externalId).toBeDefined();
    expect(result.externalNumber).toBeDefined();

    const raw = result.rawResponse as any;
    expect(raw.AmountDC).toBe(242);
    expect(raw.YourRef).toBe('KROP-EXACT-001');
    expect(raw.reconciliation.isMatch).toBe(true);
  });

  it('8. recordPayment should record payment in MOCK environment', async () => {
    const paymentRequest: AccountingPaymentRequest = {
      companyId: '100001',
      invoiceExternalId: 'inv-guid-1234',
      referenceCode: 'PAY-001',
      amount: 242,
      currency: 'EUR',
      paymentDate: '2026-09-11',
    };

    const paymentResult = await connector.recordPayment(paymentRequest);
    expect(paymentResult.externalId).toBeDefined();
    expect(paymentResult.rawResponse?.status).toBe('recorded');
  });

  it('9. cancelInvoice reads current status first and cancels open invoice (§5.8 & Conformance Kural 18)', async () => {
    // Önce fatura oluştur
    const created = await connector.createInvoice(validInvoiceRequest);
    const invoiceId = created.externalId;

    // İptal et
    const cancelResult = await connector.cancelInvoice(invoiceId);
    expect(cancelResult.success).toBe(true);

    const raw = cancelResult.rawResponse as any;
    expect(raw.Description).toContain('[İPTAL EDİLDİ]');
  });

  it('10. findInvoiceByReference returns invoice matching YourRef', async () => {
    await connector.createInvoice(validInvoiceRequest);

    const found = await connector.findInvoiceByReference('KROP-EXACT-001');
    expect(found).not.toBeNull();
    expect(found?.externalId).toBeDefined();

    const notFound = await connector.findInvoiceByReference('NON-EXISTING-REF');
    expect(notFound).toBeNull();
  });
});
