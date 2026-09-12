import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import { SevdeskInvoiceFlow } from './sevdesk.invoice-flow';
import { SevdeskMockClient } from './sevdesk.mock-client';

describe('SevdeskInvoiceFlow (§5.1, §5.2)', () => {
  let client: SevdeskMockClient;

  beforeEach(() => {
    client = new SevdeskMockClient();
  });

  it('reconciles matching totals successfully within EUR cent tolerance', () => {
    const res = SevdeskInvoiceFlow.reconcile(119.0, 119.0, 'EUR');
    expect(res.matched).toBe(true);
    expect(res.diff).toBe(0);
  });

  it('detects mismatch when totals differ by more than 0.01', () => {
    const res = SevdeskInvoiceFlow.reconcile(100.0, 119.0, 'EUR');
    expect(res.matched).toBe(false);
    expect(res.diff).toBe(19.0);
    expect(res.reason).toContain('sevDesk sunucu toplamı (119.00 EUR) KroptOS sipariş toplamıyla (100.00 EUR) uyuşmuyor');
  });

  it('creates draft invoice, reconciles totals, and leaves invoice in Draft status (pending)', async () => {
    // 100 net + 19% VAT = 119 gross
    const result = await SevdeskInvoiceFlow.executeCreateInvoice(client, {
      companyId: 'org-test-1',
      referenceCode: 'REF-101',
      issueDate: '2026-09-11',
      currency: 'EUR',
      contact: { name: 'Musterkunde', taxNumber: 'DE123456789' },
      items: [
        {
          sku: 'SKU-A',
          name: 'Ürün A',
          unitPrice: 100.0,
          quantity: 1,
          vatRate: 19,
          totalAmount: 119.0,
        },
      ],
      subtotal: 100.0,
      vatTotal: 19.0,
      grandTotal: 119.0,
    });

    expect(result.externalId).toBeDefined();
    expect(result.rawResponse?.status).toBe('pending'); // Draft 100 -> pending (§5.1, §5.2)
    expect(result.rawResponse?.sumGross).toBe(119.0);
    expect(result.rawResponse?._reconciled).toBe(true);
    expect(result.rawResponse?._operatorNote).toContain('taslak');

    // Confirm it is indeed draft (100) in sevDesk
    const remote = await client.getInvoice(result.externalId);
    expect(remote.status).toBe(100);
  });

  it('aborts and throws AccountingAmountMismatchError when totals do not match', async () => {
    await expect(
      SevdeskInvoiceFlow.executeCreateInvoice(client, {
        companyId: 'org-test-1',
        referenceCode: 'ORD-102',
        issueDate: '2026-09-11',
        currency: 'EUR',
        contact: { name: 'Musterkunde' },
        items: [
          {
            sku: 'SKU-B',
            name: 'Ürün B',
            unitPrice: 100.0,
            quantity: 1,
            vatRate: 19,
            totalAmount: 119.0,
          },
        ],
        subtotal: 100.0,
        vatTotal: 19.0,
        grandTotal: 200.0, // Expected 200, but 100 + 19% = 119
      }),
    ).rejects.toThrow(AccountingAmountMismatchError);
  });
});
