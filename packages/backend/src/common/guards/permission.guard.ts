import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isSuperAdminRole } from '../constants/platform-admin';
import { PermissionCacheService } from '../services/permission-cache.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    if (isSuperAdminRole(user.role)) {
      return true;
    }

    // İzin DB'den (60 sn cache'li) okunur, JWT'den değil: rol geri alındığında
    // token süresi dolmadan yetki düşmeli. Bağlam TenantMiddleware'in çözdüğü
    // aktif kayıtlardan gelir; header yoksa token'daki bağlam kullanılır.
    const permissions = await this.permissionCache.getPermissions({
      userId: user.userId,
      agencyId: request.activeAgency?.id ?? user.agencyId,
      clientId: request.activeClient?.id ?? user.clientId ?? null,
      storeId: request.activeStore?.id ?? user.storeId ?? null,
    });

    if (!permissions) {
      throw new ForbiddenException('Access denied. No active role in the current tenant context.');
    }

    if (!permissions.includes(requiredPermission) && !permissions.includes('*:*')) {
      throw new ForbiddenException(`Access denied. Missing permission: ${requiredPermission}`);
    }

    return true;
  }
}
