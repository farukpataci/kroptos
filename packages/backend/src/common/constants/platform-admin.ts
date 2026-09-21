/**
 * Distributor firms (Agency) sit above every tenant, so creating or deleting
 * one is a platform-level action rather than a tenant-level one. Role alone is
 * not enough here: a tenant could be handed `super_admin` and would then be
 * able to mint sibling distributors. The allowlist below is the second lock.
 *
 * Override in deployment with PLATFORM_ADMIN_EMAILS (comma separated) rather
 * than editing this file.
 */
const DEFAULT_PLATFORM_ADMIN_EMAILS = ['faruk.pataci@gmail.com'];

export const SUPER_ADMIN_ROLE_KEY = 'super_admin';

/** JWT'nin ve req.user'ın taşıdığı rol kimliği: makine adı + sistem rolü mü. */
export interface RoleIdentity {
  role?: string | null;
  roleIsSystem?: boolean | null;
}

export function platformAdminEmails(): string[] {
  const configured = process.env.PLATFORM_ADMIN_EMAILS;
  const list = configured
    ? configured.split(',').map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_PLATFORM_ADMIN_EMAILS;
  return list.map((email) => email.toLowerCase());
}

/**
 * Bypass yalnız SİSTEM super_admin rolüne. P3'ten sonra Role.name unique değil ve
 * P7 ajanslara özel rol yaratma yetkisi verecek: key'i 'super_admin' olan bir
 * tenant rolü (agencyId dolu, isSystem false) partial index'e takılmaz — bypass
 * almamalı. Bu yüzden key VE isSystem birlikte gerekir; görünen ad (name) hiç
 * okunmaz.
 */
export function isSuperAdminRole(identity?: RoleIdentity | null): boolean {
  return identity?.role === SUPER_ADMIN_ROLE_KEY && identity?.roleIsSystem === true;
}

/** Both conditions must hold: the super admin role *and* an allowlisted email. */
export function isPlatformAdmin(user?: (RoleIdentity & { email?: string | null }) | null): boolean {
  if (!user?.email || !isSuperAdminRole(user)) return false;
  return platformAdminEmails().includes(user.email.toLowerCase());
}
