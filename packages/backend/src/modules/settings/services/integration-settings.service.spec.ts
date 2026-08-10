import { Test, TestingModule } from '@nestjs/testing';
import { GoneException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { IntegrationSettingsService } from './integration-settings.service';

/**
 * The bug this pins: the System Settings grid read its own `IntegrationSettings`
 * table, which nothing wrote when a marketplace was connected under
 * /integrations. Trendyol could be live and this screen still said
 * "Disconnected" — forever, with no way to change it from either side.
 */
describe('IntegrationSettingsService (legacy read model)', () => {
  let service: IntegrationSettingsService;

  const mockPrismaService: any = {
    integration: { findMany: jest.fn() },
    integrationQueue: { groupBy: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationSettingsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<IntegrationSettingsService>(IntegrationSettingsService);
    jest.clearAllMocks();
    mockPrismaService.integrationQueue.groupBy.mockResolvedValue([]);
  });

  describe('findAll', () => {
    it('reports a live active integration as connected', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([
        { id: 'int-1', provider: 'trendyol', status: 'active', lastSyncAt: null },
      ]);

      const rows = await service.findAll('agency-1');
      const trendyol = rows.find((r) => r.provider === 'trendyol');

      expect(trendyol).toMatchObject({ status: 'connected', isActive: true });
    });

    it('maps an errored integration to failed rather than a passive placeholder', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([
        { id: 'int-1', provider: 'hepsiburada', status: 'error', lastSyncAt: null },
      ]);

      const rows = await service.findAll('agency-1');

      expect(rows.find((r) => r.provider === 'hepsiburada')).toMatchObject({
        status: 'failed',
        isActive: false,
      });
    });

    it('scopes the query to the agency and excludes soft-deleted rows', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([]);

      await service.findAll('agency-1');

      expect(mockPrismaService.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agencyId: 'agency-1', deletedAt: null },
        }),
      );
    });

    it('does not surface a deleted integration as connected', async () => {
      // `findMany` filters `deletedAt: null`, so a deleted Trendyol row simply
      // is not returned — what remains is the disconnected placeholder.
      mockPrismaService.integration.findMany.mockResolvedValue([]);

      const rows = await service.findAll('agency-1');
      const trendyol = rows.find((r) => r.provider === 'trendyol');

      expect(trendyol).toMatchObject({ status: 'disconnected', isActive: false });
      expect(rows.every((r) => r.status !== 'connected')).toBe(true);
    });

    it('never echoes credentials into the response', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([
        { id: 'int-1', provider: 'trendyol', status: 'active', lastSyncAt: null },
      ]);

      const rows = await service.findAll('agency-1');

      for (const row of rows) {
        expect(row.config).toEqual({});
        expect(JSON.stringify(row)).not.toMatch(/apiKey|apiSecret|credential/i);
      }
    });

    it('derives errorCount from failed queue jobs instead of a stale column', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([
        { id: 'int-1', provider: 'trendyol', status: 'active', lastSyncAt: null },
      ]);
      mockPrismaService.integrationQueue.groupBy.mockResolvedValue([
        { configId: 'int-1', _count: { configId: 3 } },
      ]);

      const rows = await service.findAll('agency-1');

      expect(rows.find((r) => r.provider === 'trendyol')?.errorCount).toBe(3);
    });

    it('still lists placeholder providers so the grid keeps its shape', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([]);

      const rows = await service.findAll('agency-1');

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((r) => r.provider)).toEqual(expect.arrayContaining(['trendyol', 'amazon']));
    });

    it('does not duplicate a provider that is both connected and a placeholder', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([
        { id: 'int-1', provider: 'Trendyol', status: 'active', lastSyncAt: null },
      ]);

      const rows = await service.findAll('agency-1');

      expect(rows.filter((r) => r.provider === 'trendyol')).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('refuses the retired write path loudly instead of silently doing nothing', async () => {
      await expect(service.update()).rejects.toBeInstanceOf(GoneException);
    });

    it('points the caller at the endpoint that replaced it', async () => {
      await expect(service.update()).rejects.toThrow(/\/integrations/);
    });
  });
});
