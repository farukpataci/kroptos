import { Test, TestingModule } from '@nestjs/testing';
import { StoreService } from './store.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ActorContext } from '../rbac/rbac.service';

const actor: ActorContext = { userId: 'user-1', agencyId: 'agency-1', clientId: null, storeId: null, ipAddress: '127.0.0.1' };

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

      const result = await service.list(actor, true);

      expect(result).toEqual(mockStores);
      expect(mockPrismaService.store.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    // P12a bulgu 8/9: kapsam aktif baglam; rol satirlari/StoreUser yeniden taranmaz
    it('scopes to the ACTIVE agency only; role rows are not re-scanned', async () => {
      mockPrismaService.store.findMany.mockResolvedValue([{ id: 'store-3', agencyId: 'agency-1' }]);

      const result = await service.list(actor, false);

      expect(result).toEqual([{ id: 'store-3', agencyId: 'agency-1' }]);
      expect(mockPrismaService.userRole.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.storeUser.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.store.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, agencyId: 'agency-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('client-scoped context lists only that client stores; store-scoped only its own store', async () => {
      mockPrismaService.store.findMany.mockResolvedValue([]);
      await service.list({ ...actor, clientId: 'client-9' }, false);
      expect(mockPrismaService.store.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, agencyId: 'agency-1', clientId: 'client-9' });
      await service.list({ ...actor, clientId: 'client-9', storeId: 'store-9' }, false);
      expect(mockPrismaService.store.findMany.mock.calls[1][0].where).toEqual({ deletedAt: null, agencyId: 'agency-1', clientId: 'client-9', id: 'store-9' });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if store does not exist', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue(null);

      await expect(service.get('invalid-store', actor, false)).rejects.toThrow(NotFoundException);
    });

    // P12a bulgu 7: agencyId where'de; baska ajansin magazasi 404 (403 oracle yok)
    it("another agency's store → 404 with the scope in the where clause", async () => {
      mockPrismaService.store.findFirst.mockResolvedValue(null);

      await expect(service.get('store-1', actor, false)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.store.findFirst).toHaveBeenCalledWith({ where: { AND: [{ id: 'store-1', deletedAt: null }, { agencyId: 'agency-1' }] } });
      // magaza kapsamli baglam: parametre id ezilmez (canli probe bulgusu)
      await expect(service.get('store-1', { ...actor, storeId: 'store-9' }, false)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.store.findFirst).toHaveBeenLastCalledWith({ where: { AND: [{ id: 'store-1', deletedAt: null }, { agencyId: 'agency-1', id: 'store-9' }] } });
      expect(mockPrismaService.userRole.findMany).not.toHaveBeenCalled();
    });

    it('should return store if it is in the active scope', async () => {
      const mockStore = { id: 'store-1', agencyId: 'agency-1' };
      mockPrismaService.store.findFirst.mockResolvedValue(mockStore);

      const result = await service.get('store-1', actor, false);
      expect(result).toEqual(mockStore);
    });
  });

  describe('create', () => {
    // P12b 0a: agencyId/clientId govdeden degil aktif baglamdan; userRole yeniden sorgulanmaz
    it('takes agency + client from the actor, not the body; body tenant fields are ignored', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue(null);
      mockPrismaService.store.create.mockResolvedValue({ id: 'store-123', agencyId: 'agency-1', name: 'New Store', slug: 'new-store' });

      await service.create({ agencyId: 'agency-B', clientId: 'client-B', name: 'New Store' } as any, { ...actor, clientId: 'client-1' });

      expect(mockPrismaService.userRole.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.store.create.mock.calls[0][0].data).toMatchObject({ agencyId: 'agency-1', clientId: 'client-1' });
      expect(mockPrismaService.store.findFirst).toHaveBeenCalledWith({ where: { agencyId: 'agency-1', slug: 'new-store', deletedAt: null } });
    });

    it('agency-wide context → clientId null', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue(null);
      mockPrismaService.store.create.mockResolvedValue({ id: 's', agencyId: 'agency-1' });
      await service.create({ name: 'X' }, actor);
      expect(mockPrismaService.store.create.mock.calls[0][0].data.clientId).toBeNull();
    });

    it('should throw BadRequestException if store with slug already exists', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue({ id: 'existing-store' });

      await expect(service.create({ name: 'New Store' }, actor)).rejects.toThrow(BadRequestException);
    });

    it('should successfully create store and write audit log', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue(null);
      const mockStore = { id: 'store-123', agencyId: 'agency-1', name: 'New Store', slug: 'new-store', domain: 'store.com' };
      mockPrismaService.store.create.mockResolvedValue(mockStore);

      const result = await service.create({ name: 'New Store', slug: 'new-store', domain: 'store.com' }, actor);

      expect(result).toEqual(mockStore);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'create',
          entityType: 'Store',
          entityId: 'store-123',
          userId: 'user-1',
          tenantId: 'agency-1',
          ipAddress: '127.0.0.1',
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
        if (args.where.AND?.[0]?.id === 'store-123') return mockStore;
        // second call for slug checking
        return { id: 'another-store', slug: 'new-slug' };
      });

      await expect(
        service.update('store-123', { name: 'New Name', slug: 'new-slug' }, actor, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update store and write audit log', async () => {
      const mockStore = { id: 'store-123', agencyId: 'agency-1', name: 'Old Name', slug: 'old-slug', status: 'active', isActive: true };
      mockPrismaService.store.findFirst.mockImplementation(async (args: any) => {
        if (args.where.AND?.[0]?.id === 'store-123') return mockStore;
        return null; // Slug check yields no conflict
      });

      const updatedStore = { ...mockStore, name: 'New Name', slug: 'new-slug' };
      mockPrismaService.store.update.mockResolvedValue(updatedStore);

      const result = await service.update(
        'store-123',
        { name: 'New Name', slug: 'new-slug' },
        actor,
        false,
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

      await service.delete('store-123', actor, false);

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
