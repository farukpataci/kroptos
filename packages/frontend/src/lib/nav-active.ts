/**
 * Whether a sidebar entry should render as the active one.
 *
 * Three cases, and they do not collapse into one:
 *
 * - `?tab=` links (`/system?tab=warehouses`) share a pathname, so only the tab
 *   separates them. Absent tab means `settings`, matching the page's default.
 * - `exact` entries match the path itself. A parent route that also has
 *   children — `/orders` beside `/orders/invoices` — needs this, or it lights
 *   up on every child as well and two entries look active at once.
 * - everything else matches its subtree, so a detail page keeps its section lit.
 */
export function isNavItemActive(
  pathname: string,
  searchParams: URLSearchParams | null,
  href: string,
  exact?: boolean,
): boolean {
  if (href.includes('?')) {
    const [basePath, search] = href.split('?');
    if (pathname !== basePath) return false;
    const targetTab = new URLSearchParams(search).get('tab');
    return targetTab === (searchParams?.get('tab') || 'settings');
  }
  if (exact) return pathname === href;
  return pathname.startsWith(href);
}
