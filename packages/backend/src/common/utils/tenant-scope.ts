import { Prisma } from '@prisma/client';

export interface TenantScope {
  userId: string;
  agencyId: string;
  clientId?: string | null;
  storeId?: string | null;
}

/**
 * Bir bağlamı KAPSAYAN UserRole satırlarının where'i. Hiyerarşi ajans → client
 * → mağaza; üstteki rol alttaki her şeyi kapsar (CLAUDE.md Kural 3).
 *
 *   - ajans geneli rol      (clientId: null, storeId: null)   her bağlamı kapsar
 *   - client kapsamlı rol   (clientId: X,    storeId: null)   X ve X'in mağazalarını kapsar
 *   - mağaza kapsamlı rol   (storeId: Y)                      yalnız Y'yi kapsar
 *
 * Tek kaynak: PermissionGuard, TenantMiddleware ve AuthService.switchTenant
 * üçü de bunu kullanır. Üçü ayrışırsa guard ile token uyumsuz kalır.
 */
export function buildUserRoleScopeWhere(scope: TenantScope): Prisma.UserRoleWhereInput {
  const coverage: Prisma.UserRoleWhereInput[] = [{ clientId: null, storeId: null }];
  if (scope.clientId) coverage.push({ clientId: scope.clientId, storeId: null });
  if (scope.storeId) coverage.push({ storeId: scope.storeId });

  return {
    userId: scope.userId,
    agencyId: scope.agencyId,
    deletedAt: null,
    OR: coverage,
  };
}
