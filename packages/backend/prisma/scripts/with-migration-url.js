#!/usr/bin/env node
// RLS (P12): şema işleri (db push, seed, psql) superuser bağlantısıyla yapılır.
// DATABASE_URL uygulama rolüne (kroptos_app, NOBYPASSRLS) işaret eder; bu sarmalayıcı
// alt komutu DATABASE_URL=DATABASE_MIGRATION_URL ile çalıştırır.
//   node prisma/scripts/with-migration-url.js npx prisma db push --skip-generate
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  console.error('DATABASE_MIGRATION_URL tanımlı değil (.env). Şema/seed superuser ister; uygulama rolüyle çalıştırılamaz.');
  process.exit(2);
}
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('kullanım: with-migration-url.js <komut> [arg...]');
  process.exit(2);
}
const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, DATABASE_URL: url } });
process.exit(r.status ?? 1);
