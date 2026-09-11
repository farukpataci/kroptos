import {
  AccountingAmountMismatchError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import { FORTNOX_CAPABILITIES } from './fortnox.capabilities';
import { FortnoxConnector } from './fortnox.connector';
import { FortnoxErrorMapper } from './fortnox.error-mapper';
import { FortnoxMockClient } from './fortnox.mock-client';
import {
  FORTNOX_AUTHORIZED_SCOPES,
  FortnoxOAuthManager,
  FortnoxScope,
} from './fortnox.oauth';
import { FortnoxStatusMapper } from './fortnox.status-mapper';
import { FortnoxProductionClient } from './fortnox.production-client';
import { FortnoxTestClient } from './fortnox.test-client';

describe('FortnoxConnector (§7, §8 MOCK_READY Specification)', () => {
  let connector: FortnoxConnector;
  let mockClient: FortnoxMockClient;

  const validInvoiceRequest: AccountingInvoiceRequest = {
    companyId: '1234567',
    referenceCode: 'ORD-2026-001',
    issueDate: '2026-05-15',
    dueDate: '2026-06-15',
    currency: 'SEK',
    contact: {
      id: 'CUST-100',
      name: 'Sven Svensson AB',
      taxNumber: '556123-4567',
      email: 'sven@example.se',
    },
    items: [
      {
        sku: 'SKU-SWE-1',
        name: 'Konsulttjänst',
        quantity: 2,
        unitPrice: 1000,
        vatRate: 25, // 2 * 1000 = 2000; 25% VAT = 500; total = 2500
        totalAmount: 2500,
      },
    ],
    subtotal: 2000,
    vatTotal: 500,
    grandTotal: 2500,
    notes: 'KroptOS Order #ORD-2026-001',
  };

  beforeEach(() => {
    mockClient = new FortnoxMockClient();
    connector = new FortnoxConnector(
      {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        redirectUri: 'https://app.kroptos.com/api/integrations/accounting/fortnox/callback',
      },
      'MOCK',
      mockClient,
    );
  });

  // 1. Connection test
  it('tests connection successfully in MOCK environment', async () => {
    const res = await connector.testConnection();
    expect(res.success).toBe(true);
    expect(res.companyName).toContain('KroptOS Testbolag AB');
    expect(res.environment).toBe('MOCK');
  });

  // 2. Draft -> Reconcile -> Bookkeep flow
  it('creates draft, reconciles total, and bookkeeps the invoice when amounts match (§5.4)', async () => {
    let operationCommittedCalled = false;
    const result = await connector.createInvoice(validInvoiceRequest, async () => {
      operationCommittedCalled = true;
    });

    expect(operationCommittedCalled).toBe(true);
    expect(result.externalId).toBeDefined();

    // Verify invoice was booked
    const saved = await mockClient.getInvoice(result.externalId);
    expect(saved.Booked).toBe(true);
    expect(saved.Total).toBe(2500);
    expect(saved.Currency).toBe('SEK');
    expect(saved.YourOrderNumber).toBe('ORD-2026-001');
  });

  // 3. Amount mismatch -> do NOT bookkeep
  it('refuses to bookkeep if Fortnox total does not match KroptOS grand total (§5.4)', async () => {
    // Simulate server adding 50 SEK unexpected surcharge
    mockClient.simulateAmountMismatchDiff = 50;

    await expect(connector.createInvoice(validInvoiceRequest)).rejects.toThrow(
      AccountingAmountMismatchError,
    );

    // Verify unbooked invoice remains in Fortnox (DocumentNumber 1001)
    const saved = await mockClient.getInvoice('1001');
    expect(saved.Booked).toBe(false); // Must NOT be bookkept
  });

  // 4. Financial year check (§5.6)
  it('refuses to send invoice if date does not fall into an open financial year (§5.6)', async () => {
    // Invoice dated in 2024 (closed year in mock data)
    const closedYearRequest: AccountingInvoiceRequest = {
      ...validInvoiceRequest,
      issueDate: '2024-06-01',
    };

    await expect(connector.createInvoice(closedYearRequest)).rejects.toThrow(
      /mali yıl kapalıdır veya aralık dışındadır/,
    );

    // Invoice with missing financial year
    mockClient.simulateFinancialYearMissing = true;
    await expect(connector.createInvoice(validInvoiceRequest)).rejects.toThrow(
      /açık bir mali yıl tanımlı değil/,
    );
  });

  // 5. Immutability & cancellation logic (§5.5)
  it('cancels unbooked invoice via PUT /cancel, but uses credit note for booked invoice (§5.5)', async () => {
    // 1. Create a booked invoice
    const bookedResult = await connector.createInvoice(validInvoiceRequest);
    const bookedId = bookedResult.externalId;

    // Canceling booked invoice must select credit note path (immutable)
    const cancelBooked = await connector.cancelInvoice(bookedId);
    expect(cancelBooked.success).toBe(true);
    expect(cancelBooked.cancellationType).toBe('credit_note');

    // 2. Create an unbooked invoice directly in mock
    const unbooked = await mockClient.createInvoice({
      CustomerNumber: 'CUST-100',
      InvoiceDate: '2026-05-15',
      Currency: 'SEK',
      InvoiceRows: [],
    });
    const unbookedId = String(unbooked.DocumentNumber);

    // Canceling unbooked invoice uses direct cancel
    const cancelUnbooked = await connector.cancelInvoice(unbookedId);
    expect(cancelUnbooked.success).toBe(true);
    expect(cancelUnbooked.cancellationType).toBe('cancelled');
    const checked = await mockClient.getInvoice(unbookedId);
    expect(checked.Cancelled).toBe(true);
  });

  // 6. Direct modification of booked invoice is forbidden (§5.5)
  it('direct cancellation of a booked invoice directly via client throws error (§5.5)', async () => {
    const bookedResult = await connector.createInvoice(validInvoiceRequest);
    await expect(mockClient.cancelInvoice(bookedResult.externalId)).rejects.toThrow(
      /Kaydedilmiş \(Booked: true\) fatura doğrudan iptal edilemez/,
    );
  });

  // 7. Forbidden email & print endpoints (§5.5, §8)
  it('does NOT expose or call any email or print endpoints (verification by inspection)', () => {
    // IFortnoxClient interface has no email or print methods
    const clientPrototype = Object.getOwnPropertyNames(FortnoxMockClient.prototype);
    expect(clientPrototype.some((m) => m.toLowerCase().includes('email'))).toBe(false);
    expect(clientPrototype.some((m) => m.toLowerCase().includes('print'))).toBe(false);
  });

  // 8. Find by reference (§5.7)
  it('finds invoice by order reference code (§5.7)', async () => {
    await connector.createInvoice(validInvoiceRequest);
    const found = await connector.findInvoiceByReference('ORD-2026-001');
    expect(found).not.toBeNull();
    expect(found?.rawResponse?.YourOrderNumber).toBe('ORD-2026-001');

    const notFound = await connector.findInvoiceByReference('NONEXISTENT');
    expect(notFound).toBeNull();
  });

  // 9. Status mapping is conservative (§6)
  it('maps statuses conservatively: unbooked and unknown map to pending (§6)', () => {
    expect(FortnoxStatusMapper.toAccountingDocumentStatus({ Booked: true })).toBe('created');
    expect(FortnoxStatusMapper.toAccountingDocumentStatus({ Cancelled: true })).toBe('cancelled');
    expect(FortnoxStatusMapper.toAccountingDocumentStatus({ Booked: false })).toBe('pending');
    expect(FortnoxStatusMapper.toAccountingDocumentStatus({})).toBe('pending');
    expect(FortnoxStatusMapper.toAccountingDocumentStatus(null)).toBe('pending');
  });

  // 10. OAuth manager nonce TTL (< 10 min) and single-use (§5.1)
  it('validates state nonce within TTL and blocks reuse or expired nonces (§5.1)', () => {
    const oauth = new FortnoxOAuthManager();
    const { url, state } = oauth.buildAuthorizationUrl({
      clientId: 'test-client',
      redirectUri: 'https://app.kroptos.com/callback',
      tenantId: 'tenant-1',
      storeId: 'store-1',
    });

    expect(url).toContain('apps.fortnox.se/oauth-v1/auth');
    expect(url).toContain('access_type=offline');

    // First validation succeeds
    const session = oauth.validateState(state);
    expect(session.tenantId).toBe('tenant-1');

    // Second validation fails (single-use)
    expect(() => oauth.validateState(state)).toThrow(/Invalid or unrecognized state nonce/);
  });

  // 11. Authorization code is single-use (§5.1)
  it('enforces single-use for authorization codes (§5.1)', () => {
    const oauth = new FortnoxOAuthManager();
    oauth.consumeAuthorizationCode('code-12345');
    expect(oauth.isCodeUsed('code-12345')).toBe(true);

    expect(() => oauth.consumeAuthorizationCode('code-12345')).toThrow(
      /Authorization code has already been consumed/,
    );
  });

  // 12. Scopes are strictly limited to necessary resources (§5.2)
  it('strictly limits scopes and rejects unauthorized scopes like salary (§5.2)', () => {
    const oauth = new FortnoxOAuthManager();
    expect(FORTNOX_AUTHORIZED_SCOPES).toEqual([
      'invoice',
      'customer',
      'article',
      'payment',
      'bookkeeping',
    ]);

    expect(() =>
      oauth.buildAuthorizationUrl({
        clientId: 'test',
        redirectUri: 'https://test.com',
        tenantId: 't1',
        storeId: 's1',
        scopes: ['salary' as unknown as FortnoxScope],
      }),
    ).toThrow(/Unauthorized scope requested: 'salary'/);
  });

  // 13. RefreshSemantics Profile 6 verification (§4)
  it('verifies RefreshSemantics conforms to Profile 6 (§4)', () => {
    const sem = FORTNOX_CAPABILITIES.refreshSemantics!;
    expect(sem.rotatesOnRefresh).toBe(true);
    expect(sem.previousTokenGraceMs).toBe(0);
    expect(sem.inactivityLimitDays).toBe(45);
    expect(sem.staleTokenUseIsDestructive).toBe(true);
  });

  // 14. Sensitive data masking (§14)
  it('masks sensitive tokens, codes, and secrets in error messages (§14)', () => {
    const raw = 'Failed with Bearer secret-token-xyz and code=auth-code-123 and clientSecret="shh"';
    const masked = FortnoxErrorMapper.maskSensitive(raw);
    expect(masked).not.toContain('secret-token-xyz');
    expect(masked).not.toContain('auth-code-123');
    expect(masked).not.toContain('shh');
    expect(masked).toContain('Bearer ***');
    expect(masked).toContain('code=***');
    expect(masked).toContain('clientSecret="***"');
  });

  // 15. Real network requests are completely forbidden in TEST and PROD clients (§16)
  it('throws IntegrationNotVerifiedError for TEST and PRODUCTION environments', async () => {
    const testConnector = new FortnoxConnector({}, 'TEST');
    const prodConnector = new FortnoxConnector({}, 'PRODUCTION');

    await expect(testConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    await expect(prodConnector.testConnection()).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    await expect(testConnector.createInvoice(validInvoiceRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
    await expect(prodConnector.createInvoice(validInvoiceRequest)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });

  // 16. Contact, Product, and Payment sync in MOCK
  it('supports contact sync, product mapping, and payment recording in MOCK', async () => {
    const contactReq: AccountingContactRequest = {
      companyId: '1234567',
      kroptosKey: 'CUST-200',
      name: 'Astrid Lindgren AB',
      taxNumber: '556999-8888',
      email: 'astrid@example.se',
    };
    const contactRes = await connector.syncContact(contactReq);
    expect(contactRes.externalId).toBe('CUST-200');

    const prodReq: AccountingProductRequest = {
      companyId: '1234567',
      sku: 'BOK-001',
      name: 'Pippi Långstrump',
      unitPrice: 150,
      vatRate: 6,
    };
    const prodRes = await connector.mapProduct(prodReq);
    expect(prodRes.externalId).toBe('BOK-001');

    const paymentReq: AccountingPaymentRequest = {
      companyId: '1234567',
      invoiceExternalId: '1001',
      referenceCode: 'PAY-001',
      amount: 2500,
      currency: 'SEK',
      paymentDate: '2026-05-20',
    };
    // Payment is DOCUMENTATION_REQUIRED, so recordPayment throws IntegrationNotVerifiedError
    await expect(connector.recordPayment(paymentReq)).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });
});
