/**
 * Bir kullanıcının birden fazla UserRole satırı olabilir (çok ajans, ajans +
 * mağaza kapsamı vb.). Token'a hangi rolün bineceği daha önce `userRoles[0]`
 * ile seçiliyordu — orderBy yok, yani rastgele. super_admin bypass'ı tam da bu
 * string'e bağlı olduğu için aynı kullanıcı farklı isteklerde farklı yetkiyle
 * çalışıyordu. Seçim kuralı artık tek yerde ve deterministik:
 *
 *   1. İstenen bağlamı en özel biçimde kapsayan rol (store > client > agency)
 *   2. Rol önceliği (aşağıdaki sıra)
 *   3. createdAt ASC (eşitlikte en eski atama)
 */
export const SUPER_ADMIN_ROLE = 'super_admin';

export const ROLE_PRIORITY = [
  SUPER_ADMIN_ROLE,
  'agency_owner',
  'agency_admin',
  'client_admin',
  'store_manager',
  'accountant',
  'warehouse_staff',
  'support',
  'viewer',
] as const;

export interface PrimaryRoleContext {
  agencyId?: string | null;
  clientId?: string | null;
  storeId?: string | null;
}

interface RoleLike {
  agencyId: string;
  clientId?: string | null;
  storeId?: string | null;
  createdAt?: Date;
  role: { name: string };
}

function rank(name: string): number {
  const idx = (ROLE_PRIORITY as readonly string[]).indexOf(name);
  return idx === -1 ? ROLE_PRIORITY.length : idx;
}

/** Bağlamı kapsayan rolün özgüllüğü; kapsamıyorsa -1. */
function specificity(ur: RoleLike, ctx?: PrimaryRoleContext): number {
  if (!ctx?.agencyId) return 0;
  if (ur.agencyId !== ctx.agencyId) return -1;
  if (ur.storeId) return ur.storeId === ctx.storeId ? 3 : -1;
  if (ur.clientId) return ur.clientId === ctx.clientId ? 2 : -1;
  return 1;
}

export function resolvePrimaryRole<T extends RoleLike>(userRoles: T[], ctx?: PrimaryRoleContext): T | undefined {
  const covering = userRoles.filter((ur) => specificity(ur, ctx) >= 0);
  if (covering.length === 0) return undefined;

  return covering.reduce((best, cur) => {
    const bySpec = specificity(cur, ctx) - specificity(best, ctx);
    if (bySpec !== 0) return bySpec > 0 ? cur : best;
    const byRank = rank(best.role.name) - rank(cur.role.name);
    if (byRank !== 0) return byRank > 0 ? cur : best;
    const byAge = (best.createdAt?.getTime() ?? 0) - (cur.createdAt?.getTime() ?? 0);
    return byAge > 0 ? cur : best;
  });
}
