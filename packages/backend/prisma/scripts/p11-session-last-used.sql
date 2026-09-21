-- P11: Session.lastUsedAt (nullable, backfill yok). Tek aşama: nullable kolon dolu
-- tabloda güvenle eklenir. Kaynak: prisma migrate diff çıktısı.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/p11-session-last-used.sql
BEGIN;
ALTER TABLE "Session" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "Session";
  RAISE NOTICE 'Session satırı: % (değişmedi)', n;
END $$;
COMMIT;
