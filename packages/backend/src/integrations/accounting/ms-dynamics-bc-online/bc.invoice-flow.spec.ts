import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { IBusinessCentralClient } from './bc.client';
import { BusinessCentralInvoiceFlow } from './bc.invoice-flow';
import { BusinessCentralSalesInvoiceHeader } from './bc.types';

describe('BusinessCentralInvoiceFlow (§4.2, §4.4)', () => {
  let mockClient: jest.Mocked<IBusinessCentralClient>;

  const invoiceReq: AccountingInvoiceRequest = {
    companyId: 'comp-guid-1',
    referenceCode: 'ORD-999',
    issueDate: '2026-09-10',
    currency: 'TRY',
    contact: {
      name: 'Test Musteri A.S.',
      taxNumber: '1234567890',
    },
    items: [
      {
        sku: 'SKU-1',
        name: 'Urun 1',
        quantity: 2,
        unitPrice: 500,
        vatRate: 20,
        vatAmount: 200,
        totalAmount: 1200,
      },
    ],
    subtotal: 1000,
    vatTotal: 200,
    grandTotal: 1200,
  };

  beforeEach(() => {
    mockClient = {
      testConnection: jest.fn(),
      createDraftInvoice: jest.fn(),
      createInvoiceLine: jest.fn(),
      getInvoice: jest.fn(),
      postInvoice: jest.fn(),
      cancelInvoice: jest.fn(),
      deleteDraftInvoice: jest.fn(),
      findInvoiceByReference: jest.fn(),
      syncCustomer: jest.fn(),
      mapItem: jest.fn(),
      getCompanies: jest.fn(),
    };
  });

  describe('executeCreateInvoice', () => {
    it('returns existing invoice if already found by referenceCode (idempotent)', async () => {
      const existing: BusinessCentralSalesInvoiceHeader = {
        id: 'existing-id-123',
        number: '103001',
        externalDocumentNumber: 'ORD-999',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: 'cust-1',
        status: 'Open',
        totalAmountIncludingTax: 1200,
      };
      mockClient.findInvoiceByReference.mockResolvedValue(existing);

      const result = await BusinessCentralInvoiceFlow.executeCreateInvoice(mockClient, invoiceReq);

      expect(mockClient.findInvoiceByReference).toHaveBeenCalledWith('ORD-999');
      expect(mockClient.createDraftInvoice).not.toHaveBeenCalled();
      expect(result.externalId).toBe('existing-id-123');
      expect(result.rawResponse?.idempotentReplay).toBe(true);
    });

    it('creates draft, lines, reconciles totals, and posts when totals match (§4.2)', async () => {
      mockClient.findInvoiceByReference.mockResolvedValue(null);

      // 1. Draft created
      mockClient.createDraftInvoice.mockResolvedValue({
        id: 'draft-id-1',
        number: 'INV-DRAFT-1',
        externalDocumentNumber: 'ORD-999',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: '',
        status: 'Draft',
      });

      mockClient.createInvoiceLine.mockResolvedValue({
        id: 'line-1',
        description: 'Urun 1',
        quantity: 2,
        unitPrice: 500,
      });

      // 2. Read back draft with totals: 1200 matches kroptos grandTotal 1200
      mockClient.getInvoice.mockResolvedValueOnce({
        id: 'draft-id-1',
        number: 'INV-DRAFT-1',
        externalDocumentNumber: 'ORD-999',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: '',
        status: 'Draft',
        totalAmountIncludingTax: 1200,
      });

      // 3. Post invoice
      mockClient.postInvoice.mockResolvedValue(undefined);

      // 4. Read back posted invoice
      mockClient.getInvoice.mockResolvedValueOnce({
        id: 'draft-id-1',
        number: '103001',
        externalDocumentNumber: 'ORD-999',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: '',
        status: 'Open',
        totalAmountIncludingTax: 1200,
      });

      const result = await BusinessCentralInvoiceFlow.executeCreateInvoice(mockClient, invoiceReq);

      expect(mockClient.createDraftInvoice).toHaveBeenCalled();
      expect(mockClient.createInvoiceLine).toHaveBeenCalled();
      expect(mockClient.postInvoice).toHaveBeenCalledWith('draft-id-1');
      expect(result.externalId).toBe('draft-id-1');
      expect(result.externalNumber).toBe('103001');
      expect(result.rawResponse?.providerStatus).toBe('Open');
      expect(result.rawResponse?.reconciliationMatched).toBe(true);
    });

    it('does NOT post and leaves document as Draft when totals mismatch (§4.2)', async () => {
      mockClient.findInvoiceByReference.mockResolvedValue(null);

      mockClient.createDraftInvoice.mockResolvedValue({
        id: 'draft-id-2',
        number: 'INV-DRAFT-2',
        externalDocumentNumber: 'ORD-999',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: '',
        status: 'Draft',
      });

      mockClient.createInvoiceLine.mockResolvedValue({
        id: 'line-2',
        description: 'Urun 1',
        quantity: 2,
        unitPrice: 500,
      });

      // BC calculated 1180 instead of KroptOS 1200 (e.g. tax setup difference)
      mockClient.getInvoice.mockResolvedValueOnce({
        id: 'draft-id-2',
        number: 'INV-DRAFT-2',
        externalDocumentNumber: 'ORD-999',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: '',
        status: 'Draft',
        totalAmountIncludingTax: 1180,
      });

      const result = await BusinessCentralInvoiceFlow.executeCreateInvoice(mockClient, invoiceReq);

      // CRITICAL: Microsoft.NAV.post must NOT be called!
      expect(mockClient.postInvoice).not.toHaveBeenCalled();
      expect(result.externalId).toBe('draft-id-2');
      expect(result.rawResponse?.providerStatus).toBe('Draft');
      expect(result.rawResponse?.reconciliationMismatch).toBe(true);
      expect(result.rawResponse?.reconciliationDiff).toBe(20);
      expect(result.rawResponse?.reconciliationMessage).toContain('BC toplamı (1180 TRY)');
    });
  });

  describe('executeCancelInvoice (§4.4)', () => {
    it('deletes draft invoice with ETag if status is Draft', async () => {
      mockClient.getInvoice.mockResolvedValue({
        id: 'draft-id-1',
        status: 'Draft',
        '@odata.etag': 'W/"ETAG123"',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: '',
      });

      const res = await BusinessCentralInvoiceFlow.executeCancelInvoice(mockClient, 'draft-id-1');

      expect(mockClient.deleteDraftInvoice).toHaveBeenCalledWith('draft-id-1', 'W/"ETAG123"');
      expect(mockClient.cancelInvoice).not.toHaveBeenCalled();
      expect(res.cancellationType).toBe('deleted');
      expect(res.message).toContain('taslak fatura silindi');
    });

    it('calls cancel bound action and generates credit memo if status is Open or Paid', async () => {
      mockClient.getInvoice.mockResolvedValue({
        id: 'posted-id-1',
        status: 'Open',
        invoiceDate: '2026-09-10',
        postingDate: '2026-09-10',
        customerId: '',
      });

      const res = await BusinessCentralInvoiceFlow.executeCancelInvoice(mockClient, 'posted-id-1');

      expect(mockClient.cancelInvoice).toHaveBeenCalledWith('posted-id-1');
      expect(mockClient.deleteDraftInvoice).not.toHaveBeenCalled();
      expect(res.cancellationType).toBe('credit_memo');
      expect(res.message).toContain("düzeltici alacak dekontu oluşturuldu");
    });
  });
});
