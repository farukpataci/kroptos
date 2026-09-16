import { DatevExportController } from './datev-export.controller';
import { DatevExportService } from '../../integrations/accounting/datev/datev.export-service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DatevExportController', () => {
  let controller: DatevExportController;
  let mockExportService: any;
  let mockPrisma: any;
  let mockSignedUrlService: any;

  beforeEach(() => {
    mockExportService = {
      generateExport: jest.fn().mockResolvedValue({
        batchId: 'batch_test_123',
        fileName: 'EXTF_Buchungsstapel_batch_test_123.csv',
        fileBuffer: Buffer.from('test-csv-content'),
        hashSha256: 'abc123hash',
        encoding: 'WINDOWS-1252',
        datumVon: '2026-01-01',
        datumBis: '2026-01-31',
        totalDebit: 0,
        totalCredit: 119.0,
        entryCount: 1,
        orderIds: ['ord-1'],
        reexportedOrderIds: [],
      }),
    };

    mockPrisma = {
      accountingDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            externalNumber: 'batch_test_123',
            externalId: 'abc123hash',
            companyId: 'comp-1',
            createdAt: new Date('2026-01-31T12:00:00.000Z'),
            totalAmount: 119.0,
            currency: 'EUR',
          },
        ]),
        findFirst: jest.fn(),
      },
      accountingCompany: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'comp-1',
          agencyId: 'agency-1',
          defaultAccountCodes: {
            beraterNummer: 1001,
            mandantenNummer: 12345,
            wjBeginn: '2026-01-01',
            sachkontenLaenge: 4,
            kontenrahmen: 'SKR03',
          },
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'comp-1',
            defaultAccountCodes: data.defaultAccountCodes,
          }),
        ),
      },
    };

    mockSignedUrlService = {
      generateSignedToken: jest.fn().mockReturnValue('mock-signed-token-xyz'),
    };

    controller = new DatevExportController(
      mockExportService as unknown as DatevExportService,
      mockPrisma,
      mockSignedUrlService,
    );
  });

  // P12a bulgu 6: kapsam TenantMiddleware'in yazdigi activeAgency'den; ham header tek basina yetmez.
  const mockReq = {
    headers: { 'x-agency-id': 'agency-1' },
    activeAgency: { id: 'agency-1' },
    user: { id: 'user-1', email: 'test@kroptos.com', name: 'Tester' },
    ip: '127.0.0.1',
  } as any;

  it('raw x-agency-id header without a validated context → 400', async () => {
    const headerOnly = { ...mockReq, activeAgency: undefined, user: { id: 'user-1' } };
    await expect(controller.listExports('comp-1', headerOnly)).rejects.toThrow(BadRequestException);
  });

  describe('generateExport', () => {
    it('calls service, caches buffer, and returns download URL and token', async () => {
      const res = await controller.generateExport(
        {
          companyId: 'comp-1',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        },
        mockReq,
      );

      expect(res.success).toBe(true);
      expect(res.batchId).toBe('batch_test_123');
      expect(res.downloadToken).toBe('mock-signed-token-xyz');
      expect(res.downloadUrl).toContain('batch_test_123');
    });
  });

  describe('downloadExport', () => {
    it('sets correct response headers and sends cached buffer', async () => {
      // First generate to populate cache
      await controller.generateExport(
        {
          companyId: 'comp-1',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        },
        mockReq,
      );

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.downloadExport('batch_test_123', mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=windows-1252',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="EXTF_Buchungsstapel_batch_test_123.csv"',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Datev-SHA256', 'abc123hash');
      expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('test-csv-content'));
    });

    it('throws NotFoundException when batch is not found', async () => {
      mockPrisma.accountingDocument.findFirst.mockResolvedValue(null);
      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;

      await expect(
        controller.downloadExport('non-existent', mockReq, mockRes),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listExports', () => {
    it('returns grouped batch summaries', async () => {
      const list = await controller.listExports('comp-1', mockReq);
      expect(list).toHaveLength(1);
      expect(list[0].batchId).toBe('batch_test_123');
      expect(list[0].totalAmount).toBe(119.0);
    });
  });

  describe('config management', () => {
    it('retrieves company DATEV config', async () => {
      const config = await controller.getConfig('comp-1', mockReq);
      expect(config.beraterNummer).toBe(1001);
      expect(config.kontenrahmen).toBe('SKR03');
    });

    it('validates and saves company DATEV config', async () => {
      const newConfig: any = {
        beraterNummer: 2002,
        mandantenNummer: 54321,
        wjBeginn: '2026-01-01',
        sachkontenLaenge: 4,
        kontenrahmen: 'SKR04',
      };

      const res = await controller.saveConfig('comp-1', newConfig, mockReq);
      expect(res.success).toBe(true);
      expect(mockPrisma.accountingCompany.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comp-1' },
        }),
      );
    });
  });
});
