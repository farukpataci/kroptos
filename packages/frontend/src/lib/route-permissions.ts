/**
 * Tenant altindaki rota -> gerekli izin. TEK kaynak: Sidebar bu tabloya gore
 * ogeleri gizler, t/[tenantPublicId]/layout ayni tabloya gore 403 ekrani cizer.
 * Path'ler tenant prefix'i ('/t/<id>') atildiktan sonraki halidir; en uzun
 * prefix kazanir. Listede olmayan rota izin istemez (dashboard, support...).
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/stores': 'stores.read',
  '/agencies': 'agencies.read',
  '/orders': 'orders.read',
  '/shipping': 'shipments.read',
  '/products': 'products.read',
  '/inventory': 'wms.stock.view',
  '/warehouses': 'warehouse.settings.read',
  '/integrations': 'integrations.read',
  '/integrations/accounting': 'accounting.read',
  '/integrations/carrier': 'carriers.read',
  '/agents': 'agent.read',
  '/system': 'system.settings.read',
  '/system/audit-logs': 'audit.read',
};

/** '/t/<tenant>/products/stock' -> '/products/stock' */
export function tenantRelativePath(pathname: string): string {
  return pathname.replace(/^\/t\/[^/]+/, '') || '/';
}

export function requiredPermissionFor(pathname: string): string | null {
  const rel = tenantRelativePath(pathname);
  const hit = Object.keys(ROUTE_PERMISSIONS)
    .filter((p) => rel === p || rel.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? ROUTE_PERMISSIONS[hit] : null;
}
