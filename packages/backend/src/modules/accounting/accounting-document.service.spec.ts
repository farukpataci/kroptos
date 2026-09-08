import { AccountingIdempotencyError } from '../../integrations/accounting/core/AccountingErrors';
import { AccountingDocumentService } from './accounting-document.service';

describe('AccountingDocumentService (Reservation-First Idempotency)', () => {
  let service: AccountingDocumentService;
  let mockPrisma: any;
  let mockConnectorFactory: any;
  let mockCredentialsService: any;
  let mockMappingService: any;
  let mockConnector: any;

  const validDto: any = {
    integrationId: 'int-1',
    companyId: 'comp-1',
    storeId: 'store-1',
    referenceCode: 'ORD-TEST-99',
    issueDate: '2026-09-08',
    currency: 'TRY',
    contact: { name: 'Müşteri', email: 'm@example.com' },
    items: [
      {
        sku: 'SKU-1',
        name: 'Ürün',
        quantity: 1,
        unitPrice: 100,
        vatRate: 20,
        totalAmount: 120,
      },
    ],
    subtotal: 100,
    vatTotal: 20,
    grandTotal: 120,
  };

  beforeEach(() => {
    mockConnector = {
      createInvoice: jest.fn().mockResolvedValue({
        externalId: 'parasut-inv-500',
        externalNumber: 'INV-2026-0001',
      }),
      recordPayment: jest.fn().mockResolvedValue({
        externalId: 'parasut-pay-500',
      }),
    };

    mockConnectorFactory = {
      create: jest.fn().mockReturnValue(mockConnector),
    };

    mockCredentialsService = {
      decrypt: jest.fn().mockReturnValue({}),
    };

    mockMappingService = {
      getOrSyncContact: jest.fn().mockResolvedValue({ externalContactId: 'cnt-1' }),
      getOrSyncProduct: jest.fn().mockResolvedValue({ externalProductId: 'prd-1' }),
    };

    mockPrisma = {
      accountingIntegration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'int-1',
          provider: 'PARASUT',
          environment: 'MOCK',
          companies: [{ id: 'comp-1', externalCompanyId: 'ext-comp-1' }],
        }),
      },
      accountingDocument: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new AccountingDocumentService(
      mockPrisma,
      mockConnectorFactory,
      mockCredentialsService,
      mockMappingService,
    );
  });

  it('1. Fatura talebinde önce pending rezervasyon kaydı açılır, ardından created durumuna güncellenir', async () => {
    mockPrisma.accountingDocument.findUnique.mockResolvedValue(null);
    mockPrisma.accountingDocument.create.mockResolvedValue({
      id: 'doc-1',
      status: 'pending',
      referenceCode: 'ORD-TEST-99',
    });
    mockPrisma.accountingDocument.update.mockResolvedValue({
      id: 'doc-1',
      status: 'created',
      externalId: 'parasut-inv-500',
      externalNumber: 'INV-2026-0001',
    });

    const result = await service.createInvoiceDocument(validDto, { agencyId: 'ag-1' });

    expect(mockPrisma.accountingDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          referenceCode: 'ORD-TEST-99',
          type: 'sales_invoice',
        }),
      }),
    );
    expect(mockConnector.createInvoice).toHaveBeenCalled();
    expect(result.status).toBe('created');
    expect(result.externalId).toBe('parasut-inv-500');
  });

  it('2. Zaten oluşturulmuş (status: created) referans için tekrar istek geldiğinde connector çağrılmadan mevcut kayıt döner', async () => {
    mockPrisma.accountingDocument.findUnique.mockResolvedValue({
      id: 'doc-existing',
      status: 'created',
      referenceCode: 'ORD-TEST-99',
      externalId: 'parasut-inv-existing',
    });

    const result = await service.createInvoiceDocument(validDto, { agencyId: 'ag-1' });

    expect(result.id).toBe('doc-existing');
    expect(mockPrisma.accountingDocument.create).not.toHaveBeenCalled();
    expect(mockConnector.createInvoice).not.toHaveBeenCalled();
  });

  it('3. İşlem devam ederken (status: pending) mükerrer çağrıda AccountingIdempotencyError fırlatır', async () => {
    mockPrisma.accountingDocument.findUnique.mockResolvedValue({
      id: 'doc-in-progress',
      status: 'pending',
      referenceCode: 'ORD-TEST-99',
    });

    await expect(
      service.createInvoiceDocument(validDto, { agencyId: 'ag-1' }),
    ).rejects.toThrow(AccountingIdempotencyError);

    expect(mockConnector.createInvoice).not.toHaveBeenCalled();
  });

  it('4. Connector hata verirse belge durumu failed olarak işaretlenir', async () => {
    mockPrisma.accountingDocument.findUnique.mockResolvedValue(null);
    mockPrisma.accountingDocument.create.mockResolvedValue({
      id: 'doc-fail',
      status: 'pending',
    });
    mockConnector.createInvoice.mockRejectedValue(new Error('KDV oranı geçersiz'));

    await expect(
      service.createInvoiceDocument(validDto, { agencyId: 'ag-1' }),
    ).rejects.toThrow('KDV oranı geçersiz');

    expect(mockPrisma.accountingDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-fail' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'KDV oranı geçersiz',
        }),
      }),
    );
  });

  describe('cancelLocally', () => {
    it('should throw BadRequestException if acknowledgeManualCancel is false', async () => {
      await expect(
        service.cancelLocally(
          'doc-1',
          { acknowledgeManualCancel: false },
          { agencyId: 'ag-1' },
        ),
      ).rejects.toThrow('Sağlayıcı panelinden elle iptal edildiği/edileceği onaylanmalıdır.');
    });

    it('should cancel locally and record note when acknowledged', async () => {
      mockPrisma.accountingDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        agencyId: 'ag-1',
        referenceCode: 'INV-001',
        externalId: 'ext-001',
      });
      mockPrisma.accountingDocument.update.mockResolvedValue({
        id: 'doc-1',
        status: 'cancelled',
      });

      const res = await service.cancelLocally(
        'doc-1',
        { acknowledgeManualCancel: true, reason: 'Müşteri iptal talebi' },
        { agencyId: 'ag-1' },
      );

      expect(res.status).toBe('cancelled');
      expect(mockPrisma.accountingDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            status: 'cancelled',
            errorMessage: '[yerel iptal] Müşteri iptal talebi',
          }),
        }),
      );
    });
  });

  describe('attachExternal', () => {
    it('should throw BadRequestException if externalId is empty', async () => {
      await expect(
        service.attachExternal(
          'doc-1',
          { externalId: '   ' },
          { agencyId: 'ag-1' },
        ),
      ).rejects.toThrow('Harici belge GUID / ID bilgisi zorunludur.');
    });

    it('should attach externalId and externalNumber and mark created', async () => {
      mockPrisma.accountingDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        agencyId: 'ag-1',
        referenceCode: 'INV-001',
      });
      mockPrisma.accountingDocument.update.mockResolvedValue({
        id: 'doc-1',
        status: 'created',
        externalId: 'bh-guid-888',
        externalNumber: 'BH-INV-001',
      });

      const res = await service.attachExternal(
        'doc-1',
        { externalId: 'bh-guid-888', externalNumber: 'BH-INV-001' },
        { agencyId: 'ag-1' },
      );

      expect(res.status).toBe('created');
      expect(mockPrisma.accountingDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            status: 'created',
            externalId: 'bh-guid-888',
            externalNumber: 'BH-INV-001',
            errorMessage: null,
          }),
        }),
      );
    });
  });
});
