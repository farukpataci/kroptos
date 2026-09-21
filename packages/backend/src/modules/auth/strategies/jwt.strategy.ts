import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PermissionCacheService } from '@common/services/permission-cache.service';

/**
 * Erişim token'ı imza + süre (15 dk) ile geçer; ama kullanıcı o arada pasife
 * alınmış, kiracıdan çıkarılmış ya da silinmiş olabilir. Bu yüzden her istekte
 * PermissionCacheService.getAccess ile (60 sn cache, ek DB sorgusu yok) doğrulanır:
 *   - kullanıcı aktif ve token'ın kiracı bağlamını kapsayan rolü var mı
 *   - roleIsSystem TOKEN'DAN DEĞİL DB'DEN (P4 borcu kapandı): bağlamı kapsayan
 *     rollerden biri sistem super_admin ise true
 * Başarısızlık 401 — 403 DEĞİL: restoreAuth 403'te oturumu koruyup bağlamsız tekrar
 * dener (P2.6) ve bu döngüye girerdi; 401 oturumu temizler, login'e gider.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly permissionCache: PermissionCacheService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
    });
  }

  async validate(payload: any) {
    const scope = {
      userId: payload.userId,
      agencyId: payload.agencyId,
      clientId: payload.clientId ?? null,
      storeId: payload.storeId ?? null,
    };
    const access = payload.userId && payload.agencyId ? await this.permissionCache.getAccess(scope) : null;
    if (!access) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    return {
      userId: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      agencyId: payload.agencyId,
      clientId: payload.clientId,
      storeId: payload.storeId ?? null,
      role: payload.role,
      roleIsSystem: access.superAdmin,
      sessionId: payload.sid ?? null,
    };
  }
}
