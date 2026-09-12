import { BadRequestException } from '@nestjs/common';
import { AccountingAmountMismatchError } from '../core/AccountingErrors';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { IFreeAgentClient } from './freeagent.client';
import { FreeAgentInvoiceFlow } from './freeagent.invoice-flow';
import { FreeAgentInvoice } from './freeagent.types';

describe('FreeAgentInvoiceFlow (§5.2, §5.3)', () => {
  let mockClient: jest.Mocked<IFreeAgentClient>;

  const baseRequest: AccountingInvoiceRequest = {
    companyId: 'comp-1',
    referenceCode: 'KROP-INV-101',
    issueDate: '2026-09-11',
    dueDate: '2026-09-25',
    currency: 'GBP',
    contact: {
      id: '10',
      name: 'Acme UK Ltd',
    },
    items: [
      {
        sku: 'SKU-A',
        name: 'Danışmanlık Hizmeti',
        quantity: 2,
        unitPrice: 50,
        vatRate: 20,
        totalAmount: 120,
      },
    ],
    subtotal: 100,
    vatTotal: 20,
    grandTotal: 120,
  };

  const defaultOptions = {
    environment: 'MOCK' as const,
    defaultCategoryUrl: 'https://api.sandbox.freeagent.com/v2/categories/001',
  };

  beforeEach(() => {
    mockClient = {
      getCompany: jest.fn(),
      getCurrentUser: jest.fn(),
      listContacts: jest.fn(),
      getContact: jest.fn(),
      createContact: jest.fn(),
      listCategories: jest.fn(),
      listBankAccounts: jest.fn(),
      createDraftInvoice: jest.fn(),
      getInvoice: jest.fn(),
      listInvoices: jest.fn(),
      transitionInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      createBankTransactionExplanation: jest.fn(),
    } as any;
  });

  it('successful flow: creates draft, reconciles totals, transitions via mark_as_sent (§5.2, §5.3)', async () => {
    const draftInvoice: FreeAgentInvoice = {
      url: 'https://api.sandbox.freeagent.com/v2/invoices/501',
      id: '501',
      contact: 'https://api.sandbox.freeagent.com/v2/contacts/10',
      dated_on: '2026-09-11',
      status: 'Draft',
      total_value: 120,
      net_value: 100,
      sales_tax_value: 20,
      reference: 'INV-00501',
      invoice_items: [],
    };

    const sentInvoice: FreeAgentInvoice = {
      ...draftInvoice,
      status: 'Open',
    };

    mockClient.createDraftInvoice.mockResolvedValue(draftInvoice);
    mockClient.getInvoice.mockResolvedValue(draftInvoice);
    mockClient.transitionInvoice.mockResolvedValue(sentInvoice);

    const result = await FreeAgentInvoiceFlow.executeCreateInvoice(
      mockClient,
      baseRequest,
      defaultOptions,
    );

    expect(mockClient.createDraftInvoice).toHaveBeenCalledTimes(1);

    // §5.3: Hesaplanan alanlar istek nesnesinde OLMAMALIDIR
    const sentPayload = mockClient.createDraftInvoice.mock.calls[0][0];
    expect(sentPayload.net_value).toBeUndefined();
    expect(sentPayload.total_value).toBeUndefined();
    expect(sentPayload.sales_tax_value).toBeUndefined();

    // Mutabakat okuması yapılmış olmalı
    expect(mockClient.getInvoice).toHaveBeenCalledWith('https://api.sandbox.freeagent.com/v2/invoices/501');

    // §5.2: Yan etkisiz mark_as_sent geçişi çağrılmış olmalı
    expect(mockClient.transitionInvoice).toHaveBeenCalledWith(
      'https://api.sandbox.freeagent.com/v2/invoices/501',
      'mark_as_sent',
    );

    // Sonuç doğrulama
    expect(result.externalId).toBe('501');
    expect(result.externalNumber).toBe('INV-00501');
    expect(result.rawResponse?.documentStatus).toBe('sent');
    expect(result.rawResponse?.reconciled).toBe(true);
  });

  it('mismatch flow: throws AccountingAmountMismatchError and DOES NOT transition (§5.3)', async () => {
    const draftWithMismatch: FreeAgentInvoice = {
      url: 'https://api.sandbox.freeagent.com/v2/invoices/502',
      id: '502',
      contact: 'https://api.sandbox.freeagent.com/v2/contacts/10',
      dated_on: '2026-09-11',
      status: 'Draft',
      total_value: 125, // Fark: 5 GBP
      net_value: 104.17,
      sales_tax_value: 20.83,
      reference: 'INV-00502',
      invoice_items: [],
    };

    mockClient.createDraftInvoice.mockResolvedValue(draftWithMismatch);
    mockClient.getInvoice.mockResolvedValue(draftWithMismatch);

    await expect(
      FreeAgentInvoiceFlow.executeCreateInvoice(mockClient, baseRequest, defaultOptions),
    ).rejects.toThrow(AccountingAmountMismatchError);

    // §5.3: Mutabakat tutmadığında asla mark_as_sent ÇAĞRILMAZ
    expect(mockClient.transitionInvoice).not.toHaveBeenCalled();
  });

  it('requires category mapping and fails early if missing (§3)', async () => {
    await expect(
      FreeAgentInvoiceFlow.executeCreateInvoice(mockClient, baseRequest, {
        environment: 'MOCK',
        // No default category and no mapping provided
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockClient.createDraftInvoice).not.toHaveBeenCalled();
  });
});
