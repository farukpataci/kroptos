import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { bindTenantContext, getTenantContext, MutableTenantContext } from '../prisma/tenant-context';
import { isSuperAdminRole } from '../constants/platform-admin';

/**
 * Guard'lardan sonra, handler'dan önce (interceptor sırası) istek bağlamını RLS'e
 * bağlar (P12 Adım 2):
 *   - platform super admin (key+isSystem, DB'den doğrulanmış roleIsSystem) → system
 *     ("super_admin": kiracılar arası okuma tasarım gereği)
 *   - doğrulanmış aktif ajans (TenantMiddleware) yoksa JWT'nin ajansı → tenant
 *   - ikisi de yoksa (public route) → middleware'in açtığı "request:pre-auth" kalır
 * Ham header ASLA okunmaz (CLAUDE.md Kural 2).
 */
@Injectable()
export class RlsBindInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = getTenantContext() as MutableTenantContext | undefined;
    if (ctx && context.getType() === 'http') {
      const req = context.switchToHttp().getRequest();
      const user = req.user;
      const agencyId: string | undefined = req.activeAgency?.id ?? user?.agencyId;
      if (user && isSuperAdminRole(user)) {
        bindTenantContext(ctx, { mode: 'system', reason: 'super_admin' });
      } else if (agencyId) {
        bindTenantContext(ctx, { mode: 'tenant', agencyId });
      }
    }
    return next.handle();
  }
}
