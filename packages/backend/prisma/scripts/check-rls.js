#!/usr/bin/env node
// Kiracı verisi taşıyan her tabloda RLS açık ve en az bir politika var mı?
// Kiracı kolonu: agencyId veya tenantId (AuditLog, IntegrationLog). agencyId'siz çocuk tablolar
// (OrderItem vb.) üst tablo üzerinden korunur; onlar bu kontrolün kapsamı dışında.
//
// Neden: 2026-10-02'de AutomationRule/AutomationRun RLS'siz bulundu — RLS betiği yazılmamıştı,
// arka plan işleri sessizce boş veriyle koştu. Yeni tablo eklendiğinde bu kontrol kırmızı döner.
//
// Kullanım (packages/backend): pnpm db:check-rls   → çıkış kodu 0 = tamam, 1 = eksik var
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw`
      SELECT c.relname AS "table",
             c.relrowsecurity AS "rls",
             (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS "policies"
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_schema = 'public' AND col.table_name = c.relname
            AND col.column_name IN ('agencyId', 'tenantId')
        )
      ORDER BY c.relname`;
    const missing = rows.filter((r) => !r.rls || r.policies === 0);
    console.log(`Kiracı kolonlu tablo: ${rows.length}, RLS eksik: ${missing.length}`);
    for (const r of missing) {
      console.error(`  RLS EKSİK: "${r.table}" (rls=${r.rls}, politika=${r.policies})`);
    }
    if (missing.length > 0) {
      console.error('Yeni tablonun RLS politikası kendi migration dosyasına yazılmalı (README › Schema changes).');
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
