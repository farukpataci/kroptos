# prisma/scripts

## `*.sql` — tarihsel kayıt, yeniden uygulanmaz

Bu SQL dosyaları 2026-09-15 ile 2026-10-02 arasında psql ile elle uygulandı (P3 rol şeması,
P11, P12 RLS dalgaları, bildirim/sipariş tabloları, otomasyon RLS). İçerikleri
`prisma/migrations/20261002000000_manual_scripts_catchup/migration.sql`'e taşındı;
boş bir veritabanında migration'lar canlı şemanın aynısını kurar (2026-10-02'de ölçüldü:
tablolar, 83 politika, 373 index ve `kroptos_app` yetkileri birebir).

Yeni şema veya RLS değişikliği buraya değil, yeni bir migration'a yazılır (README › Schema changes).

**Tek istisna — `p12-rls-00-role.sql`'in parola kısmı:** migration `kroptos_app` rolünü parolasız
yaratır. Yeni bir ortamda parola elle atanır:

```sql
ALTER ROLE kroptos_app PASSWORD '<gizli>';
```

## Betikler

| Dosya | Ne yapar |
|---|---|
| `with-migration-url.js` | Alt komutu `DATABASE_MIGRATION_URL` (superuser) ile çalıştırır |
| `check-rls.js` | `agencyId`/`tenantId` taşıyan her tabloda RLS + politika var mı (`pnpm db:check-rls`) |
| `*.ts` | Tek seferlik backfill/bakım betikleri |
