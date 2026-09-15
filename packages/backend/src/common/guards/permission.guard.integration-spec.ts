import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@common/prisma/prisma.service';
import { PermissionGuard } from './permission.guard';
import { PermissionCacheService } from '../services/permission-cache.service';
import { RbacService } from '../../modules/rbac/rbac.service';

/**
 * PermissionGuard + PermissionCacheService + RbacService, gerçek Postgres ve
 * gerçek Redis'le. Kanıtlanan iki şey:
 *
 *   1. Ajans geneli rolü olan kullanıcı client/mağaza bağlamında 403 ALMIYOR
 *      (eski guard `clientId: user.clientId || null` tam eşitlik arıyordu).
 *   2. Rol geri alındıktan sonra AYNI token bağlamı ile bir sonraki istek 403
 *      — cache invalidate edildiği için 60 sn beklemeden. Eski RbacGuard JWT
 *      içindeki permissions[]'ı okuduğu için token bitene kadar geçiyordu.
 *
 * Guard doğrudan çağrılır; AuthGuard('jwt') → PermissionGuard zinciri Nest'in
 * kendi mekanizması, burada değişmedi. Sokete koymak kanıtı genişletmezdi.
 *
 * packages/backend/.env'deki canlı Postgres (+ varsa Redis) gerekir.
 * Ulaşılamazsa atlamaz, patlar.
 */
describe('PermissionGuard against the real database', () => {
  loadEnv({ path: join(__dirname, '../../../.env') });

  const prisma = new PrismaService();
  const cache = new PermissionCacheService(prisma);
  const rbac = new RbacService(prisma, cache);
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new PermissionGuard(reflector, cache);
  const suffix = `itpg${Date.now()}`;

  const COUNTED = ['agency', 'client', 'store', 'user', 'userRole', 'auditLog'] as const;
  type Counted = (typeof COUNTED)[number];
  const countAll = async (): Promise<Record<Counted, number>> => {
    const out = {} as Record<Counted, number>;
    for (const m of COUNTED) out[m] = await (prisma as any)[m].count();
    return out;
  };
  let before: Record<Counted, number>;

  let agencyId: string;
  let clientId: string;
  let storeId: string;
  let userId: string;
  let ownerRoleId: string;

  const ctx = (permission: string, active: { clientId?: string; storeId?: string } = {}): ExecutionContext => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(permission);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId, agencyId, clientId: active.clientId ?? null, storeId: active.storeId ?? null, role: 'agency_owner' },
          activeAgency: { id: agencyId },
          activeClient: active.clientId ? { id: active.clientId } : undefined,
          activeStore: active.storeId ? { id: active.storeId } : undefined,
        }),
      }),
    } as any;
  };

  beforeAll(async () => {
    await cache.onModuleInit();
    before = await countAll();

    const owner = await prisma.role.findFirst({ where: { key: 'agency_owner', agencyId: null, deletedAt: null } });
    if (!owner) throw new Error('agency_owner rolü yok; seed çalıştırılmalı');
    ownerRoleId = owner.id;

    const agency = await prisma.agency.create({ data: { name: `pg ${suffix}`, slug: `pg-${suffix}` } });
    agencyId = agency.id;
    const client = await prisma.client.create({
      data: { agencyId, name: `pg client ${suffix}`, contactEmail: `${suffix}@it.local` },
    });
    clientId = client.id;
    const store = await prisma.store.create({
      data: { agencyId, clientId, name: `pg store ${suffix}`, slug: `pg-s-${suffix}` },
    });
    storeId = store.id;
    const user = await prisma.user.create({ data: { email: `${suffix}@it.local`, passwordHash: 'x' } });
    userId = user.id;
  }, 60000);

  afterAll(async () => {
    try {
      await prisma.auditLog.deleteMany({ where: { tenantId: agencyId } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.store.deleteMany({ where: { id: storeId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
      await prisma.agency.deleteMany({ where: { id: agencyId } });
      await cache.invalidateUser(userId);

      const after = await countAll();
      const drifted = COUNTED.filter((m) => after[m] !== before[m]);
      if (drifted.length) {
        throw new Error(`Fixture sizintisi: ${drifted.map((m) => `${m} ${before[m]} -> ${after[m]}`).join(', ')}`);
      }
    } finally {
      await cache.onModuleDestroy();
      await prisma.$disconnect();
    }
  }, 60000);

  it('no role at all → 403', async () => {
    await expect(guard.canActivate(ctx('clients.create'))).rejects.toThrow(ForbiddenException);
  });

  it('agency-wide role passes in agency, client AND store context (clientId equality regression)', async () => {
    await rbac.assignRole({ userId, agencyId, roleId: ownerRoleId }, userId);

    await expect(guard.canActivate(ctx('clients.create'))).resolves.toBe(true);
    await expect(guard.canActivate(ctx('clients.create', { clientId }))).resolves.toBe(true);
    await expect(guard.canActivate(ctx('clients.create', { clientId, storeId }))).resolves.toBe(true);
    // sahip olmadığı izin yine 403
    await expect(guard.canActivate(ctx('agencies.create', { clientId }))).rejects.toThrow('Missing permission');
  });

  it('revoke → the very next check with the same context is 403 (no 60 s wait)', async () => {
    // Bir önceki test cache'i doldurdu; revoke invalidate etmezse burası geçerdi.
    const row = await prisma.userRole.findFirst({ where: { userId, agencyId, roleId: ownerRoleId, deletedAt: null } });
    expect(row).not.toBeNull();

    await rbac.revokeRole({ userRoleId: row!.id }, userId);

    await expect(guard.canActivate(ctx('clients.create'))).rejects.toThrow('No active role');
    await expect(guard.canActivate(ctx('clients.create', { clientId, storeId }))).rejects.toThrow('No active role');
  });
});
