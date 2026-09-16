/**
 * Eski AgencyService.create'in ürettiği 'Agency Owner' rolünü siler.
 *
 * O rol runtime'da yaratılıyordu, '*:*' bağlama upsert'i `update: {}` olduğu
 * için hiç izin almadı (0 izin) ve P1 ile üretim yolu kapandı. P3'te Role.key
 * name'den slug'lanınca 'Agency Owner' → 'agency_owner' olur ve seed rolüyle
 * @@unique([agencyId, key]) çakışır; migration'dan önce gitmeli.
 *
 * DİKKAT: UserRole.role onDelete: Cascade — rolün UserRole satırları (soft-
 * deleted olsalar da) HARD DELETE olur. O yüzden silmeden önce her satırın
 * tam içeriği AuditLog'a 'role.legacy_cleanup' olarak yazılır.
 *
 *   npx ts-node prisma/scripts/cleanup-legacy-role.ts            # dry-run
 *   npx ts-node prisma/scripts/cleanup-legacy-role.ts --apply    # siler
 *
 * Rolün izni varsa veya AKTİF (deletedAt null) UserRole satırı varsa script
 * durur: bu durumda "legacy" varsayımı yanlıştır, elle bakılmalı.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const LEGACY_ROLE_NAME = 'Agency Owner';

export async function run(prisma: PrismaClient, APPLY: boolean) {
  console.log(`Mod: ${APPLY ? 'APPLY' : 'DRY-RUN'} | rol: '${LEGACY_ROLE_NAME}'`);

  // Bu script P3 migration'ından ÖNCE çalışır; üretilmiş client ise yeni şemayı bilir.
  // Bu yüzden select ile yalnız eski şemada da var olan kolonlar okunur (Role.agencyId/key,
  // UserRole.updatedAt henüz yok → P2022).
  const role = await prisma.role.findFirst({
    where: { name: LEGACY_ROLE_NAME },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: { select: { name: true } },
      userRoles: {
        select: {
          id: true, userId: true, agencyId: true, clientId: true, storeId: true, roleId: true,
          createdAt: true, deletedAt: true, user: { select: { email: true } },
        },
      },
    },
  });
  if (!role) {
    console.log('Rol yok, yapılacak bir şey yok.');
    return;
  }

  const active = role.userRoles.filter((ur) => !ur.deletedAt);
  console.log(`izin: ${role.permissions.length}, UserRole satırı: ${role.userRoles.length} (aktif ${active.length})`);
  console.table(
    role.userRoles.map((ur) => ({ userRoleId: ur.id, email: ur.user.email, agencyId: ur.agencyId, deletedAt: ur.deletedAt })),
  );

  if (role.permissions.length > 0) {
    throw new Error(`'${LEGACY_ROLE_NAME}' ${role.permissions.length} izin taşıyor; legacy varsayımı yanlış, elle bak.`);
  }
  if (active.length > 0) {
    throw new Error(`'${LEGACY_ROLE_NAME}' ${active.length} AKTİF atamaya sahip; önce bunlar agency_owner'a taşınmalı.`);
  }

  if (!APPLY) {
    console.log('Dry-run: hiçbir şey yazılmadı. Silmek için --apply.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const ur of role.userRoles) {
      await tx.auditLog.create({
        data: {
          action: 'role.legacy_cleanup',
          entityType: 'UserRole',
          entityId: ur.id,
          userId: ur.userId,
          tenantId: ur.agencyId,
          // Cascade ile hard delete olacak satırın tam içeriği: geri gerekirse tek kayıt burası.
          newValue: JSON.parse(JSON.stringify({ ...ur, user: undefined, roleName: role.name })),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        action: 'role.legacy_cleanup',
        entityType: 'Role',
        entityId: role.id,
        tenantId: null,
        newValue: { id: role.id, name: role.name, description: role.description, cascadedUserRoles: role.userRoles.length },
      },
    });
    await tx.role.delete({ where: { id: role.id }, select: { id: true } });
  });

  const remaining = await prisma.userRole.count({ where: { roleId: role.id } });
  console.log(`Rol silindi. AuditLog'a ${role.userRoles.length + 1} kayıt yazıldı. Kalan UserRole satırı: ${remaining}`);
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
