import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { PermissionCacheService } from '@common/services/permission-cache.service';

/**
 * Oturum = Session satırı (refresh token'ın SHA-256 hash'i, isActive). Erişim
 * token'ı 15 dk yaşar ve JwtStrategy her istekte kullanıcıyı DB/cache'ten doğrular;
 * bu servis refresh yolunu kapatır: isActive=false + RefreshToken satırları silinir.
 *
 * Session kiracı bilgisi TAŞIMAZ (userId + tokenHash). Bu yüzden
 * revokeForUserInTenant kesin değildir: kullanıcının başka ajansta hâlâ aktif rolü
 * varsa oturumlar korunur (refresh o rolle devam eder, erişim token'ı çıkarıldığı
 * kiracıda zaten 401); hiçbir yerde rolü kalmadıysa hepsi kapanır.
 */
@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private permissionCache: PermissionCacheService,
  ) {}

  async listForUser(userId: string, currentSessionId?: string | null) {
    const rows = await this.prisma.session.findMany({
      where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, lastUsedAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  }

  /** Başkasının oturumu → 404 (varlığı sızmaz). */
  async revokeOne(userId: string, sessionId: string, reason: string) {
    const s = await this.prisma.session.findFirst({ where: { id: sessionId, userId, isActive: true }, select: { id: true } });
    if (!s) throw new NotFoundException('Session not found');
    await this.prisma.session.update({ where: { id: s.id }, data: { isActive: false } });
    await this.audit(userId, userId, reason, { sessionId: s.id });
  }

  async revokeAllForUser(userId: string, reason: string, opts: { exceptSessionId?: string | null; performedBy?: string; tenantId?: string | null } = {}) {
    const where = { userId, isActive: true, ...(opts.exceptSessionId ? { id: { not: opts.exceptSessionId } } : {}) };
    const [sessions] = await this.prisma.$transaction([
      this.prisma.session.updateMany({ where, data: { isActive: false } }),
      // RefreshToken satırları bcrypt hash'li (eşleştirilemez); kullanıcı geneli temizlenir.
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    await this.permissionCache.invalidateUser(userId);
    await this.audit(opts.performedBy ?? userId, userId, reason, { revoked: sessions.count, except: opts.exceptSessionId ?? null }, opts.tenantId);
    return sessions.count;
  }

  async revokeForUserInTenant(userId: string, agencyId: string, reason: string, performedBy?: string) {
    await this.permissionCache.invalidateUser(userId);
    const elsewhere = await this.prisma.userRole.count({ where: { userId, deletedAt: null, agencyId: { not: agencyId } } });
    if (elsewhere > 0) return 0; // erişim token'ı bu kiracıda zaten 401; diğer ajanslar için oturum kalır
    return this.revokeAllForUser(userId, reason, { performedBy, tenantId: agencyId });
  }

  /** Rolün izin matrisi değişti: o role bağlı herkesin cache'i düşer, oturumları kapanır. */
  async revokeForRole(roleId: string, reason: string, performedBy: string, tenantId: string | null) {
    const rows = await this.prisma.userRole.findMany({ where: { roleId, deletedAt: null }, select: { userId: true }, distinct: ['userId'] });
    let total = 0;
    for (const r of rows) total += await this.revokeAllForUser(r.userId, reason, { performedBy, tenantId });
    return { users: rows.length, sessions: total };
  }

  private audit(performedBy: string, targetUserId: string, reason: string, meta: unknown, tenantId?: string | null) {
    return this.prisma.auditLog.create({
      data: {
        action: 'session.revoke',
        module: 'auth',
        entityType: 'Session',
        entityId: targetUserId,
        userId: performedBy,
        tenantId: tenantId ?? null,
        description: reason,
        metadata: JSON.parse(JSON.stringify(meta)),
      },
    });
  }
}
