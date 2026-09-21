/**
 * Notification-template permissions into an existing database.
 *
 * Same shape and reasons as backfill-carrier-permissions.ts: seed.ts cannot be
 * re-run against a live database (it resets the super admin password and uses
 * `set` on role permissions). This upserts the seven permissions by name and
 * `connect`s them to the roles packages/shared/src/permissions.ts grants them
 * to — read from the catalog, not copied, so the two cannot drift.
 * Running it twice changes nothing.
 *
 *   npx ts-node prisma/scripts/backfill-notification-permissions.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, DEFAULT_ROLES } from '@kroptos/shared';

// RLS (P12): seed/script superuser ile bağlanır; uygulama rolü kiracı tablolarını bağlamsız göremez.
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL } } });

const TARGET = PERMISSIONS.filter((p) => p.key.startsWith('notification_'));

async function main() {
  const before = await prisma.permission.count();

  for (const p of TARGET) {
    await prisma.permission.upsert({
      where: { name: p.key },
      update: { description: p.description, category: p.category },
      create: { name: p.key, description: p.description, category: p.category },
    });
  }

  for (const roleDef of DEFAULT_ROLES) {
    const names = roleDef.permissions.filter((k) => k.startsWith('notification_'));
    if (!names.length) continue;
    const role = await prisma.role.findFirst({ where: { key: roleDef.key, agencyId: null, deletedAt: null } });
    if (!role) {
      console.log(`rol DB'de yok, atlandı: ${roleDef.key}`);
      continue;
    }
    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: { connect: names.map((name) => ({ name })) } },
    });
  }

  const after = await prisma.permission.count();
  console.log(`permission: ${before} -> ${after}`);
  for (const p of TARGET) {
    const row = await prisma.permission.findUnique({
      where: { name: p.key },
      include: { roles: { select: { key: true }, orderBy: { key: 'asc' } } },
    });
    console.log(`${p.key.padEnd(34)} ${row?.roles.map((r) => r.key).join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
