import { Test, TestingModule } from '@nestjs/testing';
import { AgencyService } from './agency.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('AgencyService', () => {
  let service: AgencyService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    agency: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    client: {
      updateMany: jest.fn(),
    },
    store: {
      // `get` falls back to resolving the id as a store, to return its owning
      // agency; `delete` cascades the soft delete. Both are needed.
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgencyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AgencyService>(AgencyService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should return all active agencies for super admin', async () => {
      const mockAgencies = [{ id: '1', name: 'Agency A' }, { id: '2', name: 'Agency B' }];
      mockPrismaService.agency.findMany.mockResolvedValue(mockAgencies);

      const result = await service.list('user-id', true);

      expect(result).toEqual(mockAgencies);
      expect(mockPrismaService.agency.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return only associated agencies for non-super admin (tenant isolation)', async () => {
      const mockAgencies = [{ id: '1', name: 'Agency A' }];
      mockPrismaService.agency.findMany.mockResolvedValue(mockAgencies);

      const result = await service.list('user-id', false);

      expect(result).toEqual(mockAgencies);
      expect(mockPrismaService.agency.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          users: {
            some: {
              userId: 'user-id',
              deletedAt: null,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if agency is deleted or not found', async () => {
      mockPrismaService.agency.findFirst.mockResolvedValue(null);
      // The id is then tried as a store id, so that lookup has to miss too —
      // otherwise this would assert nothing about the agency being absent.
      mockPrismaService.store.findFirst.mockResolvedValue(null);

      await expect(service.get('invalid-id', 'user-id', false)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no role in the agency', async () => {
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-id', name: 'Agency A' });
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(service.get('agency-id', 'user-id', false)).rejects.toThrow(ForbiddenException);
    });

    it('should bypass user check and return agency if super admin', async () => {
      const mockAgency = { id: 'agency-id', name: 'Agency A' };
      mockPrismaService.agency.findFirst.mockResolvedValue(mockAgency);

      const result = await service.get('agency-id', 'user-id', true);

      expect(result).toEqual(mockAgency);
      expect(mockPrismaService.userRole.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if slug already exists', async () => {
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'exists' });

      await expect(
        service.create({ name: 'Agency A', slug: 'agency-a' }, 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create agency, owner role, role association, and audit log', async () => {
      mockPrismaService.agency.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-id', name: 'Agency Owner' });
      mockPrismaService.agency.create.mockResolvedValue({
        id: 'new-agency-id',
        name: 'Agency A',
        slug: 'agency-a',
      });

      const response = await service.create({ name: 'Agency A' }, 'user-id');

      expect(response).toHaveProperty('id', 'new-agency-id');
      expect(mockPrismaService.userRole.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update the agency and log it', async () => {
      mockPrismaService.agency.findFirst.mockImplementation(async (args: any) => {
        const idQuery = args?.where?.id || args?.where?.OR?.[0]?.id;
        if (idQuery === 'agency-id') {
          return { id: 'agency-id', name: 'Agency A' };
        }
        return null;
      });
      mockPrismaService.agency.findUnique.mockResolvedValue({ id: 'agency-id', name: 'Agency A' });
      mockPrismaService.agency.update.mockResolvedValue({ id: 'agency-id', name: 'Agency New' });

      const response = await service.update(
        'agency-id',
        { name: 'Agency New' },
        'user-id',
        true,
      );

      expect(response.name).toBe('Agency New');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete agency and cascade to clients, stores, and user roles', async () => {
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-id', name: 'Agency A' });

      await service.delete('agency-id', 'user-id', true);

      expect(mockPrismaService.agency.update).toHaveBeenCalledWith({
        where: { id: 'agency-id' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
      expect(mockPrismaService.client.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.store.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.userRole.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });
});
