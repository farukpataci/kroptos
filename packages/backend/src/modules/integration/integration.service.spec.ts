import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationService } from './integration.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { encrypt, decrypt } from '../../common/utils/encryption.util';
import { MarketplaceCredentialService } from '../../integrations/marketplaces/core/MarketplaceCredentialService';
import { MarketplaceConnectorFactory } from '../../integrations/marketplaces/core/MarketplaceConnectorFactory';
import { IntegrationQueueService } from './integration-queue.service';
import { ErpConnectorFactory } from '../../integrations/erp/core/ErpConnectorFactory';
import { IntegrationSettingsService } from '../integration-settings/integration-settings.service';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    integration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    apiLog: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockCredentialService: any = {
    decrypt: jest.fn((val) => JSON.parse(decrypt(val))),
    validate: jest.fn(),
    persistRotatedCredentials: jest.fn(),
  };

  const mockConnectorFactory: any = {
    create: jest.fn().mockImplementation((provider, credentials) => {
      return {
        // Every connector exposes this; an OAuth one may return a replacement
        // refresh token here after authenticating.
        consumeRotatedCredentials: jest.fn().mockReturnValue(undefined),
        testConnection: jest.fn().mockImplementation(() => {
          const containsInvalid = Object.values(credentials || {}).some(
            (val: any) => typeof val === 'string' && val.toLowerCase().includes('invalid')
          );
          if (containsInvalid) {
            return Promise.resolve({ success: false, message: 'Invalid connection parameters', durationMs: 10 });
          }
          return Promise.resolve({ success: true, message: 'Connection verified successfully.', durationMs: 10 });
        })
      };
    })
  };

  const mockIntegrationQueueService = {
    addSyncJob: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };

  const mockErpConnectorFactory: any = {
    create: jest.fn(),
  };

  const mockSettingsService: any = {
    ensureForIntegration: jest.fn(),
    softDeleteForIntegration: jest.fn(),
    assertConfigured: jest.fn(),
    resolveForRuntime: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MarketplaceCredentialService, useValue: mockCredentialService },
        { provide: MarketplaceConnectorFactory, useValue: mockConnectorFactory },
        { provide: ErpConnectorFactory, useValue: mockErpConnectorFactory },
        { provide: IntegrationQueueService, useValue: mockIntegrationQueueService },
        { provide: IntegrationSettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should throw BadRequestException if tenant context is missing for normal user', async () => {
      await expect(
        service.list(undefined, undefined, undefined, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return list of integrations under active store context', async () => {
      const mockIntegrations = [{ id: 'int-1', name: 'Trendyol' }];
      mockPrismaService.integration.findMany.mockResolvedValue(mockIntegrations);

      const result = await service.list('agency-1', 'client-1', 'store-1', false);

      expect(result).toEqual(mockIntegrations);
      expect(mockPrismaService.integration.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { storeId: 'store-1' },
            { storeId: null, clientId: 'client-1', agencyId: 'agency-1' },
            { storeId: null, clientId: null, agencyId: 'agency-1' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          setting: {
            select: { isConfigured: true, completedSteps: true, deletedAt: true },
          },
          store: {
            select: { id: true, name: true },
          },
        },
      });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if integration does not exist', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(null);

      await expect(
        service.get('int-id', 'agency-1', 'client-1', 'store-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if integration agency context mismatch', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue({
        id: 'int-1',
        agencyId: 'agency-different',
      });

      await expect(
        service.get('int-1', 'agency-1', 'client-1', 'store-1', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should create integration and encrypt raw credentials', async () => {
      const mockResult = {
        id: 'int-123',
        agencyId: 'agency-1',
        name: 'Trendyol',
        provider: 'trendyol',
        providerType: 'marketplace',
      };
      mockPrismaService.integration.create.mockResolvedValue(mockResult);

      const result = await service.create(
        {
          agencyId: 'agency-1',
          provider: 'trendyol',
          providerType: 'marketplace',
          name: 'Trendyol',
          credentials: { apiKey: 'key123', apiSecret: 'secret123' },
        },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        '127.0.0.1',
      );

      expect(result).toEqual(mockResult);
      expect(mockPrismaService.integration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agencyId: 'agency-1',
          name: 'Trendyol',
          credentialsEncrypted: expect.any(String),
        }),
      });
      // Verify credentials are encrypted
      const encryptedValue = mockPrismaService.integration.create.mock.calls[0][0].data.credentialsEncrypted;
      const decrypted = JSON.parse(decrypt(encryptedValue));
      expect(decrypted).toEqual({ apiKey: 'key123', apiSecret: 'secret123' });
    });
  });

  describe('update', () => {
    it('should merge credentials if updated', async () => {
      const oldCreds = encrypt(JSON.stringify({ apiKey: 'key-old', apiSecret: 'secret-old' }));
      const existing = {
        id: 'int-123',
        agencyId: 'agency-1',
        name: 'Old Name',
        credentialsEncrypted: oldCreds,
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(existing);
      mockPrismaService.integration.update.mockResolvedValue({
        ...existing,
        name: 'New Name',
      });

      await service.update(
        'int-123',
        { name: 'New Name', credentials: { apiKey: 'key-new' } },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        '127.0.0.1',
      );

      expect(mockPrismaService.integration.update).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        data: expect.objectContaining({
          name: 'New Name',
          credentialsEncrypted: expect.any(String),
        }),
      });

      const encryptedValue = mockPrismaService.integration.update.mock.calls[0][0].data.credentialsEncrypted;
      const decrypted = JSON.parse(decrypt(encryptedValue));
      expect(decrypted).toEqual({ apiKey: 'key-new', apiSecret: 'secret-old' });
    });
  });

  describe('delete', () => {
    it('should successfully soft-delete integration', async () => {
      const existing = {
        id: 'int-123',
        agencyId: 'agency-1',
        name: 'Trendyol',
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(existing);

      await service.delete('int-123', 'user-1', 'agency-1', 'client-1', 'store-1', '127.0.0.1');

      expect(mockPrismaService.integration.update).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        data: {
          deletedAt: expect.any(Date),
          status: 'inactive',
        },
      });
    });
  });

  describe('testConnection', () => {
    it('should pass connection test and log to apiLog', async () => {
      const oldCreds = encrypt(JSON.stringify({ apiKey: 'valid-key', apiSecret: 'valid-secret', sellerId: '123' }));
      const existing = {
        id: 'int-123',
        agencyId: 'agency-1',
        name: 'Trendyol',
        provider: 'trendyol',
        providerType: 'marketplace',
        status: 'active',
        credentialsEncrypted: oldCreds,
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(existing);

      const result = await service.testConnection('int-123', 'user-1', 'agency-1', 'client-1', 'store-1', false);

      expect(result.success).toBe(true);
      expect(mockPrismaService.apiLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: 'int-123',
          statusCode: 200,
          errorMessage: null,
        }),
      });
    });

    it('persists a refresh token the marketplace rotated while authenticating', async () => {
      // Without this the new token lives only in memory: the integration keeps
      // working until the process restarts and then cannot authenticate at all.
      const existing = {
        id: 'int-123',
        agencyId: 'agency-1',
        name: 'Etsy',
        provider: 'etsy',
        providerType: 'marketplace',
        status: 'active',
        credentialsEncrypted: encrypt(JSON.stringify({ keystring: 'k', refreshToken: 'old' })),
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(existing);
      mockConnectorFactory.create.mockReturnValueOnce({
        consumeRotatedCredentials: jest.fn().mockReturnValue({ refreshToken: 'rotated' }),
        testConnection: jest.fn().mockResolvedValue({ success: true, message: 'ok', durationMs: 1 }),
      });

      await service.testConnection('int-123', 'user-1', 'agency-1', 'client-1', 'store-1', false);

      expect(mockCredentialService.persistRotatedCredentials).toHaveBeenCalledWith('int-123', {
        refreshToken: 'rotated',
      });
    });

    it('does not write credentials when nothing rotated', async () => {
      const existing = {
        id: 'int-123',
        agencyId: 'agency-1',
        name: 'Trendyol',
        provider: 'trendyol',
        providerType: 'marketplace',
        status: 'active',
        credentialsEncrypted: encrypt(JSON.stringify({ apiKey: 'valid', apiSecret: 's', sellerId: '1' })),
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(existing);

      await service.testConnection('int-123', 'user-1', 'agency-1', 'client-1', 'store-1', false);

      expect(mockCredentialService.persistRotatedCredentials).not.toHaveBeenCalled();
    });

    it('should fail connection test if credentials contain invalid text and updates status to error', async () => {
      const oldCreds = encrypt(JSON.stringify({ apiKey: 'invalid-key', apiSecret: 'secret', sellerId: '123' }));
      const existing = {
        id: 'int-123',
        agencyId: 'agency-1',
        name: 'Trendyol',
        provider: 'trendyol',
        providerType: 'marketplace',
        status: 'active',
        credentialsEncrypted: oldCreds,
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(existing);

      const result = await service.testConnection('int-123', 'user-1', 'agency-1', 'client-1', 'store-1', false);

      expect(result.success).toBe(false);
      expect(mockPrismaService.apiLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: 'int-123',
          statusCode: 400,
          errorMessage: expect.any(String),
        }),
      });
      expect(mockPrismaService.integration.update).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        data: { status: 'error' },
      });
    });
  });

  describe('triggerSync', () => {
    const marketplaceIntegration = {
      id: 'int-123',
      agencyId: 'agency-1',
      clientId: 'client-1',
      storeId: 'store-1',
      name: 'Trendyol',
      provider: 'trendyol',
      providerType: 'marketplace',
      status: 'active',
      credentialsEncrypted: encrypt(JSON.stringify({ apiKey: 'key' })),
    };

    it('should refuse to queue jobs while the integration is not configured', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(marketplaceIntegration);
      mockSettingsService.assertConfigured.mockRejectedValueOnce(
        new BadRequestException('integration.settings.notConfigured'),
      );

      await expect(
        service.triggerSync('int-123', 'agency-1', 'client-1', 'store-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockIntegrationQueueService.addSyncJob).not.toHaveBeenCalled();
    });

    it('should queue product and order jobs once configured', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(marketplaceIntegration);
      mockSettingsService.assertConfigured.mockResolvedValueOnce(undefined);

      const result = await service.triggerSync('int-123', 'agency-1', 'client-1', 'store-1');

      expect(result.success).toBe(true);
      expect(mockIntegrationQueueService.addSyncJob).toHaveBeenCalledWith(
        'int-123',
        'sync_products',
        {},
      );
      expect(mockIntegrationQueueService.addSyncJob).toHaveBeenCalledWith(
        'int-123',
        'sync_orders',
        {},
      );
    });
  });
});
