import { PennylaneInvoiceFlow } from './pennylane.invoice-flow';
import { IPennylaneClient } from './pennylane.client';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';

describe('PennylaneInvoiceFlow (§5.1, §9.1, §9.2)', () => {
  const mockInvoiceRequest: AccountingInvoiceRequest = {
    companyId: 'comp_1',
    referenceCode: 'KROP-INV-1001',
    issueDate: '2026-09-12',
    dueDate: '2026-10-12',
    currency: 'EUR',
    subtotal: 100.0,
    vatTotal: 20.0,
    grandTotal: 120.0,
    contact: {
      id: 'CUST-1',
      name: 'Dupont Consulting',
      email: 'dupont@consulting.fr',
      taxNumber: 'FR12345678901',
    },
    items: [
      {
        sku: 'SKU-001',
        name: 'Danışmanlık Hizmeti',
        quantity: 1,
        unitPrice: 100.0,
        vatRate: 20,
        totalAmount: 120.0,
      },
    ],
  };

  it('1. Fatura oluştururken draft: true açıkça gönderilmeli ve kesinleştirilmeli (§9.1)', async () => {
    let capturedPayload: any;
    let finalizeCalled = false;

    const mockClient: Partial<IPennylaneClient> = {
      createInvoice: jest.fn().mockImplementation(async (payload) => {
        capturedPayload = payload;
        return {
          id: 101,
          draft: true,
          status: 'draft',
          amount: '120.00',
          currency_amount: '120.00',
          paid: false,
          date: '2026-09-12',
          deadline: '2026-10-12',
          remaining_amount_with_tax: '120.00',
          customer_id: 1,
        };
      }),
      getInvoice: jest.fn().mockResolvedValue({
        id: 101,
        draft: true,
        status: 'draft',
        amount: '120.00',
        currency_amount: '120.00',
        paid: false,
        date: '2026-09-12',
        deadline: '2026-10-12',
        remaining_amount_with_tax: '120.00',
        customer_id: 1,
      }),
      finalizeInvoice: jest.fn().mockImplementation(async (id) => {
        finalizeCalled = true;
        return {
          id: 101,
          invoice_number: 'INV-2026-001',
          draft: false,
          status: 'finalized',
          amount: '120.00',
          currency_amount: '120.00',
          paid: false,
          date: '2026-09-12',
          deadline: '2026-10-12',
          remaining_amount_with_tax: '120.00',
          customer_id: 1,
        };
      }),
    };

    const result = await PennylaneInvoiceFlow.executeCreateInvoice(
      mockClient as IPennylaneClient,
      mockInvoiceRequest,
      1,
    );

    expect(capturedPayload.draft).toBe(true);
    expect(finalizeCalled).toBe(true);
    expect(result.externalId).toBe('101');
    expect(result.externalNumber).toBe('INV-2026-001');
    expect(result.rawResponse?.discrepancy).toBe(false);
    expect(result.rawResponse?.draft).toBe(false);
  });

  it('2. Mutabakat uyuşmazlığında fatura KESİNLEŞTİRİLMEMELİ, taslakta bırakılmalı (§9.2)', async () => {
    let finalizeCalled = false;

    const mockClient: Partial<IPennylaneClient> = {
      createInvoice: jest.fn().mockResolvedValue({
        id: 102,
        draft: true,
        status: 'draft',
        amount: '150.00', // Uyuşmazlık: KroptOS 120.00 beklerken sunucu 150.00 hesapladı
        currency_amount: '150.00',
        paid: false,
        date: '2026-09-12',
        deadline: '2026-10-12',
        remaining_amount_with_tax: '150.00',
        customer_id: 1,
      }),
      getInvoice: jest.fn().mockResolvedValue({
        id: 102,
        draft: true,
        status: 'draft',
        amount: '150.00',
        currency_amount: '150.00',
        paid: false,
        date: '2026-09-12',
        deadline: '2026-10-12',
        remaining_amount_with_tax: '150.00',
        customer_id: 1,
      }),
      finalizeInvoice: jest.fn().mockImplementation(async () => {
        finalizeCalled = true;
      }),
    };

    const result = await PennylaneInvoiceFlow.executeCreateInvoice(
      mockClient as IPennylaneClient,
      mockInvoiceRequest,
      1,
    );

    expect(finalizeCalled).toBe(false); // Kesinleştirme ASLA çağrılmadı!
    expect(result.externalId).toBe('102');
    expect(result.rawResponse?.draft).toBe(true); // Taslakta bırakıldı
    expect(result.rawResponse?.discrepancy).toBe(true); // Uyuşmazlık bayrağı aktif
  });

  it('3. 0.05 tolerans dahilindeki küçük yuvarlama farkları mutabakatı bozmamalı', () => {
    const res1 = PennylaneInvoiceFlow.reconcile(100.0, 100.04);
    expect(res1.matched).toBe(true);

    const res2 = PennylaneInvoiceFlow.reconcile(100.0, 100.06);
    expect(res2.matched).toBe(false);
  });
});
