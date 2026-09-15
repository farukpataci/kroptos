-- P3: tenant-scoped Role, UserRole kapsam benzersizliği, Invitation
--
-- Kaynak: `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script`
-- çıktısı, elle üç aşamaya bölündü. Tek parça uygulanamaz: "key" TEXT NOT NULL ve
-- "updatedAt" NOT NULL dolu tabloda patlar, partial unique index'leri Prisma zaten
-- ifade edemez. Repo migration geçmişi tutmuyor, db push da iki aşamalı veri
-- taşımasını ifade edemiyor; bu dosya tek kayıt.
--
-- Uygulama:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/p3-role-schema.sql
-- Her aşama kendi transaction'ında; DO bloklarındaki kontroller RAISE ile durdurur.
--
-- Diff'in ürettiği ama BİLEREK ALINMAYAN üç satır (başka branch'in DB'ye db push
-- ile gitmiş, henüz commit'lenmemiş kolonları; bu dosyanın işi değil):
--   ALTER TABLE "AccountingCompany"     DROP COLUMN "postingDefaults";
--   ALTER TABLE "AccountingIntegration" DROP COLUMN "maxSessions";
--   ALTER TABLE "AgentInstance"         DROP COLUMN "tunnelSecret";

-- ============================================================================
-- AŞAMA A — kolonları NULLABLE ekle, yeni tablo, yeni FK/index. Veri yazmaz.
-- Öncesi (2026-09-15 canlı, cleanup-legacy-role --apply sonrası): Role 9, Permission 54, UserRole 2, Invitation (yok)
-- Sonrası beklenen: Role 9, Permission 54, UserRole 2, Invitation 0 — satır sayısı değişmez.
-- ============================================================================
BEGIN;

ALTER TABLE "Permission" ADD COLUMN "category" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Role"
  ADD COLUMN "agencyId"  TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "isSystem"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "key"       TEXT,            -- Aşama C'de NOT NULL
  ADD COLUMN "updatedAt" TIMESTAMP(3);    -- Aşama C'de NOT NULL

ALTER TABLE "UserRole" ADD COLUMN "updatedAt" TIMESTAMP(3);  -- Aşama C'de NOT NULL

CREATE TABLE "Invitation" (
    "id"         TEXT NOT NULL,
    "agencyId"   TEXT NOT NULL,
    "clientId"   TEXT,
    "storeId"    TEXT,
    "email"      TEXT NOT NULL,
    "roleId"     TEXT NOT NULL,
    "tokenHash"  TEXT NOT NULL,
    "invitedBy"  TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_agencyId_idx" ON "Invitation"("agencyId");
CREATE INDEX "Invitation_email_idx"    ON "Invitation"("email");
CREATE INDEX "Invitation_status_idx"   ON "Invitation"("status");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Role_agencyId_idx" ON "Role"("agencyId");
ALTER TABLE "Role" ADD CONSTRAINT "Role_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE r int; p int; u int; i int;
BEGIN
  SELECT count(*) INTO r FROM "Role";
  SELECT count(*) INTO p FROM "Permission";
  SELECT count(*) INTO u FROM "UserRole";
  SELECT count(*) INTO i FROM "Invitation";
  RAISE NOTICE 'AŞAMA A sonrası: Role=% Permission=% UserRole=% Invitation=%', r, p, u, i;
  IF i <> 0 THEN RAISE EXCEPTION 'Invitation boş olmalıydı'; END IF;
END $$;

COMMIT;

-- ============================================================================
-- AŞAMA B — backfill. Satır sayısı değişmez; Role.key / isSystem / updatedAt dolar.
-- Önce ÇAKIŞMA KONTROLLERİ: biri patlarsa hiçbir şey yazılmaz (aynı transaction).
-- ============================================================================
BEGIN;

-- B0. Eski @@unique([userId, agencyId, roleId]) yerine gelecek kapsam indeksi
-- (userId, agencyId, COALESCE(clientId,''), COALESCE(storeId,''), roleId) WHERE deletedAt IS NULL
-- altında çakışan AKTİF satır var mı? Eski unique daha dardı, dolayısıyla teorik
-- olarak olamaz; yine de ölç. Varsa DUR — birleştirme/silme kararı insana ait.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM "UserRole" WHERE "deletedAt" IS NULL
    GROUP BY "userId", "agencyId", COALESCE("clientId",''), COALESCE("storeId",''), "roleId"
    HAVING count(*) > 1
  ) d;
  IF n > 0 THEN RAISE EXCEPTION 'UserRole: % çakışan aktif kapsam grubu var; migration durduruldu, elle bak', n; END IF;
  RAISE NOTICE 'B0 UserRole çakışma: 0';
END $$;

