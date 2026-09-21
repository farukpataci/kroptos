import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { PrismaService } from '../prisma/prisma.service';
import { buildUserRoleScopeWhere, TenantScope } from '../utils/tenant-scope';

export const PERMISSION_CACHE_TTL_SECONDS = 60;

export interface AccessSummary {
  permissions: string[];
  /** Baglami kapsayan rollerden biri SISTEM super_admin (key + isSystem). */
  superAdmin: boolean;
}

/**
 * Bir kullanıcının bir bağlamdaki etkin izin kümesi: bağlamı kapsayan TÜM
 * rollerin izinlerinin BİRLEŞİMİ (en dar değil, en geniş). Redis'te 60 sn
 * tutulur; rol/atama değişince invalidate edilir.
 *
 * Redis bu deployment'ta opsiyonel (IntegrationQueueService'in in-memory
 * fallback'i gibi). Redis yoksa cache atlanır ve her istek DB'ye gider —
 * yani "cache yok" her zaman "taze" demektir, asla "bayat" değil.
 * In-memory Map bilerek yok: çok instance'lı ortamda invalidate diğer
 * instance'a ulaşmaz.
 */
@Injectable()
export class PermissionCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PermissionCacheService.name);
  private client: RedisClientType | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url, socket: { reconnectStrategy: 5000 } }) as RedisClientType;
    client.on('error', () => {
      /* bağlantı hataları isReady üzerinden görülür; log yağmuru istemiyoruz */
    });
    try {
      await client.connect();
      this.client = client;
    } catch {
      this.logger.warn('Redis unreachable — permission cache disabled, every check hits the DB');
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  private key(scope: TenantScope): string {
    return `perm:${scope.userId}:${scope.agencyId}:${scope.clientId ?? '-'}:${scope.storeId ?? '-'}`;
  }

  private get redis(): RedisClientType | null {
    return this.client?.isReady ? this.client : null;
  }

  /**
   * Bağlamdaki erişim özeti, TEK cache girdisi (JwtStrategy her istekte bunu okur; ek
   * sorgu yok): izin birleşimi + kapsayan rollerden biri SİSTEM super_admin mi
   * (P4 borcu: roleIsSystem token claim'inden değil buradan). Kullanıcı yok / pasif /
   * silinmiş ya da bağlamı kapsayan aktif rol yoksa null.
   */
  async getAccess(scope: TenantScope): Promise<AccessSummary | null> {
    const key = this.key(scope);
    const redis = this.redis;
    if (redis) {
      const hit = await redis.get(key).catch(() => null);
      if (hit !== null) {
        const parsed = JSON.parse(hit);
        // Eski format (P2: düz dizi) TTL içinde kendiliğinden düşer; yeniden çöz.
        if (parsed && !Array.isArray(parsed)) return parsed as AccessSummary;
        if (parsed === null) return null;
      }
    }

    const access = await this.resolveFromDb(scope);
    if (redis) {
      await redis.set(key, JSON.stringify(access), { EX: PERMISSION_CACHE_TTL_SECONDS }).catch(() => undefined);
    }
    return access;
  }

  /** null = bağlamı kapsayan aktif rol yok (ya da kullanıcı pasif). */
  async getPermissions(scope: TenantScope): Promise<string[] | null> {
    return (await this.getAccess(scope))?.permissions ?? null;
  }

  async resolveFromDb(scope: TenantScope): Promise<AccessSummary | null> {
    const user = await this.prisma.user.findFirst({ where: { id: scope.userId, deletedAt: null }, select: { isActive: true } });
    if (!user?.isActive) return null;
    const userRoles = await this.prisma.userRole.findMany({
      where: buildUserRoleScopeWhere(scope),
      include: { role: { include: { permissions: { select: { name: true } } } } },
    });
    if (userRoles.length === 0) return null;
    return {
      permissions: [...new Set(userRoles.flatMap((ur) => ur.role.permissions.map((p) => p.name)))],
      superAdmin: userRoles.some((ur) => ur.role.key === 'super_admin' && ur.role.isSystem),
    };
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.deletePattern(`perm:${userId}:*`);
  }

  async invalidateAgency(agencyId: string): Promise<void> {
    await this.deletePattern(`perm:*:${agencyId}:*`);
  }

  async invalidateRole(roleId: string): Promise<void> {
    const rows = await this.prisma.userRole.findMany({
      where: { roleId, deletedAt: null },
      select: { userId: true },
      distinct: ['userId'],
    });
    await Promise.all(rows.map((r) => this.invalidateUser(r.userId)));
  }

  // ponytail: SCAN tüm keyspace'i tarar; anahtar sayısı yüz binleri bulursa
  // kullanıcı başına SET tutup üyeleri DEL'e geç.
  private async deletePattern(pattern: string): Promise<void> {
    const redis = this.redis;
    if (!redis) return;
    try {
      for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 200 })) {
        await redis.del(key);
      }
    } catch {
      /* Redis düştüyse cache zaten devre dışı; DB taze */
    }
  }
}
