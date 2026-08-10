import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { decrypt } from '../../common/utils/encryption.util';
import { MarketplaceSettingsRegistry } from '../../integrations/marketplaces/settings/manifest.registry';
import { SettingsValidator } from '../../integrations/marketplaces/settings/settings.validator';
import { IntegrationService } from '../integration/integration.service';
import { IntegrationSettingsService } from './integration-settings.service';

describe('IntegrationSettingsService', () => {
  let service: IntegrationSettingsService;

  const integration = {
    id: 'int-1',
    agencyId: 'agency-1',
    clientId: 'client-1',
    storeId: 'store-1',
    provider: 'trendyol',
    providerType: 'marketplace',
    name: 'Trendyol – Ana Mağaza',
  };

  let settingRow: any;
  let revisions: any[];
  let auditRows: any[];

  const mockPrisma: any = {
    integration: { findFirst: jest.fn() },
    integrationSetting: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    integrationSettingRevision: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockIntegrationService: any = { get: jest.fn() };

  const ctx = { agencyId: 'agency-1', clientId: 'client-1', storeId: 'store-1', userId: 'user-1' };

  beforeEach(async () => {
    settingRow = {
      id: 'set-1',
      integrationId: 'int-1',
      agencyId: 'agency-1',
      clientId: 'client-1',
      storeId: 'store-1',
      provider: 'trendyol',
      schemaVersion: 1,
      values: {},
      secretsEncrypted: null,
      isConfigured: false,
      completedSteps: [],
      lastAppliedAt: null,
      updatedAt: new Date('2026-07-01T00:00:00Z'),
      deletedAt: null,
    };
    revisions = [];
    auditRows = [];

    jest.clearAllMocks();

    mockIntegrationService.get.mockImplementation(async () => integration);
    mockPrisma.integration.findFirst.mockResolvedValue(integration);
    mockPrisma.integrationSetting.findFirst.mockImplementation(async () => settingRow);
    mockPrisma.integrationSetting.upsert.mockImplementation(async ({ update }: any) => {
      settingRow = { ...settingRow, ...update };
      return settingRow;
    });
    mockPrisma.integrationSetting.update.mockImplementation(async ({ data }: any) => {
      settingRow = { ...settingRow, ...data };
      return settingRow;
    });
    mockPrisma.integrationSettingRevision.findFirst.mockImplementation(async () =>
      revisions.length ? revisions[revisions.length - 1] : null,
    );
    mockPrisma.integrationSettingRevision.create.mockImplementation(async ({ data }: any) => {
      revisions.push(data);
      return data;
    });
    mockPrisma.auditLog.create.mockImplementation(async ({ data }: any) => {
      auditRows.push(data);
      return data;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IntegrationService, useValue: mockIntegrationService },
        MarketplaceSettingsRegistry,
        SettingsValidator,
      ],
    }).compile();

    service = module.get(IntegrationSettingsService);
  });

  describe('getEffective', () => {
    it('merges manifest defaults under the stored values', async () => {
      settingRow.values = { 'stock.bufferQuantity': 5 };

      const result = await service.getEffective('int-1', ctx);

      expect(result.values).toEqual({ 'stock.bufferQuantity': 5 });
      expect(result.effective['stock.bufferQuantity']).toBe(5);
      // untouched, so it still tracks the manifest
      expect(result.effective['stock.minThreshold']).toBe(1);
      expect(result.defaults['stock.minThreshold']).toBe(1);
    });

    it('reports the required fields that are still blank', async () => {
      const result = await service.getEffective('int-1', ctx);

      expect(result.missingRequired).toContain('trendyol.shipmentAddressId');
      expect(result.isConfigured).toBe(false);
    });

    it('propagates the tenant check from IntegrationService.get', async () => {
      mockIntegrationService.get.mockRejectedValueOnce(new ForbiddenException('nope'));

      await expect(service.getEffective('int-1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('refuses non-marketplace integrations', async () => {
      mockIntegrationService.get.mockResolvedValueOnce({ ...integration, providerType: 'erp' });

      await expect(service.getEffective('int-1', ctx)).rejects.toThrow(BadRequestException);
    });
  });

  describe('save', () => {
    it('rejects a key the manifest does not define', async () => {
      await expect(
        service.save('int-1', { 'evil.key': 'x' }, ctx, { partial: true }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.integrationSetting.upsert).not.toHaveBeenCalled();
    });

    it('rejects values that fail validation and writes nothing', async () => {
      await expect(
        service.save('int-1', { 'stock.bufferQuantity': -5 }, ctx, { partial: true }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.integrationSetting.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.integrationSettingRevision.create).not.toHaveBeenCalled();
    });

    it('persists only the values the user diverged on, never the defaults', async () => {
      await service.save('int-1', { 'stock.bufferQuantity': 5 }, ctx, { partial: true });

      const stored = mockPrisma.integrationSetting.upsert.mock.calls[0][0].update.values;
      expect(stored).toEqual({ 'stock.bufferQuantity': 5 });
      expect(stored['stock.minThreshold']).toBeUndefined();
    });

    it('writes a revision and an audit row in the same transaction', async () => {
      await service.save('int-1', { 'stock.bufferQuantity': 5 }, ctx, { partial: true });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(revisions).toHaveLength(1);
      expect(revisions[0].version).toBe(1);
      expect(revisions[0].diff['stock.bufferQuantity']).toEqual({ before: undefined, after: 5 });
      expect(auditRows[0]).toEqual(
        expect.objectContaining({
          action: 'integration.settings.update',
          module: 'integration',
          entityId: 'int-1',
          severity: 'info',
        }),
      );
    });

    it('raises the audit severity when a critical setting changes', async () => {
      await service.save('int-1', { 'advanced.dryRun': true }, ctx, { partial: true });

      expect(auditRows[0].severity).toBe('warning');
    });

    it('increments the revision version', async () => {
      await service.save('int-1', { 'stock.bufferQuantity': 5 }, ctx, { partial: true });
      await service.save('int-1', { 'stock.bufferQuantity': 8 }, ctx, { partial: true });

      expect(revisions.map((r) => r.version)).toEqual([1, 2]);
    });

    it('drops a value whose field the new state hides', async () => {
      settingRow.values = { 'stock.source': 'selected', 'stock.warehouseIds': ['wh-1'] };

      await service.save('int-1', { 'stock.source': 'allWarehouses' }, ctx, { partial: true });

      const stored = mockPrisma.integrationSetting.upsert.mock.calls[0][0].update.values;
      expect(stored['stock.warehouseIds']).toBeUndefined();
      expect(stored['stock.source']).toBe('allWarehouses');
    });

    it('replaces the whole value set on a full save', async () => {
      settingRow.values = { 'stock.bufferQuantity': 5, 'orders.numberPrefix': 'OLD-' };

      await service.save('int-1', { 'stock.bufferQuantity': 9 }, ctx, { partial: false });

      const stored = mockPrisma.integrationSetting.upsert.mock.calls[0][0].update.values;
      expect(stored).toEqual({ 'stock.bufferQuantity': 9 });
    });
  });

  describe('secrets', () => {
    it('stores secret fields encrypted and outside the values column', async () => {
      await service.save(
        'int-1',
        { 'notifications.channels': ['webhook'], 'notifications.webhookUrl': 'https://hooks.example.com/x', 'notifications.webhookSecret': 'super-secret-4821' },
        ctx,
        { partial: true },
      );

      const call = mockPrisma.integrationSetting.upsert.mock.calls[0][0].update;
      expect(call.values['notifications.webhookSecret']).toBeUndefined();
      expect(JSON.parse(decrypt(call.secretsEncrypted))).toEqual({
        'notifications.webhookSecret': 'super-secret-4821',
      });
    });

    it('returns secrets masked, never in the clear', async () => {
      await service.save(
        'int-1',
        { 'notifications.channels': ['webhook'], 'notifications.webhookUrl': 'https://hooks.example.com/x', 'notifications.webhookSecret': 'super-secret-4821' },
        ctx,
        { partial: true },
      );

      const result = await service.getEffective('int-1', ctx);
      expect(result.values['notifications.webhookSecret']).toBe('••••4821');
      expect(JSON.stringify(result)).not.toContain('super-secret-4821');
    });

    it('redacts secrets from the audit trail', async () => {
      await service.save(
        'int-1',
        { 'notifications.channels': ['webhook'], 'notifications.webhookUrl': 'https://hooks.example.com/x', 'notifications.webhookSecret': 'super-secret-4821' },
        ctx,
        { partial: true },
      );

      expect(JSON.stringify(auditRows)).not.toContain('super-secret-4821');
      expect(auditRows[0].newValue['notifications.webhookSecret']).toBe('[REDACTED]');
    });

    it('keeps the stored secret when the client echoes the mask back', async () => {
      await service.save(
        'int-1',
        { 'notifications.channels': ['webhook'], 'notifications.webhookUrl': 'https://hooks.example.com/x', 'notifications.webhookSecret': 'super-secret-4821' },
        ctx,
        { partial: true },
      );
      jest.clearAllMocks();
      mockPrisma.integrationSetting.upsert.mockImplementation(async ({ update }: any) => {
        settingRow = { ...settingRow, ...update };
        return settingRow;
      });
      mockPrisma.integrationSettingRevision.findFirst.mockResolvedValue({ version: 1 });
      mockPrisma.integrationSettingRevision.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.save('int-1', { 'notifications.webhookSecret': '••••4821' }, ctx, {
        partial: true,
      });

      const call = mockPrisma.integrationSetting.upsert.mock.calls[0][0].update;
      expect(JSON.parse(decrypt(call.secretsEncrypted))).toEqual({
        'notifications.webhookSecret': 'super-secret-4821',
      });
    });
  });

  describe('resolveForRuntime', () => {
    it('returns defaults merged with values and decrypted secrets', async () => {
      settingRow.values = { 'stock.bufferQuantity': 7 };

      const runtime = await service.resolveForRuntime('int-1');

      expect(runtime['stock.bufferQuantity']).toBe(7);
      expect(runtime['advanced.rateLimitPerMinute']).toBe(100); // Trendyol's manifest default
    });

    it('serves the cached copy on a repeat read', async () => {
      await service.resolveForRuntime('int-1');
      await service.resolveForRuntime('int-1');

      expect(mockPrisma.integration.findFirst).toHaveBeenCalledTimes(1);
    });

    it('drops the cache after a save', async () => {
      await service.resolveForRuntime('int-1');
      await service.save('int-1', { 'stock.bufferQuantity': 5 }, ctx, { partial: true });
      await service.resolveForRuntime('int-1');

      expect(mockPrisma.integration.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('wizard and sync guard', () => {
    it('activates only once every required step is done and nothing is missing', async () => {
      settingRow.values = {
        'stock.source': 'allWarehouses',
        'fulfillment.model': 'seller',
        'trendyol.shipmentAddressId': 'addr-1',
        'trendyol.returnAddressId': 'addr-2',
      };
      settingRow.completedSteps = ['stock', 'pricing', 'orders'];

      await service.completeWizardStep('int-1', 'fulfillment', undefined, ctx);

      expect(settingRow.completedSteps).toEqual(['stock', 'pricing', 'orders', 'fulfillment']);
      expect(settingRow.isConfigured).toBe(true);
    });

    it('stays unconfigured while a required field is blank', async () => {
      settingRow.completedSteps = ['stock', 'pricing', 'orders'];

      await service.completeWizardStep('int-1', 'fulfillment', undefined, ctx);

      expect(settingRow.isConfigured).toBe(false);
    });

    it('assertConfigured throws while the integration is not configured', async () => {
      settingRow.isConfigured = false;

      await expect(service.assertConfigured('int-1', 'trendyol')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('assertConfigured passes once configured', async () => {
      settingRow.isConfigured = true;

      await expect(service.assertConfigured('int-1', 'trendyol')).resolves.toBeUndefined();
    });

    it('assertConfigured ignores providers with no manifest', async () => {
      // Deliberately a name that will never be registered: this test used to say
      // 'pazarama', which gained a manifest the day that provider shipped.
      await expect(
        service.assertConfigured('int-1', 'definitely-not-a-provider'),
      ).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('clears only the fields of the named section', async () => {
      settingRow.values = { 'stock.bufferQuantity': 5, 'orders.numberPrefix': 'X-' };

      await service.reset('int-1', 'stock.policy', ctx);

      const stored = mockPrisma.integrationSetting.upsert.mock.calls[0][0].update.values;
      expect(stored['stock.bufferQuantity']).toBeUndefined();
      expect(stored['orders.numberPrefix']).toBe('X-');
    });

    it('clears everything when no section is given', async () => {
      settingRow.values = { 'stock.bufferQuantity': 5, 'orders.numberPrefix': 'X-' };

      await service.reset('int-1', undefined, ctx);

      expect(mockPrisma.integrationSetting.upsert.mock.calls[0][0].update.values).toEqual({});
    });
  });
});
