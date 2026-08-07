import { Test, TestingModule } from '@nestjs/testing';
import { StoreService } from './store.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('StoreService', () => {
  let service: StoreService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    store: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    storeUser: {
      findMany: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should return all stores for super admin', async () => {
      const mockStores = [{ id: 'store-1' }, { id: 'store-2' }];
      mockPrismaService.store.findMany.mockResolvedValue(mockStores);

      const result = await service.list('user-1', true);

      expect(result).toEqual(mockStores);
      expect(mockPrismaService.store.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return stores matching authorized agencies or specific stores for normal user', async () => {
      // User has access to store-1 explicitly via StoreUser
      mockPrismaService.storeUser.findMany.mockResolvedValue([{ storeId: 'store-1' }]);
      // User has access to store-2 explicitly via UserRole storeId
      mockPrismaService.userRole.findMany.mockImplementation(async (args: any) => {
        if (args.where.storeId && args.where.storeId.not === null) {
          return [{ storeId: 'store-2' }];
        }
        // General agency access
        if (args.where.storeId === null) {
          return [{ agencyId: 'agency-1' }];
        }
        return [];
      });

      const mockStores = [{ id: 'store-1' }, { id: 'store-2' }, { id: 'store-3', agencyId: 'agency-1' }];
      mockPrismaService.store.findMany.mockResolvedValue(mockStores);

      const result = await service.list('user-1', false);

      expect(result).toEqual(mockStores);
      expect(mockPrismaService.store.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { id: { in: ['store-1', 'store-2'] } },
            { agencyId: { in: ['agency-1'] } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if store does not exist', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue(null);

      await expect(service.get('invalid-store', 'user-1', false)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no access to the store', async () => {
      const mockStore = { id: 'store-1', agencyId: 'agency-1' };
      mockPrismaService.store.findFirst.mockResolvedValue(mockStore);
      // No specific store mapping
      mockPrismaService.storeUser.findMany.mockResolvedValue([]);
      // No roles mapping
      mockPrismaService.userRole.findMany.mockResolvedValue([]);

      await expect(service.get('store-1', 'user-1', false)).rejects.toThrow(ForbiddenException);
    });

    it('should return store if user has general access to the agency', async () => {
      const mockStore = { id: 'store-1', agencyId: 'agency-1' };
      mockPrismaService.store.findFirst.mockResolvedValue(mockStore);

      mockPrismaService.storeUser.findMany.mockResolvedValue([]);
      mockPrismaService.userRole.findMany.mockImplementation(async (args: any) => {
        if (args.where.storeId === null) {
          return [{ agencyId: 'agency-1' }];
        }
        return [];
      });

      const result = await service.get('store-1', 'user-1', false);
      expect(result).toEqual(mockStore);
    });

    it('should return store if user has specific access to the store', async () => {
      const mockStore = { id: 'store-1', agencyId: 'agency-1' };
      mockPrismaService.store.findFirst.mockResolvedValue(mockStore);

      mockPrismaService.storeUser.findMany.mockResolvedValue([{ storeId: 'store-1' }]);
      mockPrismaService.userRole.findMany.mockResolvedValue([]);

      const result = await service.get('store-1', 'user-1', false);
      expect(result).toEqual(mockStore);
    });
  });

  describe('create', () => {
    it('should throw ForbiddenException if user does not belong to agency', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ agencyId: 'agency-1', name: 'New Store' }, 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if client does not belong to agency', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ agencyId: 'agency-1', clientId: 'client-1', name: 'New Store' }, 'user-1', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if store with slug already exists', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });
      mockPrismaService.store.findFirst.mockResolvedValue({ id: 'existing-store' });

      await expect(
        service.create({ agencyId: 'agency-1', name: 'New Store' }, 'user-1', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create store and write audit log', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });
      // slug availability check returns null
      mockPrismaService.store.findFirst.mockResolvedValue(null);

      const mockStore = {
        id: 'store-123',
        agencyId: 'agency-1',
        name: 'New Store',
        slug: 'new-store',
        domain: 'store.com',
        status: 'active',
      };
      mockPrismaService.store.create.mockResolvedValue(mockStore);

      const result = await service.create(
        { agencyId: 'agency-1', name: 'New Store', slug: 'new-store', domain: 'store.com' },
        'user-1',
        false,
        '127.0.0.1',
      );

      expect(result).toEqual(mockStore);
      expect(mockPrismaService.store.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'create',
          entityType: 'Store',
          entityId: 'store-123',
          userId: 'user-1',
          tenantId: 'agency-1',
        }),
      });
    });
  });

  describe('update', () => {
    it('should throw BadRequestException if updated slug already exists in agency', async () => {
      // mock get() behavior
      const mockStore = { id: 'store-123', agencyId: 'agency-1', name: 'Old Name', slug: 'old-slug' };
      mockPrismaService.store.findFirst.mockImplementation(async (args: any) => {
        // first call inside get()
        if (args.where.id === 'store-123') return mockStore;
        // second call for slug checking
        return { id: 'another-store', slug: 'new-slug' };
      });
      // Mock access verify
      mockPrismaService.storeUser.findMany.mockResolvedValue([{ storeId: 'store-123' }]);

      await expect(
        service.update('store-123', { name: 'New Name', slug: 'new-slug' }, 'user-1', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update store and write audit log', async () => {
      const mockStore = { id: 'store-123', agencyId: 'agency-1', name: 'Old Name', slug: 'old-slug', status: 'active', isActive: true };
      mockPrismaService.store.findFirst.mockImplementation(async (args: any) => {
        if (args.where.id === 'store-123') return mockStore;
        return null; // Slug check yields no conflict
      });
      mockPrismaService.storeUser.findMany.mockResolvedValue([{ storeId: 'store-123' }]);

      const updatedStore = { ...mockStore, name: 'New Name', slug: 'new-slug' };
      mockPrismaService.store.update.mockResolvedValue(updatedStore);

      const result = await service.update(
        'store-123',
        { name: 'New Name', slug: 'new-slug' },
        'user-1',
        false,
        '127.0.0.1',
      );

      expect(result).toEqual(updatedStore);
      expect(mockPrismaService.store.update).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'update',
          entityType: 'Store',
          entityId: 'store-123',
          userId: 'user-1',
          tenantId: 'agency-1',
        }),
      });
    });
  });

  describe('delete', () => {
    it('should successfully soft-delete store and write audit log', async () => {
      const mockStore = { id: 'store-123', agencyId: 'agency-1', name: 'Store to Delete', slug: 'delete-me' };
      mockPrismaService.store.findFirst.mockResolvedValue(mockStore);
      mockPrismaService.storeUser.findMany.mockResolvedValue([{ storeId: 'store-123' }]);

      await service.delete('store-123', 'user-1', false, '127.0.0.1');

      expect(mockPrismaService.store.update).toHaveBeenCalledWith({
        where: { id: 'store-123' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
          status: 'suspended',
        },
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'delete',
          entityType: 'Store',
          entityId: 'store-123',
          userId: 'user-1',
          tenantId: 'agency-1',
        }),
      });
    });
  });
});
