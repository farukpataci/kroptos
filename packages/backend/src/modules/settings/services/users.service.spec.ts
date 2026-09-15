import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PermissionCacheService } from '../../../common/services/permission-cache.service';
import { AuditLogService } from '../../audit/audit.service';
import { RbacService, ActorContext } from '../../rbac/rbac.service';

describe('UsersService', () => {
  let service: UsersService;

  const prisma: any = {
    user: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    store: { findMany: jest.fn(), findFirst: jest.fn() },
    client: { findFirst: jest.fn() },
    role: { findFirst: jest.fn() },
    userRole: { updateMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    storeUser: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  };
  const audit = { createLog: jest.fn() };
  const rbac = { assertAssignableRole: jest.fn(), isLastAgencyOwner: jest.fn() };
  const cache = { invalidateUser: jest.fn() };

  const actor: ActorContext = { userId: 'admin', agencyId: 'a1', role: 'agency_owner', roleIsSystem: true, ipAddress: '1.1.1.1' };
  const ownerRole = { id: 'r-owner', key: 'agency_owner', name: 'agency_owner', isSystem: true };
  const smRole = { id: 'r-sm', key: 'store_manager', name: 'store_manager', isSystem: true };
  const target = {
    id: 'u1', email: 'u1@x.y', firstName: 'A', lastName: 'B', phone: null, avatar: null, isActive: true, twoFactorEnabled: false, createdAt: new Date(),
    userRoles: [{ id: 'ur1', roleId: 'r-owner', clientId: null, storeId: null, role: ownerRole, client: null, store: null }],
    storeUsers: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: audit },
        { provide: RbacService, useValue: rbac },
        { provide: PermissionCacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(UsersService);
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue(target);
    rbac.isLastAgencyOwner.mockResolvedValue(false);
    rbac.assertAssignableRole.mockResolvedValue(smRole);
  });

  describe('findAll', () => {
    it('scopes row selection AND includes to the active agency for non-super-admins', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.store.findMany.mockResolvedValue([]);
      await service.findAll({ page: 2, limit: 10 } as any, actor);
      const args = prisma.user.findMany.mock.calls[0][0];
      expect(args.where.userRoles.some).toEqual({ agencyId: 'a1', deletedAt: null });
      expect(args.select.userRoles.where).toEqual({ agencyId: 'a1', deletedAt: null });
      expect(args.select.storeUsers.where.store).toEqual({ agencyId: 'a1', deletedAt: null });
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
      expect(prisma.store.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agencyId: 'a1', deletedAt: null } }));
    });

    it('never selects sensitive fields', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.store.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 50 } as any, actor);
      const select = prisma.user.findMany.mock.calls[0][0].select;
      expect(select.passwordHash).toBeUndefined();
      expect(select.twoFactorSecret).toBeUndefined();
      expect(select.twoFactorBackupCodes).toBeUndefined();
    });

    it('system super_admin sees every agency (existing exception kept, via key+isSystem)', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.store.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 50 } as any, { ...actor, role: 'super_admin', roleIsSystem: true });
      expect(prisma.user.findMany.mock.calls[0][0].where.userRoles).toBeUndefined();
      // key super_admin ama sistem rolu degil -> istisna YOK
      await service.findAll({ page: 1, limit: 50 } as any, { ...actor, role: 'super_admin', roleIsSystem: false });
      expect(prisma.user.findMany.mock.calls[1][0].where.userRoles.some.agencyId).toBe('a1');
    });
  });

  describe('findOne', () => {
    it('404 when the user has no role in the active agency', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findOne('ghost', actor)).rejects.toThrow(NotFoundException);
      expect(prisma.user.findFirst.mock.calls[0][0].where.userRoles.some).toEqual({ agencyId: 'a1', deletedAt: null });
    });

    it('returns scopes, no sensitive fields', async () => {
      const r: any = await service.findOne('u1', actor);
      expect(r.scopes).toEqual([expect.objectContaining({ userRoleId: 'ur1', roleKey: 'agency_owner', storeId: null })]);
      expect(r.passwordHash).toBeUndefined();
      expect(r.userRoles).toBeUndefined();
    });
  });

  describe('update', () => {
    it('cannot deactivate yourself', async () => {
      await expect(service.update('admin', { isActive: false }, actor)).rejects.toThrow(BadRequestException);
    });

    it('cannot deactivate the last agency_owner', async () => {
      rbac.isLastAgencyOwner.mockResolvedValue(true);
      await expect(service.update('u1', { isActive: false }, actor)).rejects.toThrow('last agency_owner');
    });

    it('writes only given fields, audits old/new, invalidates cache', async () => {
      prisma.user.update.mockResolvedValue({ ...target, firstName: 'Z' });
      await service.update('u1', { firstName: 'Z' }, actor);
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' }, data: { firstName: 'Z' } }));
      expect(prisma.user.update.mock.calls[0][0].select.passwordHash).toBeUndefined();
      expect(audit.createLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.update', oldValue: expect.objectContaining({ firstName: 'A' }), newValue: expect.objectContaining({ firstName: 'Z' }) }));
      expect(cache.invalidateUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('changeRole', () => {
    it('cannot change your own role', async () => {
      await expect(service.changeRole('admin', { roleId: 'r-sm' }, actor)).rejects.toThrow(BadRequestException);
    });

    it('escalation and super_admin are enforced by RbacService.assertAssignableRole', async () => {
      rbac.assertAssignableRole.mockRejectedValue(new ForbiddenException('nope'));
      await expect(service.changeRole('u1', { roleId: 'r-x' }, actor)).rejects.toThrow(ForbiddenException);
      expect(prisma.userRole.updateMany).not.toHaveBeenCalled();
    });

    it('cannot demote the last agency_owner to a narrower role', async () => {
      rbac.isLastAgencyOwner.mockResolvedValue(true);
      prisma.store.findFirst.mockResolvedValue({ id: 's1', clientId: null });
      await expect(service.changeRole('u1', { roleId: 'r-sm', storeId: 's1' }, actor)).rejects.toThrow('last agency_owner');
      // agency_owner'a ajans geneli olarak yeniden atamak serbest
      rbac.assertAssignableRole.mockResolvedValue(ownerRole);
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({ id: 'ur9', clientId: null, storeId: null });
      prisma.store.findFirst.mockResolvedValue({ id: 's1', clientId: null });
      await expect(service.changeRole('u1', { roleId: 'r-owner' }, actor)).resolves.toBeTruthy();
    });

    it('closes all active rows in the agency, opens one with the new scope, audits, invalidates', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', clientId: null });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({ id: 'ur2', clientId: null, storeId: 's1' });
      await service.changeRole('u1', { roleId: 'r-sm', storeId: 's1' }, actor);
      expect(prisma.userRole.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', agencyId: 'a1', deletedAt: null }, data: { deletedAt: expect.any(Date) } });
      expect(prisma.userRole.create).toHaveBeenCalledWith({ data: { userId: 'u1', agencyId: 'a1', roleId: 'r-sm', clientId: null, storeId: 's1' } });
      expect(audit.createLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.change_role', oldValue: { scopes: [expect.objectContaining({ roleKey: 'agency_owner' })] } }));
      expect(cache.invalidateUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('removeFromTenant', () => {
    it('cannot remove yourself', async () => {
      await expect(service.removeFromTenant('admin', actor)).rejects.toThrow(BadRequestException);
    });

    it('cannot remove the last agency_owner', async () => {
      rbac.isLastAgencyOwner.mockResolvedValue(true);
      await expect(service.removeFromTenant('u1', actor)).rejects.toThrow('last agency_owner');
    });

    it('soft-deletes UserRole + StoreUser in this agency only; never touches User.deletedAt', async () => {
      await service.removeFromTenant('u1', actor);
      expect(prisma.userRole.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', agencyId: 'a1', deletedAt: null }, data: { deletedAt: expect.any(Date) } });
      expect(prisma.storeUser.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', deletedAt: null, store: { agencyId: 'a1' } }, data: { deletedAt: expect.any(Date) } });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(audit.createLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.remove_from_tenant' }));
      expect(cache.invalidateUser).toHaveBeenCalledWith('u1');
    });
  });
});
