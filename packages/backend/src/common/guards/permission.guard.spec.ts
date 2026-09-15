import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PermissionCacheService } from '../services/permission-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildUserRoleScopeWhere } from '../utils/tenant-scope';

/**
 * Guard + gerçek PermissionCacheService (Redis'siz → her çağrı "DB"ye gider).
 * Prisma mock'u, where'i buildUserRoleScopeWhere'in ürettiği kapsama göre
 * filtreleyen küçük bir in-memory tablo: mock'un şekli sorgunun şeklini
 * test etsin diye (Kural 7'nin uyarısı).
 */
describe('PermissionGuard', () => {
  const agencyWide = { userId: 'u1', agencyId: 'a1', clientId: null, storeId: null, role: { permissions: [{ name: 'orders.read' }] } };
  const storeS1 = { userId: 'u1', agencyId: 'a1', clientId: null, storeId: 's1', role: { permissions: [{ name: 'wms.print' }] } };
  const storeS2 = { userId: 'u1', agencyId: 'a1', clientId: null, storeId: 's2', role: { permissions: [{ name: 'orders.update' }] } };

  let rows: any[] = [];
  const prisma: any = {
    userRole: {
      findMany: jest.fn(async ({ where }) => {
        const or: any[] = where.OR;
        return rows.filter(
          (r) =>
            r.userId === where.userId &&
            r.agencyId === where.agencyId &&
            or.some((c) => Object.entries(c).every(([k, v]) => r[k] === v)),
        );
      }),
    },
  };

  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  let guard: PermissionGuard;
  let cache: PermissionCacheService;

  const ctx = (user: any, active: Record<string, any> = {}): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user, ...active }) }),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new PermissionCacheService(prisma as PrismaService); // onModuleInit çağrılmadı → Redis yok
    guard = new PermissionGuard(reflector, cache);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('orders.read');
  });

  it('passes through when no permission is required', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(true);
  });

  it('agency-wide role is NOT rejected in a client/store context (regression of clientId equality bug)', async () => {
    rows = [agencyWide];
    const user = { userId: 'u1', agencyId: 'a1', clientId: 'c1', storeId: 's1' };
    await expect(guard.canActivate(ctx(user, { activeStore: { id: 's1' }, activeClient: { id: 'c1' } }))).resolves.toBe(true);
  });

  it('store-scoped role does not grant access in another store context', async () => {
    rows = [storeS2];
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('orders.update');
    const user = { userId: 'u1', agencyId: 'a1', clientId: null, storeId: 's1' };
    await expect(guard.canActivate(ctx(user, { activeStore: { id: 's1' } }))).rejects.toThrow(ForbiddenException);
    // kendi mağazasında geçer
    await expect(guard.canActivate(ctx(user, { activeStore: { id: 's2' } }))).resolves.toBe(true);
  });

  it('unions permissions when several roles cover the context', async () => {
    rows = [agencyWide, storeS1];
    const user = { userId: 'u1', agencyId: 'a1', clientId: null, storeId: 's1' };
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('wms.print');
    await expect(guard.canActivate(ctx(user, { activeStore: { id: 's1' } }))).resolves.toBe(true);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('orders.read');
    await expect(guard.canActivate(ctx(user, { activeStore: { id: 's1' } }))).resolves.toBe(true);
  });

  it('rejects when no role covers the context, and honours the wildcard', async () => {
    rows = [];
    await expect(guard.canActivate(ctx({ userId: 'u1', agencyId: 'a1' }))).rejects.toThrow('No active role');
    rows = [{ ...agencyWide, role: { permissions: [{ name: '*:*' }] } }];
    await expect(guard.canActivate(ctx({ userId: 'u1', agencyId: 'a1' }))).resolves.toBe(true);
  });

  it('super_admin bypasses the lookup entirely', async () => {
    rows = [];
    await expect(guard.canActivate(ctx({ userId: 'x', agencyId: 'a1', role: 'super_admin' }))).resolves.toBe(true);
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });

  it('uses the middleware-resolved context over the token context', async () => {
    rows = [storeS1];
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('wms.print');
    const user = { userId: 'u1', agencyId: 'a1', clientId: null, storeId: null };
    await expect(guard.canActivate(ctx(user, { activeStore: { id: 's1' } }))).resolves.toBe(true);
    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: buildUserRoleScopeWhere({ userId: 'u1', agencyId: 'a1', clientId: null, storeId: 's1' }) }),
    );
  });
});