-- B1. Role.key slug'ı: lower(name), boşluk/tire → alt çizgi, alfanümerik ve _ dışı atılır.
--     Örn. 'super_admin' → 'super_admin', 'Agency Owner' → 'agency_owner'.
--     Aynı slug'a düşen iki rol varsa DUR (cleanup-legacy-role.ts --apply sonrası çıkmamalı).
DO $$
DECLARE n int; dup text;
BEGIN
  SELECT count(*), string_agg(k || ' <- [' || names || ']', '; ') INTO n, dup FROM (
    SELECT regexp_replace(replace(replace(lower(name), ' ', '_'), '-', '_'), '[^a-z0-9_]', '', 'g') AS k,
           string_agg(name, ', ') AS names
    FROM "Role" GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF n > 0 THEN RAISE EXCEPTION 'Role slug çakışması (%): %', n, dup; END IF;
  RAISE NOTICE 'B1 Role slug çakışma: 0';
END $$;

UPDATE "Role"
SET "key"       = regexp_replace(replace(replace(lower(name), ' ', '_'), '-', '_'), '[^a-z0-9_]', '', 'g'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IS NULL;

-- B2. Dokuz seed rolü sistem rolüdür: agencyId NULL, isSystem true.
UPDATE "Role" SET "isSystem" = true, "agencyId" = NULL
WHERE "key" IN ('super_admin','agency_owner','agency_admin','client_admin','store_manager',
                'accountant','warehouse_staff','support','viewer');

UPDATE "UserRole" SET "updatedAt" = COALESCE("deletedAt", "createdAt") WHERE "updatedAt" IS NULL;

-- B3. Kontroller: boş key yok, sistem rolü sayısı 9, updatedAt NULL yok.
DO $$
DECLARE r int; e int; s int; un int; extra text;
BEGIN
  SELECT count(*) INTO r FROM "Role";
  SELECT count(*) INTO e FROM "Role" WHERE "key" IS NULL OR "key" = '';
  SELECT count(*) INTO s FROM "Role" WHERE "isSystem";
  SELECT count(*) INTO un FROM "UserRole" WHERE "updatedAt" IS NULL;
  SELECT string_agg(name, ', ') INTO extra FROM "Role" WHERE NOT "isSystem";
  RAISE NOTICE 'AŞAMA B sonrası: Role=% boşKey=% sistemRolü=% UserRole.updatedAt NULL=% sistemDışı=[%]', r, e, s, un, COALESCE(extra,'');
  IF e > 0 THEN RAISE EXCEPTION 'Role.key boş kalan % satır', e; END IF;
  IF s <> 9 THEN RAISE EXCEPTION 'Sistem rolü sayısı 9 olmalıydı, %', s; END IF;
  IF un > 0 THEN RAISE EXCEPTION 'UserRole.updatedAt NULL kalan % satır', un; END IF;
END $$;

COMMIT;

-- ============================================================================
-- AŞAMA C — constraint ve index'ler. Satır sayısı değişmez.
-- ============================================================================
BEGIN;

ALTER TABLE "Role"     ALTER COLUMN "key"       SET NOT NULL;
ALTER TABLE "Role"     ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "UserRole" ALTER COLUMN "updatedAt" SET NOT NULL;

DROP INDEX "Role_name_key";                         -- name artık görünen ad
DROP INDEX "UserRole_userId_agencyId_roleId_key";   -- aynı rol iki mağaza için verilebilsin

-- NULL tuzağı: @@unique([agencyId, key]) altında agencyId IS NULL iki satır aynı key ile
-- girebilir (PostgreSQL NULL <> NULL). İki partial index; Prisma ifade edemez.
CREATE UNIQUE INDEX role_agency_key_uq ON "Role"("agencyId", "key")
  WHERE "agencyId" IS NOT NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX role_system_key_uq ON "Role"("key")
  WHERE "agencyId" IS NULL AND "deletedAt" IS NULL;

-- Aynı NULL tuzağı clientId/storeId için: COALESCE ile.
CREATE UNIQUE INDEX userrole_scope_uq ON "UserRole"(
  "userId", "agencyId", COALESCE("clientId", ''), COALESCE("storeId", ''), "roleId"
) WHERE "deletedAt" IS NULL;

DO $$
DECLARE r int; p int; u int; i int; ix int;
BEGIN
  SELECT count(*) INTO r FROM "Role";
  SELECT count(*) INTO p FROM "Permission";
  SELECT count(*) INTO u FROM "UserRole";
  SELECT count(*) INTO i FROM "Invitation";
  SELECT count(*) INTO ix FROM pg_indexes
    WHERE indexname IN ('role_agency_key_uq','role_system_key_uq','userrole_scope_uq');
  RAISE NOTICE 'AŞAMA C sonrası: Role=% Permission=% UserRole=% Invitation=% partialIndex=%', r, p, u, i, ix;
  IF ix <> 3 THEN RAISE EXCEPTION 'partial index sayısı 3 olmalıydı, %', ix; END IF;
END $$;

COMMIT;
