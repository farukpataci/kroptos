import { Test, TestingModule } from '@nestjs/testing';
import { RbacService, ActorContext } from './rbac.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { PermissionCacheService } from '@common/services/permission-cache.service';
import { SessionService } from '../auth/session.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

const mockSessions = { revokeForUserInTenant: jest.fn(), revokeAllForUser: jest.fn(), revokeForRole: jest.fn() };

describe('RbacService', () => {
  let service: RbacService;

  const mockPermissionCache = { invalidateUser: jest.fn(), getPermissions: jest.fn() };

  const mockPrismaService: any = {
    role: { findMany: jest.fn(), findFirst: jest.fn() },
    permission: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    client: { findFirst: jest.fn() },
    store: { findFirst: jest.fn() },
    userRole: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const actor: ActorContext = { userId: 'admin-user', agencyId: 'agency-1', role: 'agency_owner', roleIsSystem: true, ipAddress: '127.0.0.1' };
  const viewerRole = { id: 'role-1', key: 'viewer', isSystem: true, agencyId: null, permissions: [{ name: 'orders.read' }] };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PermissionCacheService, useValue: mockPermissionCache },
        { provide: SessionService, useValue: mockSessions },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    jest.clearAllMocks();
    mockPrismaService.user.findFirst.mockResolvedValue({ id: 'user-1' });
    mockPrismaService.role.findFirst.mockResolvedValue(viewerRole);
    mockPermissionCache.getPermissions.mockResolvedValue(['orders.read', 'products.read']);
    mockPrismaService.userRole.count.mockResolvedValue(0);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignRole', () => {
    it('throws NotFoundException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      await expect(service.assignRole({ userId: 'x', roleId: 'role-1' }, actor)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for another agency's role (query is scoped)", async () => {
      mockPrismaService.role.findFirst.mockResolvedValue(null);
      await expect(service.assignRole({ userId: 'user-1', roleId: 'foreign' }, actor)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.role.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: [{ agencyId: null }, { agencyId: 'agency-1' }] }) }),
      );
    });

    it('refuses to assign super_admin at runtime', async () => {
      mockPrismaService.role.findFirst.mockResolvedValue({ ...viewerRole, key: 'super_admin', permissions: [{ name: '*:*' }] });
      await expect(service.assignRole({ userId: 'user-1', roleId: 'sa' }, actor)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.userRole.create).not.toHaveBeenCalled();
    });

    it('escalation: caller cannot grant a permission they do not hold', async () => {
      mockPrismaService.role.findFirst.mockResolvedValue({ ...viewerRole, permissions: [{ name: 'orders.read' }, { name: 'agencies.write' }] });
      await expect(service.assignRole({ userId: 'user-1', roleId: 'role-1' }, actor)).rejects.toThrow('agencies.write');
      // '*:*' sahibi escalation kontrolunden muaf
      mockPermissionCache.getPermissions.mockResolvedValue(['*:*']);
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);
      mockPrismaService.userRole.create.mockResolvedValue({ id: 'ur-1' });
      await expect(service.assignRole({ userId: 'user-1', roleId: 'role-1' }, actor)).resolves.toBeTruthy();
    });

    it('throws BadRequestException if client/store does not belong to the active agency', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);
      await expect(service.assignRole({ userId: 'user-1', roleId: 'role-1', clientId: 'c1' }, actor)).rejects.toThrow(BadRequestException);
      mockPrismaService.store.findFirst.mockResolvedValue(null);
      await expect(service.assignRole({ userId: 'user-1', roleId: 'role-1', storeId: 's1' }, actor)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.store.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ agencyId: 'agency-1' }) }));
    });

    it('assigns with agency from actor, writes audit, invalidates cache', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);
      mockPrismaService.userRole.create.mockResolvedValue({ id: 'ur-1', userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1' });

      const result = await service.assignRole({ userId: 'user-1', roleId: 'role-1' }, actor);

      expect(result.id).toBe('ur-1');
      expect(mockPrismaService.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1', clientId: null, storeId: null },
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'assign', entityType: 'UserRole', entityId: 'ur-1', userId: 'admin-user', tenantId: 'agency-1', ipAddress: '127.0.0.1' }),
      });
      expect(mockPermissionCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('a different scope creates a NEW row instead of overwriting storeId (P3 probe regression)', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue({ id: 's2', clientId: null });
      mockPrismaService.userRole.findFirst.mockResolvedValue(null); // s2 kapsamiyla satir yok
      mockPrismaService.userRole.create.mockResolvedValue({ id: 'ur-2' });

      await service.assignRole({ userId: 'user-1', roleId: 'role-1', storeId: 's2' }, actor);

      expect(mockPrismaService.userRole.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1', clientId: null, storeId: 's2' },
      });
      expect(mockPrismaService.userRole.update).not.toHaveBeenCalled();
      expect(mockPrismaService.userRole.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ storeId: 's2' }),
      });
    });

    it('reactivates a soft-deleted row with the same scope; active row is idempotent', async () => {
      const soft = { id: 'ur-1', deletedAt: new Date() };
      mockPrismaService.userRole.findFirst.mockResolvedValue(soft);
      mockPrismaService.userRole.update.mockResolvedValue({ ...soft, deletedAt: null });
      const r = await service.assignRole({ userId: 'user-1', roleId: 'role-1' }, actor);
      expect(r.deletedAt).toBeNull();

      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1', deletedAt: null });
      const again = await service.assignRole({ userId: 'user-1', roleId: 'role-1' }, actor);
      expect(again.id).toBe('ur-1');
      expect(mockPrismaService.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('revokeRole', () => {
    it("throws NotFoundException for another agency's assignment (query scoped by actor.agencyId)", async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);
      await expect(service.revokeRole({ userRoleId: 'ur-foreign' }, actor)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.userRole.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ur-foreign', agencyId: 'agency-1', deletedAt: null } }),
      );
    });

    it('cannot revoke your own role', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1', userId: 'admin-user', agencyId: 'agency-1', role: { key: 'viewer' } });
      await expect(service.revokeRole({ userRoleId: 'ur-1' }, actor)).rejects.toThrow(BadRequestException);
    });

    it('cannot revoke the last agency_owner', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1', userId: 'user-1', agencyId: 'agency-1', clientId: null, storeId: null, role: { key: 'agency_owner' } });
      mockPrismaService.userRole.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0); // holds=1, others=0
      await expect(service.revokeRole({ userRoleId: 'ur-1' }, actor)).rejects.toThrow('last agency_owner');
    });

    it('soft-deletes, audits with oldValue, invalidates cache', async () => {
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1', userId: 'user-1', agencyId: 'agency-1', roleId: 'role-1', clientId: null, storeId: 's1', role: { key: 'store_manager' } });
      await service.revokeRole({ userRoleId: 'ur-1' }, actor);
      expect(mockPrismaService.userRole.update).toHaveBeenCalledWith({ where: { id: 'ur-1' }, data: { deletedAt: expect.any(Date) } });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'revoke', oldValue: { roleId: 'role-1', clientId: null, storeId: 's1' } }),
      });
      expect(mockSessions.revokeForUserInTenant).toHaveBeenCalledWith('user-1', 'agency-1', 'rbac.revoke', 'admin-user');
    });
  });
});
