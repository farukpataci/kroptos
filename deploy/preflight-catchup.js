#!/usr/bin/env node
// deploy.ps1 ön kontrolü: yetişme migration'ı (20261002000000_manual_scripts_catchup) bekleniyor
// görünüyor ama nesneleri veritabanında ZATEN VARSA deploy durur.
//
// Neden: canlıda (ve 2026-10-02 öncesi kurulmuş her DB'de) bu migration'ın tabloları psql ile elle
// yaratıldı. `migrate deploy` dosyayı çalıştırmaya kalkarsa ilk CREATE TYPE'ta düşer ve migration
// "failed" kalır; sonraki her deploy kilitlenir. Doğrusu: dosyayı çalıştırmadan işaretlemek.
//
// Çıkış: 0 = sorun yok, 3 = işaretleme gerekiyor (mesaj stdout'ta), diğer = hata.
// Kullanım (packages/backend içinden, DATABASE_URL superuser):
//   node prisma/scripts/with-migration-url.js node <deploy>/preflight-catchup.js
// Prisma, betiğin bulunduğu yerden değil, sürümün packages/backend klasöründen çözülür.
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: [process.cwd()] }));

const CATCHUP = '20261002000000_manual_scripts_catchup';

async function main() {
  const prisma = new PrismaClient();
  try {
    // İki sorgu: Postgres tabloyu çalıştırmadan önce çözümler; boş DB'de _prisma_migrations yoksa
    // tek sorgudaki AND koruması işe yaramaz, sorgu hata verir.
    const [{ has_table: hasTable, has_objects: hasObjects }] = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_table,
              to_regclass('public."NotificationTemplate"') IS NOT NULL AS has_objects`,
    );
    let applied = false;
    if (hasTable) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM public._prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL`,
        CATCHUP,
      );
      applied = rows.length > 0;
    }
    if (!applied && hasObjects) {
      console.log(
        `DURDURULDU: ${CATCHUP} kayıtlı değil ama nesneleri veritabanında zaten var.\n` +
          `Çalıştırmadan işaretleyin (packages/backend içinden):\n` +
          `  node prisma/scripts/with-migration-url.js npx prisma migrate resolve --applied ${CATCHUP}\n` +
          `Önce: pnpm db:check-rls -> "RLS eksik: 0". Ayrıntı: docs/plans/surekli-teslim-yol-haritasi.md (Faz 0).`,
      );
      process.exitCode = 3;
      return;
    }
    console.log(`preflight: ${CATCHUP} ${applied ? 'kayıtlı' : 'kayıtlı değil, nesneleri de yok (boş DB)'} — devam`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
