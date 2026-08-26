// TODO(cleanup): Geçici re-export. orders/* altındaki 9 sayfanın import yolu
// @/components/layout/SubPageShell olarak güncellenip bu dosya silinecek.

/**
 * Moved to `@/components/layout/SubPageShell` — the Products sub-pages need the
 * same frame, and two copies of a page shell drift the moment one of them gets
 * a fix. Re-exported here so the Orders pages keep their import path.
 */
export { SubPageShell, NotBuiltYet } from '@/components/layout/SubPageShell';
