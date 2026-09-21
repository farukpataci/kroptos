import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantContext, tenantContextStorage, TenantContext } from './tenant-context';

/**
 * RLS köprüsü (P12 Adım 2). Her Prisma işlemi, ALS'deki TenantContext'i aynı
 * transaction içinde `set_config(..., true)` (= SET LOCAL) ile Postgres'e taşır:
 *   tenant → app.agency_id = <id>        system → app.rls_bypass = 'on'
 * Tek işlem: [set_config, işlem] batch transaction'ı (Prisma'nın resmi RLS deseni).
 * Interactive/batch $transaction: değişken tx'in başında BİR kez set edilir, içerideki
 * işlemler `inTx` bayrağıyla sarmalanmaz (iç içe transaction yok).
 * Bağlam yoksa: UYARI loglanır, sorgu bypass almadan çalışır (kiracı tabloları boş).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static readonly logger = new Logger('PrismaRls');
  private static warned = new Map<string, number>();

  constructor() {
    super();
    const base = this;
    const rawTransaction = PrismaClient.prototype.$transaction as (this: PrismaClient, ...a: any[]) => Promise<any>;

    const extended = this.$extends({
      query: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = getTenantContext();
          if (!ctx) {
            PrismaService.warnUnscoped(`${model ?? '$raw'}.${operation}`);
            return query(args);
          }
          if (ctx.inTx) return query(args);
          const [, result] = await rawTransaction.call(base, [PrismaService.setConfig(base, ctx), query(args)]);
          return result;
        },
      },
    });
    // Sınıf metodları ($transaction override'ı dahil) proxy'nin arkasındaki bu
    // nesnede yaşar; NestJS'e uzatılmış istemci verilir.
    return extended as unknown as this;
  }

  /** Aynı tx içinde geçerli: set_config(name, value, is_local=true) ≡ SET LOCAL. */
  private static setConfig(client: { $executeRaw: PrismaClient['$executeRaw'] }, ctx: TenantContext) {
    return ctx.mode === 'system'
      ? client.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`
      : client.$executeRaw`SELECT set_config('app.agency_id', ${ctx.agencyId}, true)`;
  }

  private static warnUnscoped(label: string) {
    // Aynı çağrı noktası için dakikada bir; yutulmaz, sadece boğulmaz.
    const now = Date.now();
    const last = PrismaService.warned.get(label) ?? 0;
    if (now - last < 60_000) return;
    PrismaService.warned.set(label, now);
    PrismaService.logger.warn(`Query without tenant context: ${label} — RLS will hide tenant rows. Wrap in runWithTenant()/runAsSystem().`);
  }

  // Interactive ve batch transaction: bağlam tx başında bir kez set edilir.
  override $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  override $transaction<R>(
    fn: (prisma: Prisma.TransactionClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<R>;
  override $transaction(arg: any, options?: any): Promise<any> {
    const ctx = getTenantContext();
    const rawTransaction = PrismaClient.prototype.$transaction as (this: PrismaClient, ...a: any[]) => Promise<any>;
    if (!ctx || ctx.inTx) return rawTransaction.call(this, arg, options);
    const inner: TenantContext = { ...ctx, inTx: true };

    if (typeof arg === 'function') {
      return rawTransaction.call(
        this,
        (tx: Prisma.TransactionClient) =>
          tenantContextStorage.run(inner, async () => {
            await PrismaService.setConfig(tx, ctx);
            return arg(tx);
          }),
        options,
      );
    }
    // Batch: ilk eleman set_config; sonuçtan düşürülür.
    // await run() içinde: tembel PrismaPromise'ler bağlam dışına kaymasın.
    return tenantContextStorage.run(inner, async () =>
      (await rawTransaction.call(this, [PrismaService.setConfig(this, ctx), ...arg], options)).slice(1),
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
