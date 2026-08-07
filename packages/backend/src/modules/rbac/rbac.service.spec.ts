import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RbacService', () => {
  let service: RbacService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    role: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    agency: {
      findFirst: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    store: {
      findFirst: jest.fn(),
    },
    userRole: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listRoles', () => {
    it('should return all roles with permissions', async () => {
      const mockRoles = [{ id: 'role-1', name: 'super_admin', permissions: [] }];
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles);

      const result = await service.listRoles();
      expect(result).toEqual(mockRoles);
      expect(mockPrismaService.role.findMany).toHaveBeenCalled();
    });
  });

  describe('listPermissions', () => {
    it('should return all permissions', async () => {
      const mockPermissions = [{ id: 'perm-1', name: 'orders.read' }];
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions);

      const result = await service.listPermissions();
      expect(result).toEqual(mockPermissions);
      expect(mockPrismaService.permission.findMany).toHaveBeenCalled();
    });
  });

  describe('assignRole', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRole(
          { userId: 'invalid-user', agencyId: 'agency-1', roleId: 'role-1' },
          'perf-by',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if agency not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.agency.findFirst.mockResolvedValue(null);

      await expect(
        service.assignRole(
          { userId: 'user-1', agencyId: 'invalid-agency', roleId: 'role-1' },
          'perf-by',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if role not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-1' });
      mockPrismaService.role.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRole(
          { userId: 'user-1', agencyId: 'agency-1', roleId: 'invalid-role' },
          'perf-by',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if client does not belong to agency', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-1' });
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'client_admin' });
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(
        service.assignRole(
          { userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1', clientId: 'client-1' },
          'perf-by',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if store does not belong to agency', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-1' });
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'store_manager' });
      mockPrismaService.store.findFirst.mockResolvedValue(null);

      await expect(
        service.assignRole(
          { userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1', storeId: 'store-1' },
          'perf-by',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully assign role and audit log', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-1' });
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'viewer' });
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      const mockUserRole = { id: 'ur-1', userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1' };
      mockPrismaService.userRole.create.mockResolvedValue(mockUserRole);

      const result = await service.assignRole(
        { userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1' },
        'admin-user',
        '127.0.0.1',
      );

      expect(result).toEqual(mockUserRole);
      expect(mockPrismaService.userRole.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'assign',
          entityType: 'UserRole',
          entityId: 'ur-1',
          userId: 'admin-user',
          tenantId: 'agency-1',
          ipAddress: '127.0.0.1',
        }),
      });
    });

    it('should reactivate soft-deleted role assignment', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-1' });
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'viewer' });
      
      const softDeletedUserRole = { id: 'ur-1', userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1', deletedAt: new Date() };
      mockPrismaService.userRole.findFirst.mockResolvedValue(softDeletedUserRole);

      const activeUserRole = { ...softDeletedUserRole, deletedAt: null };
      mockPrismaService.userRole.update.mockResolvedValue(activeUserRole);

      const result = await service.assignRole(
        { userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1' },
        'admin-user',
      );

      expect(result.deletedAt).toBeNull();
      expect(mockPrismaService.userRole.update).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'assign',
          entityType: 'UserRole',
          entityId: 'ur-1',
          userId: 'admin-user',
          tenantId: 'agency-1',
        }),
      });
    });
  });

  describe('revokeRole', () => {
    it('should throw NotFoundException if active assignment not found', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeRole({ userRoleId: 'invalid-id' }, 'perf-by'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete role assignment and audit log', async () => {
      const mockUserRole = { id: 'ur-1', userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1' };
      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      await service.revokeRole({ userRoleId: 'ur-1' }, 'admin-user', '127.0.0.1');

      expect(mockPrismaService.userRole.update).toHaveBeenCalledWith({
        where: { id: 'ur-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'revoke',
          entityType: 'UserRole',
          entityId: 'ur-1',
          userId: 'admin-user',
          tenantId: 'agency-1',
          ipAddress: '127.0.0.1',
        }),
      });
    });
  });
});
