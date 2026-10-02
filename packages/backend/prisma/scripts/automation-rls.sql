-- Otomasyon motoru RLS (P12 kalıbı). AutomationRule ve AutomationRun
-- 20260921135200_automation_engine migration'ıyla P12 dalgalarından SONRA eklendi;
-- hiçbir dalga betiği bunları kapsamıyordu. İkisi de agencyId taşır.
-- Uygulanma (superuser): psql "$DATABASE_MIGRATION_URL" -f prisma/scripts/automation-rls.sql
-- Ön koşul: p12-rls-00-role.sql (kroptos_app rolü + app_rls_allowed()).
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.

\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE "AutomationRule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AutomationRule";
CREATE POLICY tenant_isolation ON "AutomationRule" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AutomationRun" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AutomationRun";
CREATE POLICY tenant_isolation ON "AutomationRun" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

COMMIT;

-- Doğrulama
SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('AutomationRule', 'AutomationRun')
ORDER BY 1;
