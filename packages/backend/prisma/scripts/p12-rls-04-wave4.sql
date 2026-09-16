-- P12 Adım 2 / dalga 4: Kiracı çekirdeği: Client, Store, StoreUser, UserRole, Role, Invitation, AuditLog (7 tablo, toplam 68)
-- Uygulanma (superuser): psql "$DATABASE_MIGRATION_URL" -f prisma/scripts/p12-rls-04-wave4.sql
-- Ön koşul: p12-rls-00-role.sql (kroptos_app rolü + app_rls_allowed()).
-- Politika: USING + WITH CHECK aynı koşul → okuma kadar yazma da kapalı.
--   app.rls_bypass='on'  → her satır (sistem bağlamı: pre-auth, worker çözümü, super admin, seed)
--   app.agency_id=<id>   → yalnız o ajans;  set edilmemişse → hiçbir satır (fail-closed)
-- Geri alma: her tablo için  ALTER TABLE "T" DISABLE ROW LEVEL SECURITY;  (politika kalabilir)
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.

\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Client";
CREATE POLICY tenant_isolation ON "Client" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Store";
CREATE POLICY tenant_isolation ON "Store" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "StoreUser" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StoreUser";
CREATE POLICY tenant_isolation ON "StoreUser" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Store" p WHERE p."id" = "StoreUser"."storeId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Store" p WHERE p."id" = "StoreUser"."storeId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "UserRole";
CREATE POLICY tenant_isolation ON "UserRole" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Role";
CREATE POLICY tenant_isolation ON "Role" FOR ALL
  USING (("agencyId" IS NULL OR public.app_rls_allowed("agencyId")))
  WITH CHECK (("agencyId" IS NULL OR public.app_rls_allowed("agencyId")));

ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Invitation";
CREATE POLICY tenant_isolation ON "Invitation" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

COMMIT;

-- Doğrulama
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('Client', 'Store', 'StoreUser', 'UserRole', 'Role', 'Invitation', 'AuditLog')
ORDER BY 1;
