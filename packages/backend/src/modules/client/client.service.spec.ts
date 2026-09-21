import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from './client.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { ActorContext } from '../rbac/rbac.service';

const actor: ActorContext = { userId: 'user-id', agencyId: 'agency-1', clientId: null, storeId: null };

describe('ClientService', () => {
  let service: ClientService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    client: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    store: {
      updateMany: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
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
        ClientService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should return all clients for super admin', async () => {
      const mockClients = [{ id: 'client-1' }, { id: 'client-2' }];
      mockPrismaService.client.findMany.mockResolvedValue(mockClients);

      const result = await service.list(actor, true);

      expect(result).toEqual(mockClients);
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    // P12a bulgu 8: kapsam aktif baglam; kullanicinin diger ajanslari (userRole.findMany) hic sorulmaz
    it('scopes to the ACTIVE agency, not every agency the user has a role in', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([{ id: 'client-1' }]);

      const result = await service.list(actor, false);

      expect(result).toEqual([{ id: 'client-1' }]);
      expect(mockPrismaService.userRole.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, agencyId: 'agency-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('client-scoped context sees only its own client', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);
      await service.list({ ...actor, clientId: 'client-9' }, false);
      expect(mockPrismaService.client.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, agencyId: 'agency-1', id: 'client-9' });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if client not found', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.get('invalid-id', actor, false)).rejects.toThrow(NotFoundException);
    });

    // P12a bulgu 7: agencyId where'de; baska ajansin client'i 404 (403 oracle yok)
    it("another agency's client → 404 with the agency in the where clause", async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.get('client-1', actor, false)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.client.findFirst).toHaveBeenCalledWith({ where: { AND: [{ id: 'client-1', deletedAt: null }, { agencyId: 'agency-1' }] } });
      // client kapsamli baglam: parametre id ezilmez, kapsam AND ile eklenir (canli probe bulgusu)
      await expect(service.get('client-1', { ...actor, clientId: 'client-9' }, false)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.client.findFirst).toHaveBeenLastCalledWith({ where: { AND: [{ id: 'client-1', deletedAt: null }, { agencyId: 'agency-1', id: 'client-9' }] } });
      expect(mockPrismaService.userRole.findFirst).not.toHaveBeenCalled();
    });

    it('should return client if it is in the active agency', async () => {
      const mockClient = { id: 'client-1', agencyId: 'agency-1' };
      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);

      const result = await service.get('client-1', actor, false);

      expect(result).toEqual(mockClient);
    });
  });

  describe('create', () => {
    // P12b 0a: agencyId govdeden degil aktif baglamdan; userRole yeniden sorgulanmaz
    it('takes the agency from the actor; body agencyId is ignored; audits under the active agency', async () => {
      mockPrismaService.client.create.mockResolvedValue({ id: 'new-client-id', agencyId: 'agency-1', name: 'New Client' });

      const result = await service.create({ agencyId: 'agency-B', name: 'New Client', email: 'client@example.com' } as any, actor);

      expect(result.id).toBe('new-client-id');
      expect(mockPrismaService.userRole.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.client.create.mock.calls[0][0].data).toMatchObject({ agencyId: 'agency-1', name: 'New Client' });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'create',
          entityType: 'Client',
          entityId: 'new-client-id',
          userId: 'user-id',
          tenantId: 'agency-1',
        }),
      });
    });
  });

  describe('delete', () => {
    it('should soft delete client and related stores', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue({ id: 'client-1', agencyId: 'agency-1', name: 'Client A' });

      await service.delete('client-1', actor, false);

      expect(mockPrismaService.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
          status: 'inactive',
        },
      });
      expect(mockPrismaService.store.updateMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1', deletedAt: null },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
          status: 'suspended',
        },
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'delete',
          entityType: 'Client',
          entityId: 'client-1',
          userId: 'user-id',
          tenantId: 'agency-1',
        }),
      });
    });
  });
});
