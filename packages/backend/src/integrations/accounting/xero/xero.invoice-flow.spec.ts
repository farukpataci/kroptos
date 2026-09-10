import { AccountingAmountMismatchError, AccountingInvoiceRequest } from '../core';
import { XeroInvoiceFlow } from './xero.invoice-flow';
import { XeroInvoice } from './xero.types';

describe('XeroInvoiceFlow (3-Step Reconciliation & Authorization)', () => {
  const baseRequest: AccountingInvoiceRequest = {
    companyId: 'comp-1',
    referenceCode: 'INV-TEST-001',
    issueDate: '2026-09-10',
    currency: 'GBP',
    contact: {
      name: 'Acme International',
      email: 'acme@example.com',
    },
    items: [
      {
        sku: 'SKU-01',
        name: 'Item 1',
        quantity: 2,
        unitPrice: 50.0,
        vatRate: 20,
        vatAmount: 20.0,
        totalAmount: 120.0,
      },
    ],
    subtotal: 100.0,
    vatTotal: 20.0,
    grandTotal: 120.0,
  };

  it('1. Successfully creates draft, reconciles matching totals, and authorizes invoice', async () => {
    let authorized = false;
    const client = {
      createDraftInvoice: jest.fn(async (inv: XeroInvoice): Promise<XeroInvoice> => {
        return {
          ...inv,
          InvoiceID: 'inv-uuid-1',
          InvoiceNumber: 'INV-1001',
          Status: 'DRAFT',
          SubTotal: 100.0,
          TotalTax: 20.0,
          Total: 120.0,
        };
      }),
      authorizeInvoice: jest.fn(async (id: string): Promise<XeroInvoice> => {
        authorized = true;
        return {
          InvoiceID: id,
          InvoiceNumber: 'INV-1001',
          Type: 'ACCREC',
          Contact: { Name: 'Acme International' },
          LineItems: [],
          Status: 'AUTHORISED',
          SubTotal: 100.0,
          TotalTax: 20.0,
          Total: 120.0,
        };
      }),
    };

    const res = await XeroInvoiceFlow.executeCreateAndAuthorize(baseRequest, client);

    expect(client.createDraftInvoice).toHaveBeenCalled();
    expect(client.authorizeInvoice).toHaveBeenCalledWith('inv-uuid-1');
    expect(authorized).toBe(true);
    expect(res.Status).toBe('AUTHORISED');
  });

  it('2. Accepts minor rounding discrepancy within tolerance (<= 0.05)', async () => {
    const client = {
      createDraftInvoice: jest.fn(async (inv: XeroInvoice): Promise<XeroInvoice> => {
        return {
          ...inv,
          InvoiceID: 'inv-uuid-2',
          Status: 'DRAFT',
          SubTotal: 100.02,
          TotalTax: 20.01,
          Total: 120.03, // 0.03 diff vs 120.00 -> within 0.05
        };
      }),
      authorizeInvoice: jest.fn(async (_id: string): Promise<XeroInvoice> => {
        return {
          InvoiceID: 'inv-uuid-2',
          Type: 'ACCREC',
          Contact: { Name: 'Acme International' },
          LineItems: [],
          Status: 'AUTHORISED',
          Total: 120.03,
        };
      }),
    };

    const res = await XeroInvoiceFlow.executeCreateAndAuthorize(baseRequest, client);
    expect(res.Status).toBe('AUTHORISED');
    expect(client.authorizeInvoice).toHaveBeenCalledWith('inv-uuid-2');
  });

  it('3. Rejects with AccountingAmountMismatchError and does NOT authorize when Total diff > 0.05', async () => {
    const client = {
      createDraftInvoice: jest.fn(async (inv: XeroInvoice): Promise<XeroInvoice> => {
        return {
          ...inv,
          InvoiceID: 'inv-uuid-3',
          Status: 'DRAFT',
          SubTotal: 100.0,
          TotalTax: 20.0,
          Total: 120.1, // 0.10 diff vs 120.00 -> exceeds 0.05
        };
      }),
      authorizeInvoice: jest.fn(async (_id: string): Promise<XeroInvoice> => {
        return {} as any;
      }),
    };

    await expect(XeroInvoiceFlow.executeCreateAndAuthorize(baseRequest, client)).rejects.toThrow(
      AccountingAmountMismatchError,
    );
    expect(client.authorizeInvoice).not.toHaveBeenCalled();
  });

  it('4. Rejects with AccountingAmountMismatchError when TotalTax diff > 0.05', async () => {
    const client = {
      createDraftInvoice: jest.fn(async (inv: XeroInvoice): Promise<XeroInvoice> => {
        return {
          ...inv,
          InvoiceID: 'inv-uuid-4',
          Status: 'DRAFT',
          SubTotal: 99.98,
          TotalTax: 20.15, // 0.15 diff vs 20.00 -> exceeds 0.05
          Total: 120.0,
        };
      }),
      authorizeInvoice: jest.fn(async (_id: string): Promise<XeroInvoice> => {
        return {} as any;
      }),
    };

    await expect(XeroInvoiceFlow.executeCreateAndAuthorize(baseRequest, client)).rejects.toThrow(
      AccountingAmountMismatchError,
    );
    expect(client.authorizeInvoice).not.toHaveBeenCalled();
  });
});
