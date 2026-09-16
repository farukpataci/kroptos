/**
 * P4 izin backfill'i — canlı DB'ye yeni izinleri ekler ve geriye dönük uyumluluğu
 * korur: bir uç artık daha özel bir izin istiyorsa, ESKİ izne sahip her rol
 * yenisini de alır. Böylece hiçbir mevcut rol daha önce erişebildiği bir ucu
 * kaybetmez. Sistem rolleri ayrıca DEFAULT_ROLES'a (shared katalog) göre
 * tamamlanır (connect, asla set — ajansın elle eklediği izin silinmez).
 *
 *   npx ts-node prisma/scripts/backfill-p4-permissions.ts            # dry-run
 *   npx ts-node prisma/scripts/backfill-p4-permissions.ts --apply
 *
 * Eşleme (eski izin → uçların artık istediği yeni izin):
 *   products.create     → products.update, products.delete   (PATCH/DELETE /api/products/:id)
 *   orders.update       → orders.cancel                       (POST /api/orders/:id/cancel|refund)
 *   integrations.manage → integrations.sync                   (POST /api/integrations/:id/sync)
 *   clients.read / stores.read: GET uçları artık bunları istiyor; zaten tüm
 *   seed rollerinde var, warehouse_staff'a stores.read DEFAULT_ROLES ile gelir.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, DEFAULT_ROLES } from '@kroptos/shared';

const IMPLIES: Record<string, string[]> = {
  'products.create': ['products.update', 'products.delete'],
  'orders.update': ['orders.cancel'],
  'integrations.manage': ['integrations.sync'],
};

export async function run(prisma: PrismaClient, APPLY: boolean) {
  console.log(`Mod: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const before = { permission: await prisma.permission.count(), role: await prisma.role.count() };

  const existing = new Set((await prisma.permission.findMany({ select: { name: true } })).map((p) => p.name));
  const missing = PERMISSIONS.filter((p) => !existing.has(p.key));
  console.log(`Katalog ${PERMISSIONS.length}, DB ${existing.size}, eksik ${missing.length}: ${missing.map((p) => p.key).join(', ') || '-'}`);

  const roles = await prisma.role.findMany({
    where: { deletedAt: null },
    include: { permissions: { select: { name: true } } },
  });
  const plan: { role: string; add: string[] }[] = [];
  for (const role of roles) {
    const has = new Set(role.permissions.map((p) => p.name));
    const add = new Set<string>();
    for (const [oldKey, newKeys] of Object.entries(IMPLIES)) {
      if (has.has(oldKey)) newKeys.forEach((k) => !has.has(k) && add.add(k));
    }
    if (role.isSystem) {
      const def = DEFAULT_ROLES.find((r) => r.key === role.key);
      def?.permissions.forEach((k) => !has.has(k) && add.add(k));
    }
    if (add.size) plan.push({ role: `${role.key}${role.agencyId ? ` @${role.agencyId}` : ''}`, add: [...add].sort() });
  }
  console.table(plan.map((p) => ({ role: p.role, eklenecek: p.add.join(', ') })));

  if (!APPLY) {
    console.log('Dry-run: hiçbir şey yazılmadı. Uygulamak için --apply.');
    return;
  }

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: p.key },
      update: { description: p.description, category: p.category },
      create: { name: p.key, description: p.description, category: p.category },
    });
  }
  for (const role of roles) {
    const entry = plan.find((p) => p.role.startsWith(role.key) && (role.agencyId ? p.role.endsWith(role.agencyId) : !p.role.includes('@')));
    if (!entry) continue;
    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: { connect: entry.add.map((name) => ({ name })) } },
    });
  }

  const after = { permission: await prisma.permission.count(), role: await prisma.role.count() };
  console.log(`Permission ${before.permission} → ${after.permission}, Role ${before.role} → ${after.role} (rol sayısı değişmemeli)`);
}

if (require.main === module) {
  // RLS (P12): script superuser ile bağlanır (DATABASE_MIGRATION_URL).
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL } } });
  run(prisma, process.argv.includes('--apply'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
