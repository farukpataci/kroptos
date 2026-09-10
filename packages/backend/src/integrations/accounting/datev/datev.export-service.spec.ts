import * as crypto from 'crypto';
import { DatevExportService, DatevReexportError } from './datev.export-service';
import { DatevConfig, DatevInvoiceInput } from './datev.types';
import { DatevValidationError } from './datev.validation';

describe('DatevExportService', () => {
  const validConfig: DatevConfig = {
    beraterNummer: 1001,
    mandantenNummer: 12345,
    wjBeginn: '2026-01-01',
    sachkontenLaenge: 4,
    kontenrahmen: 'SKR03',
    festschreibung: 0,
    encoding: 'WINDOWS-1252',
  };

  const sampleInvoice: DatevInvoiceInput = {
    orderId: 'ord-1001',
    invoiceNumber: 'RE-2026-1001',
    issueDate: '2026-01-15',
    grandTotal: 119.0,
    customerNumber: 10001,
    customerName: 'Max Mustermann',
    items: [
      {
        name: 'Produkt A',
        quantity: 1,
        unitPrice: 100.0,
        vatRate: 19,
        vatAmount: 19.0,
        totalAmount: 119.0,
      },
    ],
  };

  describe('exportBuchungsstapel (Pure Function §5, §6)', () => {
    it('generates a valid export result with buffer and correct SHA-256 hash', () => {
      const service = new DatevExportService();
      const result = service.exportBuchungsstapel({
        config: validConfig,
        invoices: [sampleInvoice],
        datumVon: '2026-01-01',
        datumBis: '2026-01-31',
        batchId: 'batch_test_1',
      });

      expect(result.batchId).toBe('batch_test_1');
      expect(result.fileName).toBe('EXTF_Buchungsstapel_batch_test_1.csv');
      expect(result.entryCount).toBe(1);
      expect(result.totalCredit).toBe(119.0);
      expect(result.totalDebit).toBe(0);

      // Verify SHA-256
      const expectedHash = crypto.createHash('sha256').update(result.fileBuffer).digest('hex');
      expect(result.hashSha256).toBe(expectedHash);
    });

    it('throws DatevValidationError when config is invalid', () => {
      const service = new DatevExportService();
      const invalidConfig = { ...validConfig, beraterNummer: 999 }; // < 1001

      expect(() => {
        service.exportBuchungsstapel({
          config: invalidConfig,
          invoices: [sampleInvoice],
          datumVon: '2026-01-01',
          datumBis: '2026-01-31',
        });
      }).toThrow(DatevValidationError);
    });

    it('throws DatevValidationError when date range is violated', () => {
      const service = new DatevExportService();
      expect(() => {
        service.exportBuchungsstapel({
          config: validConfig,
          invoices: [sampleInvoice], // issueDate: 2026-01-15
          datumVon: '2026-02-01',    // outside date range!
          datumBis: '2026-02-28',
        });
      }).toThrow(DatevValidationError);
    });
  });

  describe('generateExport with DB & GoBD re-export protection (§8.4)', () => {
    let mockPrisma: any;
    let mockAuditLogService: any;
    let service: DatevExportService;

    beforeEach(() => {
      mockPrisma = {
        accountingCompany: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'comp-1',
            agencyId: 'agency-1',
            integrationId: 'integ-1',
            defaultAccountCodes: validConfig,
          }),
        },
        order: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'ord-1001',
              storeId: 'store-1',
              orderNumber: 'RE-2026-1001',
              createdAt: new Date('2026-01-15T10:00:00.000Z'),
              totalAmount: 119.0,
              currency: 'EUR',
              customerId: 'cust-1',
              customerName: 'Max Mustermann',
              items: [
                {
                  sku: 'SKU-1',
                  name: 'Produkt A',
                  quantity: 1,
                  unitPrice: 100.0,
                  totalPrice: 119.0,
                },
              ],
            },
          ]),
        },
        accountingDocument: {
          findMany: jest.fn(),
          upsert: jest.fn().mockResolvedValue({}),
        },
      };

      mockAuditLogService = {
        createLog: jest.fn().mockResolvedValue({}),
      };

      service = new DatevExportService(mockPrisma, mockAuditLogService);
    });

    it('successfully generates export and saves GoBD claims when not previously exported', async () => {
      mockPrisma.accountingDocument.findMany.mockResolvedValue([]); // No previous exports

      const result = await service.generateExport(
        {
          companyId: 'comp-1',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        },
        {
          agencyId: 'agency-1',
          userId: 'user-1',
        },
      );

      expect(result.entryCount).toBe(1);
      expect(mockPrisma.accountingDocument.upsert).toHaveBeenCalled();
      expect(mockAuditLogService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DATEV_EXPORT_GENERATED',
          tenantId: 'agency-1',
        }),
      );
    });

    it('throws DatevReexportError when order was previously exported and acknowledgeReexport is falsy', async () => {
      mockPrisma.accountingDocument.findMany.mockResolvedValue([
        { referenceCode: 'ord-1001' },
      ]);

      await expect(
        service.generateExport(
          {
            companyId: 'comp-1',
            dateFrom: '2026-01-01',
            dateTo: '2026-01-31',
            acknowledgeReexport: false,
          },
          {
            agencyId: 'agency-1',
          },
        ),
      ).rejects.toThrow(DatevReexportError);

      expect(mockPrisma.accountingDocument.upsert).not.toHaveBeenCalled();
    });

    it('proceeds with re-export when acknowledgeReexport is explicitly true', async () => {
      mockPrisma.accountingDocument.findMany.mockResolvedValue([
        { referenceCode: 'ord-1001' },
      ]);

      const result = await service.generateExport(
        {
          companyId: 'comp-1',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
          acknowledgeReexport: true,
        },
        {
          agencyId: 'agency-1',
          userId: 'user-1',
        },
      );

      expect(result.entryCount).toBe(1);
      expect(result.reexportedOrderIds).toEqual(['ord-1001']);
      expect(mockPrisma.accountingDocument.upsert).toHaveBeenCalled();
    });
  });
});
