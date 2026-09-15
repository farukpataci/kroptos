/**
 * super_admin rolünü platform rolüne indirger.
 *
 * Eski register akışı kayıt olan HERKESE super_admin veriyordu (auth.service.ts,
 * P1 öncesi). Bu script PLATFORM_ADMIN_EMAILS allowlist'inde OLMAYAN her
 * super_admin UserRole satırını agency_owner'a çevirir. Allowlist'tekiler
 * (varsayılan: common/constants/platform-admin.ts) dokunulmadan kalır.
 *
 *   npx ts-node prisma/scripts/backfill-super-admin.ts            # dry-run, yazmaz
 *   npx ts-node prisma/scripts/backfill-super-admin.ts --apply    # uygular
 *
 * Kullanıcının aynı ajansta zaten agency_owner satırı varsa (unique
 * [userId, agencyId, roleId]) super_admin satırı soft-delete edilir, yenisi
 * açılmaz. Her değişiklik AuditLog'a 'role.backfill_super_admin' olarak yazılır.
 */
import { PrismaClient } from '@prisma/client';
import { platformAdminEmails } from '../../src/common/constants/platform-admin';

export async function run(prisma: PrismaClient, APPLY: boolean) {
  const allowlist = platformAdminEmails();
  console.log(`Mod: ${APPLY ? 'APPLY' : 'DRY-RUN'} | allowlist: ${allowlist.join(', ')}`);

  const [superAdmin, agencyOwner] = await Promise.all([
    prisma.role.findUnique({ where: { name: 'super_admin' } }),
    prisma.role.findUnique({ where: { name: 'agency_owner' } }),
  ]);
  if (!superAdmin) throw new Error("Role 'super_admin' not found");
  if (!agencyOwner) throw new Error("Role 'agency_owner' not found — run prisma/seed.ts first");

  const rows = await prisma.userRole.findMany({
    where: { roleId: superAdmin.id, deletedAt: null },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const targets = rows.filter((r) => !allowlist.includes(r.user.email.toLowerCase()));
  console.log(`super_admin satırı: ${rows.length}, allowlist dışı (etkilenecek): ${targets.length}`);
  console.table(targets.map((r) => ({ userRoleId: r.id, email: r.user.email, agencyId: r.agencyId })));

  if (!APPLY || targets.length === 0) {
    console.log(APPLY ? 'Etkilenecek satır yok.' : 'Dry-run: hiçbir şey yazılmadı. Uygulamak için --apply.');
    return;
  }

  let converted = 0;
  let merged = 0;
  for (const row of targets) {
    await prisma.$transaction(async (tx) => {
      const existingOwner = await tx.userRole.findUnique({
        where: { userId_agencyId_roleId: { userId: row.userId, agencyId: row.agencyId, roleId: agencyOwner.id } },
      });
      if (existingOwner) {
        await tx.userRole.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
        if (existingOwner.deletedAt) {
          await tx.userRole.update({ where: { id: existingOwner.id }, data: { deletedAt: null } });
        }
        merged++;
      } else {
        await tx.userRole.update({ where: { id: row.id }, data: { roleId: agencyOwner.id } });
        converted++;
      }
      await tx.auditLog.create({
        data: {
          action: 'role.backfill_super_admin',
          entityType: 'UserRole',
          entityId: row.id,
          userId: row.userId,
          tenantId: row.agencyId,
          oldValue: { roleId: superAdmin.id, roleName: 'super_admin' },
          newValue: { roleId: agencyOwner.id, roleName: 'agency_owner', merged: Boolean(existingOwner) },
        },
      });
    });
  }

  const remaining = await prisma.userRole.count({ where: { roleId: superAdmin.id, deletedAt: null } });
  console.log(`Dönüştürülen: ${converted}, mevcut agency_owner ile birleştirilen: ${merged}, kalan super_admin: ${remaining}`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  run(prisma, process.argv.includes('--apply'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
