import { LexwareInvoiceFlow } from './lexware.invoice-flow';
import { LexwareMockClient } from './lexware.mock-client';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { AccountingAmountMismatchError } from '../core/AccountingErrors';

describe('LexwareInvoiceFlow (§5.2, §9.1, §9.2, §9.3)', () => {
  let mockClient: LexwareMockClient;
  const sampleRequest: AccountingInvoiceRequest = {
    companyId: 'comp-1',
    referenceCode: 'ORD-LEX-100',
    issueDate: '2026-09-10',
    dueDate: '2026-09-24',
    currency: 'EUR',
    contact: {
      name: 'Max Mustermann',
      address: 'Musterstraße 12, 10115 Berlin',
    },
    items: [
      {
        sku: 'PROD-A',
        name: 'Produkt A',
        quantity: 2,
        unitPrice: 50.0,
        vatRate: 19.0,
        vatAmount: 19.0,
        totalAmount: 119.0,
      },
    ],
    subtotal: 100.0,
    vatTotal: 19.0,
    grandTotal: 119.0,
  };

  beforeEach(() => {
    mockClient = new LexwareMockClient();
  });

  it('1. executes draft -> reconcile -> finalize lifecycle and NEVER uses ?finalize=true (§9.1, §9.2)', async () => {
    const result = await LexwareInvoiceFlow.executeCreateInvoice(mockClient, sampleRequest);

    expect(result.externalId).toBeDefined();
    expect(result.externalNumber).toMatch(/^RE-2026-\d+/);
    expect(result.rawResponse?.finalized).toBe(true);
    expect(result.rawResponse?.reconciled).toBe(true);

    // Verify request sequence: POST /invoices (draft) -> GET /invoices/:id -> POST /invoices/:id/finalize
    expect(mockClient.requestHistory.length).toBeGreaterThanOrEqual(3);

    // §9.1: Assert ?finalize=true is NEVER generated in any request path
    for (const req of mockClient.requestHistory) {
      expect(req.path).not.toContain('finalize=true');
      if (req.body) {
        expect(JSON.stringify(req.body)).not.toContain('finalize=true');
      }
    }
  });

  it('2. aborts finalization when totals mismatch; leaves invoice in draft mode (§5.2, §9.2)', async () => {
    mockClient.simulateAmountMismatch = true; // Server totals deviate by 5 EUR

    await expect(
      LexwareInvoiceFlow.executeCreateInvoice(mockClient, sampleRequest),
    ).rejects.toThrow(AccountingAmountMismatchError);

    // Verify finalize was NEVER called
    const finalizeCalls = mockClient.requestHistory.filter((r) => r.path.includes('/finalize'));
    expect(finalizeCalls.length).toBe(0);

    // Verify invoice remains in draft mode in mock client
    const draftCall = mockClient.requestHistory.find((r) => r.method === 'POST' && r.path === '/invoices');
    expect(draftCall).toBeDefined();

    const invoiceList = await mockClient.listInvoices(0, 10);
    expect(invoiceList.content.length).toBe(1);
    expect(invoiceList.content[0].voucherStatus).toBe('draft');
  });

  it('3. draft creation timeout aborts cleanly without blind retry (§9.3)', async () => {
    mockClient.simulateDraftCreationTimeout = true;

    await expect(
      LexwareInvoiceFlow.executeCreateInvoice(mockClient, sampleRequest),
    ).rejects.toThrow(/timed out/i);

    // Only 1 attempt was made; no blind retries
    expect(mockClient.requestHistory.length).toBe(1);
  });

  it('4. resolves 409 version conflict during finalize via single re-read (§9.6)', async () => {
    mockClient.simulateVersionConflictCount = 1; // 1 conflict, then succeeds

    const result = await LexwareInvoiceFlow.executeCreateInvoice(mockClient, sampleRequest);
    expect(result.externalId).toBeDefined();
    expect(result.rawResponse?.finalized).toBe(true);
  });
});
