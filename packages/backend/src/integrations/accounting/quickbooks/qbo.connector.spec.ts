import { QuickBooksConnector } from './qbo.connector';
import { QBOMockClient } from './qbo.mock-client';
import { QBO_API_MINORVERSION } from './qbo.types';
import { AccountingAmountMismatchError, AccountingApiError } from '../core/AccountingErrors';
import { QBODocNumber } from './qbo.doc-number';

describe('QuickBooksConnector (§6 & §7.2 Acceptance Tests)', () => {
  let connector: QuickBooksConnector;
  let mockClient: QBOMockClient;

  beforeEach(() => {
    mockClient = new QBOMockClient('test-realm-1');
    connector = new QuickBooksConnector({ realmId: 'test-realm-1' }, 'MOCK', mockClient);
    jest.clearAllMocks();
  });

  describe('1. Connection & Minorversion Validation (§7.2.8 & §7.2.24)', () => {
    it('successfully connects and verifies AST preferences in mock mode without real network calls', async () => {
      const res = await connector.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('KroptOS Global US Corp');
      expect(res.message).toContain('Otomatik Vergi: Etkin (AST)');

      // Verify that every single simulated call carried minorversion=75
      expect(mockClient.simulatedCalls.length).toBeGreaterThan(0);
      for (const call of mockClient.simulatedCalls) {
        expect(call.url).toContain(`minorversion=${QBO_API_MINORVERSION}`);
        expect(call.url).not.toContain('latest');
      }
    });
  });

  describe('2. Invoice Creation & Pre-Validation (§7.2.14, §7.2.16, §7.2.17)', () => {
    it('creates an invoice with AST enabled: TxnTaxDetail is OMITTED (§7.2.14)', async () => {
      mockClient.preferences.TaxPrefs!.PartnerTaxEnabled = true;

      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-QBO-100',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: {
          name: 'Acme Global Corp',
          email: 'acme@example.com',
        },
        items: [
          {
            sku: 'SKU-A',
            name: 'Item A',
            quantity: 2,
            unitPrice: 50.0,
            vatRate: 10,
            vatAmount: 10.0,
            totalAmount: 100.0,
          },
        ],
        subtotal: 100.0,
        vatTotal: 10.0,
        grandTotal: 110.0,
      };

      const res = await connector.createInvoice(invoiceReq);

      expect(res.externalId).toBeDefined();
      expect(res.externalNumber).toBe('ORD-QBO-100');
      expect(res.rawResponse?.status).toBe('sent');

      const created = mockClient.invoices.get(res.externalId)!;
      // In AST mode, TxnTaxDetail is strictly omitted
      expect(created.TxnTaxDetail).toBeUndefined();
      expect(created.CustomerMemo?.value).toContain('KroptOS Ref: ORD-QBO-100');
      expect(created.PrivateNote).toContain('DocNumber: ORD-QBO-100');
    });

    it('rejects invoice when line amount is inconsistent (§7.2.16)', async () => {
      const inconsistentReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-FAIL-MATH',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Customer' },
        items: [
          {
            sku: 'SKU-B',
            name: 'Item B',
            quantity: 2,
            unitPrice: 50.0,
            vatRate: 0,
            vatAmount: 0,
            totalAmount: 150.0, // Inconsistent: 2 * 50 = 100 != 150
          },
        ],
        subtotal: 150.0,
        vatTotal: 0,
        grandTotal: 150.0,
      };

      await expect(connector.createInvoice(inconsistentReq)).rejects.toThrow(AccountingAmountMismatchError);
    });

    it('flags invoice with hasAmountMismatch if read-back TotalAmt differs from order grandTotal (§7.2.17)', async () => {
      // In mockClient, totalAmt equals sum of lines (100)
      // If KroptOS expects 120 (e.g. external carrier shipping added), mismatch flag is raised
      const mismatchedReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-MISMATCH-1',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Mismatch Customer' },
        items: [
          {
            sku: 'SKU-C',
            name: 'Item C',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 0,
            vatAmount: 0,
            totalAmount: 100.0,
          },
        ],
        subtotal: 100.0,
        vatTotal: 0,
        grandTotal: 120.0, // Expected 120 != QBO calculated 100
      };

      const res = await connector.createInvoice(mismatchedReq);
      expect(res.rawResponse?.status).toBe('sent');
      expect(res.rawResponse?.hasAmountMismatch).toBe(true);
      expect(res.rawResponse?.amountDifference).toBe(20.0);
    });

    it('rejects invoice if tax preferences cannot be determined (§7.2.15)', async () => {
      mockClient.getPreferences = jest.fn(async () => ({} as any));

      const req = {
        companyId: 'comp-1',
        referenceCode: 'ORD-NO-TAX-PREFS',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Customer' },
        items: [{ sku: 'S', name: 'N', quantity: 1, unitPrice: 10, vatRate: 0, vatAmount: 0, totalAmount: 10 }],
        subtotal: 10,
        vatTotal: 0,
        grandTotal: 10,
      };

      await expect(connector.createInvoice(req)).rejects.toThrow(AccountingApiError);
    });
  });

  describe('3. Native Idempotency & Batch Isolation (§7.2.11, §7.2.20)', () => {
    it('uses same requestid query parameter on retry without creating duplicate invoices (§7.2.11)', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-IDEM-999',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Idem Customer' },
        items: [{ sku: 'SKU-1', name: 'Item 1', quantity: 1, unitPrice: 50, vatRate: 0, vatAmount: 0, totalAmount: 50 }],
        subtotal: 50,
        vatTotal: 0,
        grandTotal: 50,
      };

      const res1 = await connector.createInvoice(invoiceReq);
      const res2 = await connector.createInvoice(invoiceReq);

      expect(res1.externalId).toBe(res2.externalId);
      expect(mockClient.invoices.size).toBe(1);
    });

    it('never calls batch endpoints (§7.2.20)', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-NO-BATCH',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Batch Check Customer' },
        items: [{ sku: 'SKU-1', name: 'Item 1', quantity: 1, unitPrice: 50, vatRate: 0, vatAmount: 0, totalAmount: 50 }],
        subtotal: 50,
        vatTotal: 0,
        grandTotal: 50,
      };

      await connector.createInvoice(invoiceReq);
      for (const call of mockClient.simulatedCalls) {
        expect(call.url).not.toContain('/batch');
      }
    });
  });

  describe('4. Invoice Cancellation & Pre-Check (§7.2.18, §2.4)', () => {
    it('reads current status before voiding and voids invoice successfully', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-CANCEL-1',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Cancel Customer' },
        items: [{ sku: 'SKU-C', name: 'Item C', quantity: 1, unitPrice: 60, vatRate: 0, vatAmount: 0, totalAmount: 60 }],
        subtotal: 60,
        vatTotal: 0,
        grandTotal: 60,
      };

      const created = await connector.createInvoice(invoiceReq);
      const cancelRes = await connector.cancelInvoice(created.externalId);

      expect(cancelRes.cancellationType).toBe('voided');
      expect(cancelRes.message).toContain('başarıyla iptal edildi (Voided)');

      const voided = mockClient.invoices.get(created.externalId)!;
      expect(voided.TotalAmt).toBe(0);
      expect(voided.Balance).toBe(0);
      expect(voided.PrivateNote).toContain('[Voided]');
    });

    it('fails if invoice is already voided (§2.4)', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-DOUBLE-VOID',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Double Void Customer' },
        items: [{ sku: 'SKU-D', name: 'Item D', quantity: 1, unitPrice: 70, vatRate: 0, vatAmount: 0, totalAmount: 70 }],
        subtotal: 70,
        vatTotal: 0,
        grandTotal: 70,
      };

      const created = await connector.createInvoice(invoiceReq);
      await connector.cancelInvoice(created.externalId);

      // Attempt second cancellation on already voided invoice
      await expect(connector.cancelInvoice(created.externalId)).rejects.toThrow(/zaten iptal edilmiştir/);
    });
  });

  describe('5. Payment & Product Mapping (§7.2.22, §7.2.23)', () => {
    it('records customer payment and updates invoice balance', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-PAY-10',
        issueDate: '2026-09-10',
        currency: 'USD',
        contact: { name: 'Payment Customer' },
        items: [{ sku: 'SKU-P', name: 'Item P', quantity: 1, unitPrice: 80, vatRate: 0, vatAmount: 0, totalAmount: 80 }],
        subtotal: 80,
        vatTotal: 0,
        grandTotal: 80,
      };

      const inv = await connector.createInvoice(invoiceReq);

      const payRes = await connector.recordPayment({
        companyId: 'comp-1',
        referenceCode: 'PAY-100',
        amount: 80,
        currency: 'USD',
        paymentDate: '2026-09-10',
        invoiceExternalId: inv.externalId,
      });

      expect(payRes.externalId).toBeDefined();

      const updatedInv = mockClient.invoices.get(inv.externalId)!;
      expect(updatedInv.Balance).toBe(0);
    });

    it('maps product item', async () => {
      const res = await connector.mapProduct({
        companyId: 'comp-1',
        sku: 'PROD-SKU-1',
        name: 'Ergonomic Office Chair',
        unitPrice: 250,
      });

      expect(res.externalId).toBeDefined();
    });
  });
});
