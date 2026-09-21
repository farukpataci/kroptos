-- Order Settings & Numbering RLS and permissions (docs/siparis.ayarlari.md)
GRANT ALL PRIVILEGES ON "SettingValue" TO kroptos_app;
GRANT ALL PRIVILEGES ON "SettingChangeLog" TO kroptos_app;
GRANT ALL PRIVILEGES ON "OrderNumberSequence" TO kroptos_app;

ALTER TABLE "SettingValue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SettingValue";
CREATE POLICY tenant_isolation ON "SettingValue" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "SettingChangeLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SettingChangeLog";
CREATE POLICY tenant_isolation ON "SettingChangeLog" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "OrderNumberSequence" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderNumberSequence";
CREATE POLICY tenant_isolation ON "OrderNumberSequence" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));
