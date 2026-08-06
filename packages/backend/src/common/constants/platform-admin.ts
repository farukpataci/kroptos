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

export function platformAdminEmails(): string[] {
  const configured = process.env.PLATFORM_ADMIN_EMAILS;
  const list = configured
    ? configured.split(',').map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_PLATFORM_ADMIN_EMAILS;
  return list.map((email) => email.toLowerCase());
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'super_admin' || role === 'Super Admin';
}

/** Both conditions must hold: the super admin role *and* an allowlisted email. */
export function isPlatformAdmin(user?: { email?: string | null; role?: string | null }): boolean {
  if (!user?.email || !isSuperAdminRole(user.role)) return false;
  return platformAdminEmails().includes(user.email.toLowerCase());
}
