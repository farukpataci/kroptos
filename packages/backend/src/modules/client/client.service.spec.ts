import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from './client.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

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

      const result = await service.list('user-id', true);

      expect(result).toEqual(mockClients);
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should only return clients of authorized agencies for normal user', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([{ agencyId: 'agency-1' }]);
      mockPrismaService.client.findMany.mockResolvedValue([{ id: 'client-1' }]);

      const result = await service.list('user-id', false);

      expect(result).toEqual([{ id: 'client-1' }]);
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, agencyId: { in: ['agency-1'] } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if client not found', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.get('invalid-id', 'user-id', false)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no access to the client agency', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue({ id: 'client-1', agencyId: 'agency-1' });
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(service.get('client-1', 'user-id', false)).rejects.toThrow(ForbiddenException);
    });

    it('should return client if user is authorized', async () => {
      const mockClient = { id: 'client-1', agencyId: 'agency-1' };
      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });

      const result = await service.get('client-1', 'user-id', false);

      expect(result).toEqual(mockClient);
    });
  });

  describe('create', () => {
    it('should create client and audit log', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });
      mockPrismaService.client.create.mockResolvedValue({ id: 'new-client-id', agencyId: 'agency-1', name: 'New Client' });

      const result = await service.create(
        { agencyId: 'agency-1', name: 'New Client', email: 'client@example.com' },
        'user-id',
        false,
      );

      expect(result.id).toBe('new-client-id');
      expect(mockPrismaService.client.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete client and related stores', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue({ id: 'client-1', agencyId: 'agency-1', name: 'Client A' });
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });

      await service.delete('client-1', 'user-id', false);

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
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });
});
