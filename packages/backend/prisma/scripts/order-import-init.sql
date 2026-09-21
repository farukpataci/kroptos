-- Order Import RLS and permissions (docs/import.md)
GRANT ALL PRIVILEGES ON "OrderImportMapping" TO kroptos_app;
GRANT ALL PRIVILEGES ON "OrderImportJob" TO kroptos_app;
GRANT ALL PRIVILEGES ON "OrderImportRowResult" TO kroptos_app;

ALTER TABLE "OrderImportMapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderImportMapping";
CREATE POLICY tenant_isolation ON "OrderImportMapping" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "OrderImportJob" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderImportJob";
CREATE POLICY tenant_isolation ON "OrderImportJob" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "OrderImportRowResult" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderImportRowResult";
CREATE POLICY tenant_isolation ON "OrderImportRowResult" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));
