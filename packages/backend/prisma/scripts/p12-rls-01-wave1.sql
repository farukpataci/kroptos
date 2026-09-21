-- P12 Adım 2 / dalga 1: Product + Category (pilot) (2 tablo, toplam 68)
-- Uygulanma (superuser): psql "$DATABASE_MIGRATION_URL" -f prisma/scripts/p12-rls-01-wave1.sql
-- Ön koşul: p12-rls-00-role.sql (kroptos_app rolü + app_rls_allowed()).
-- Politika: USING + WITH CHECK aynı koşul → okuma kadar yazma da kapalı.
--   app.rls_bypass='on'  → her satır (sistem bağlamı: pre-auth, worker çözümü, super admin, seed)
--   app.agency_id=<id>   → yalnız o ajans;  set edilmemişse → hiçbir satır (fail-closed)
-- Geri alma: her tablo için  ALTER TABLE "T" DISABLE ROW LEVEL SECURITY;  (politika kalabilir)
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.

\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Product";
CREATE POLICY tenant_isolation ON "Product" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Category";
CREATE POLICY tenant_isolation ON "Category" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

COMMIT;

-- Doğrulama
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('Product', 'Category')
ORDER BY 1;
