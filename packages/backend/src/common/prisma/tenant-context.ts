import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * RLS bağlamı (P12 Adım 2). PrismaService her sorgudan önce bunu Postgres oturum
 * değişkenine çevirir (SET LOCAL app.agency_id / app.rls_bypass); politikalar
 * yalnız o değişkene bakar. Uygulama katmanı filtreleri KALIR — RLS ikinci kilit.
 *
 *   tenant  → yalnız o ajansın satırları görünür/yazılır
 *   system  → bypass; kiracı-öncesi aşamalar (login, tenant çözümü, worker'ın
 *             integration.agencyId'yi bulması, seed) için AÇIKÇA istenir, reason zorunlu
 *   (yok)   → bağlam set edilmeden sorgu çalışıyor demektir: uyarı loglanır,
 *             sorgu bypass ALMADAN çalışır (kiracı tabloları boş döner — sessiz
 *             sızıntı yerine gürültülü boşluk)
 */
export type TenantContext =
  | { mode: 'tenant'; agencyId: string; inTx?: boolean }
  | { mode: 'system'; reason: string; inTx?: boolean };

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function runWithTenant<T>(agencyId: string, fn: () => Promise<T>): Promise<T> {
  if (!agencyId) throw new Error('runWithTenant: agencyId is required');
  // Prisma sorguları tembel (PrismaPromise): run() içinde AWAIT edilmezse sorgu bağlam dışında koşar.
  return tenantContextStorage.run({ mode: 'tenant', agencyId }, async () => await fn());
}

/** Bypass; `reason` log'a düşer, o yüzden "why" yazılır ("login", "integration-sync:resolve"...). */
export function runAsSystem<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  if (!reason) throw new Error('runAsSystem: reason is required');
  return tenantContextStorage.run({ mode: 'system', reason }, async () => await fn());
}

/**
 * İstek hattı için: middleware'de boş bir kapsayıcı açılır, TenantMiddleware +
 * guard'lar çalıştıktan sonra interceptor içini doldurur (aynı nesne, aynı async
 * zincir). Nesne mutasyonu ALS'de yeni run() gerektirmez.
 */
export interface MutableTenantContext {
  mode: 'tenant' | 'system';
  agencyId?: string;
  reason?: string;
  inTx?: boolean;
}

export function bindTenantContext(ctx: MutableTenantContext, next: { mode: 'tenant'; agencyId: string } | { mode: 'system'; reason: string }) {
  ctx.mode = next.mode;
  if (next.mode === 'tenant') {
    ctx.agencyId = next.agencyId;
    delete ctx.reason;
  } else {
    ctx.reason = next.reason;
    delete ctx.agencyId;
  }
}
