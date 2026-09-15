import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PermissionCacheService } from '../../../common/services/permission-cache.service';
import { RbacService, ActorContext } from '../../rbac/rbac.service';

describe('RolesService', () => {
  let service: RolesService;
  const prisma: any = {
    role: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    userRole: { count: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  };
  const rbac = { assertCanGrant: jest.fn() };
  const cache = { invalidateRole: jest.fn() };
  const actor: ActorContext = { userId: 'admin', agencyId: 'a1', role: 'agency_owner', roleIsSystem: true };
  const custom = { id: 'r1', agencyId: 'a1', key: 'ops', name: 'Ops', description: null, isSystem: false, permissions: [{ name: 'orders.read' }], _count: { userRoles: 0 } };
  const system = { ...custom, id: 'sys', agencyId: null, key: 'viewer', name: 'viewer', isSystem: true };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RbacService, useValue: rbac },
        { provide: PermissionCacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(RolesService);
    jest.clearAllMocks();
    rbac.assertCanGrant.mockResolvedValue(undefined);
    prisma.userRole.count.mockResolvedValue(0);
  });

  it('system role: PATCH/DELETE → 403', async () => {
    prisma.role.findFirst.mockResolvedValue(system);
    await expect(service.update('sys', { name: 'x' }, actor)).rejects.toThrow(ForbiddenException);
    await expect(service.remove('sys', actor)).rejects.toThrow(ForbiddenException);
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it("another agency's role → 404 (query scoped to system + own agency)", async () => {
    prisma.role.findFirst.mockResolvedValue(null);
    await expect(service.update('foreign', { name: 'x' }, actor)).rejects.toThrow(NotFoundException);
    expect(prisma.role.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'foreign', deletedAt: null, OR: [{ agencyId: null }, { agencyId: 'a1' }] });
  });

  it('role with active assignments cannot be deleted; message carries the count', async () => {
    prisma.role.findFirst.mockResolvedValue(custom);
    prisma.userRole.count.mockResolvedValue(3);
    await expect(service.remove('r1', actor)).rejects.toThrow('3 user(s)');
    prisma.userRole.count.mockResolvedValue(0);
    await service.remove('r1', actor);
    expect(prisma.role.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { deletedAt: expect.any(Date) } });
    expect(cache.invalidateRole).toHaveBeenCalledWith('r1');
  });

  it('escalation: assertCanGrant is consulted with the ADDED permissions only; 403 propagates', async () => {
    prisma.role.findFirst.mockResolvedValue(custom);
    rbac.assertCanGrant.mockRejectedValue(new ForbiddenException('nope'));
    await expect(service.update('r1', { permissions: ['orders.read', 'agencies.write'] }, actor)).rejects.toThrow(ForbiddenException);
    expect(rbac.assertCanGrant).toHaveBeenCalledWith(['agencies.write'], actor);
    expect(prisma.role.update).not.toHaveBeenCalled();
    // create: tum liste kontrol edilir
    await expect(service.create({ name: 'X', permissions: ['orders.read'] }, actor)).rejects.toThrow(ForbiddenException);
    expect(rbac.assertCanGrant).toHaveBeenLastCalledWith(['orders.read'], actor);
  });

  it('reserved keys and wildcard are refused explicitly; unknown keys → 400', async () => {
    await expect(service.create({ name: 'Super Admin', permissions: ['orders.read'] }, actor)).rejects.toThrow('reserved system role key');
    await expect(service.create({ name: 'agency-owner', permissions: [] }, actor)).rejects.toThrow('reserved');
    await expect(service.create({ name: 'Ops', permissions: ['*:*'] }, actor)).rejects.toThrow(ForbiddenException);
    await expect(service.create({ name: 'Ops', permissions: ['orders.view'] }, actor)).rejects.toThrow('Unknown permission');
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it('slug collision → numeric suffix; soft-deleted key is reusable', async () => {
    // 'ops' aktif, 'ops_2' bos
    prisma.role.findFirst.mockResolvedValueOnce({ id: 'taken' }).mockResolvedValueOnce(null);
    prisma.role.create.mockImplementation(({ data }: any) => Promise.resolve({ ...custom, ...data, permissions: [] }));
    const r = await service.create({ name: 'Ops', permissions: [] }, actor);
    expect(r.key).toBe('ops_2');
    expect(prisma.role.findFirst).toHaveBeenCalledWith({ where: { agencyId: 'a1', key: 'ops', deletedAt: null }, select: { id: true } });
    // soft-deleted 'ops' aktif sayilmaz (deletedAt: null filtresi) → key yeniden 'ops'
    prisma.role.findFirst.mockResolvedValueOnce(null);
    const again = await service.create({ name: 'Ops', permissions: [] }, actor);
    expect(again.key).toBe('ops');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'role.create', entityType: 'Role', tenantId: 'a1' }) });
  });

  it('update audits the permission diff (added/removed) and invalidates the role cache', async () => {
    prisma.role.findFirst.mockResolvedValue({ ...custom, permissions: [{ name: 'orders.read' }, { name: 'products.read' }] });
    prisma.role.update.mockResolvedValue({ ...custom, permissions: [{ name: 'orders.read' }, { name: 'orders.update' }] });
    await service.update('r1', { permissions: ['orders.read', 'orders.update'] }, actor);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'role.update',
        oldValue: expect.objectContaining({ permissions: ['orders.read', 'products.read'] }),
        newValue: expect.objectContaining({ added: ['orders.update'], removed: ['products.read'] }),
      }),
    });
    expect(cache.invalidateRole).toHaveBeenCalledWith('r1');
  });
});
