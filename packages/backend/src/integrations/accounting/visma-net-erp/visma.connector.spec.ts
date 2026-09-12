import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { VismaNetErpConnector } from './visma.connector';
import { VismaMockClient } from './visma.mock-client';

describe('VismaNetErpConnector (§7, §8, §9)', () => {
  let connector: VismaNetErpConnector;
  let mockClient: VismaMockClient;

  beforeEach(() => {
    mockClient = new VismaMockClient('1113659');
    connector = new VismaNetErpConnector(
      {
        ippCompanyId: '1113659',
        incomeAccount: '3000',
        vatCodeId: '25',
      },
      'MOCK',
      mockClient,
    );
  });

  it('1. should instantiate connector with MOCK and test connection successfully', async () => {
    const res = await connector.testConnection();
    expect(res.success).toBe(true);
    expect(res.companyId).toBe('1113659');
    expect(res.environment).toBe('MOCK');
  });

  it('2. should reject TEST and PRODUCTION environments with IntegrationNotVerifiedError (§9.2 #23)', async () => {
    const testConnector = new VismaNetErpConnector({ ippCompanyId: '1113659' }, 'TEST');
    await expect(testConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);

    const prodConnector = new VismaNetErpConnector({ ippCompanyId: '1113659' }, 'PRODUCTION');
    await expect(prodConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
  });

  it('3. should create invoice end-to-end via background operation, reconcile and release (§3, §5.4, §5.5)', async () => {
    const committedOps: string[] = [];
    const onCommitted = async (opId: string) => {
      committedOps.push(opId);
    };

    // 1 item: qty 2, price 100 -> lineNet 200. With 25% VAT -> 250.
    const res = await connector.createInvoice(
      {
        companyId: '1113659',
        referenceCode: 'ORD-VISMA-001',
        issueDate: '2026-09-11',
        currency: 'EUR',
        subtotal: 200,
        vatTotal: 50,
        grandTotal: 250,
        contact: { name: 'Customer 1' },
        items: [
          {
            name: 'Ergonomic Desk',
            sku: 'DESK-01',
            quantity: 2,
            unitPrice: 100,
            vatRate: 25,
            totalAmount: 250,
          },
        ],
      },
      onCommitted,
    );

    expect(res.externalId).toMatch(/^INV-/);
    expect(res.rawResponse?.providerStatus).toBe('Open');
    expect(committedOps.length).toBe(1);
    expect(committedOps[0]).toMatch(/^op:job-/);
  });

  it('4. should replay idempotently when referenceCode already exists (§5.2)', async () => {
    // Seed invoice in mock client
    await mockClient.createCustomerInvoiceBackground({
      customerRefNo: { value: 'ORD-EXISTING-99' },
      documentType: { value: 'Invoice' },
      amount: 125,
      vatAmount: 25,
    });

    const res = await connector.createInvoice({
      companyId: '1113659',
      referenceCode: 'ORD-EXISTING-99',
      issueDate: '2026-09-11',
      currency: 'EUR',
      subtotal: 100,
      vatTotal: 25,
      grandTotal: 125,
      contact: { name: 'Customer 1' },
      items: [],
    });

    expect(res.externalId).toBeDefined();
    expect(res.rawResponse?.idempotentReplay).toBe(true);
  });

  it('5. should STOP and NOT release invoice if reconciliation does not match (§5.4, §5.5)', async () => {
    // 1 item: qty 1, price 100 -> lineNet 100 + 25 VAT = 125. But KroptOS expects 199.99!
    const res = await connector.createInvoice({
      companyId: '1113659',
      referenceCode: 'ORD-MISMATCH-002',
      issueDate: '2026-09-11',
      currency: 'EUR',
      subtotal: 100,
      vatTotal: 25,
      grandTotal: 199.99,
      contact: { name: 'Customer 1' },
      items: [
        {
          name: 'Item X',
          sku: 'ITEM-X',
          quantity: 1,
          unitPrice: 100,
          vatRate: 25,
          totalAmount: 125,
        },
      ],
    });

    expect(res.externalId).toBeDefined();
    expect(res.rawResponse?.providerStatus).toBe('Balanced'); // Remained in Draft Balanced!
    expect(res.rawResponse?.reconciliationMismatch).toBe(true);
    expect(res.rawResponse?.reconciliationDiff).toBeGreaterThan(0.05);
    expect(res.rawResponse?.reconciliationMessage).toContain('uyuşmuyor');
  });

  it('6. should throw explicit configuration error if incomeAccount or vatCodeId is missing (§5.6)', async () => {
    const unconfigured = new VismaNetErpConnector(
      {
        ippCompanyId: '1113659',
        incomeAccount: '', // Missing
        vatCodeId: '25',
      },
      'MOCK',
      mockClient,
    );

    await expect(
      unconfigured.createInvoice({
        companyId: '1113659',
        referenceCode: 'ORD-MISSING-ACC',
        issueDate: '2026-09-11',
        currency: 'EUR',
        subtotal: 100,
        vatTotal: 0,
        grandTotal: 100,
        contact: { name: 'Customer 1' },
        items: [{ name: 'Test', sku: 'TEST-SKU', quantity: 1, unitPrice: 100, vatRate: 0, totalAmount: 100 }],
      }),
    ).rejects.toThrow('Varsayılan gelir hesabı kodu (incomeAccount) yapılandırılmamış');
  });

  it('7. should check state before selecting cancellation path (§2.4, #18)', async () => {
    // 1. Create a draft Balanced invoice
    const draftRes = await mockClient.createCustomerInvoiceBackground({
      customerRefNo: { value: 'ORD-CANCEL-1' },
      status: { value: 'Balanced' },
    });
    const inv1 = await mockClient.getInvoice(`INV-${mockClient['invoiceCounter']}`);

    // Balanced can be cancelled directly
    const cancel1 = await connector.cancelInvoice(inv1.invoiceNumber!);
    expect(cancel1.success).toBe(true);
    expect(cancel1.cancellationType).toBe('voided');

    // 2. Open invoice requires credit note
    inv1.status = { value: 'Open' };
    mockClient['invoices'].set(inv1.invoiceNumber!, inv1);

    const cancel2 = await connector.cancelInvoice(inv1.invoiceNumber!);
    expect(cancel2.success).toBe(true);
    expect(cancel2.cancellationType).toBe('credit_note');
  });

  it('8. should sync contact, map product and record payment', async () => {
    const contactRes = await connector.syncContact({
      companyId: '1113659',
      kroptosKey: 'krop-c-1',
      name: 'Nordic Retail AS',
      taxNumber: 'NO987654321MVA',
      email: 'finance@nordicretail.no',
    });
    expect(contactRes.externalId).toBeDefined();

    const productRes = await connector.mapProduct({
      companyId: '1113659',
      sku: 'PROD-SKU-99',
      name: 'Wireless Keyboard',
    });
    expect(productRes.externalId).toBe('PROD-SKU-99');

    const paymentRes = await connector.recordPayment({
      companyId: '1113659',
      invoiceExternalId: 'INV-1001',
      referenceCode: 'REF-PMT-1',
      amount: 250,
      currency: 'EUR',
      paymentDate: '2026-09-11',
    });
    expect(paymentRes.externalId).toMatch(/^PMT-/);
  });
});
