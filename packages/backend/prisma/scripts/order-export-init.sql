-- Order Export RLS and permissions (docs/export.md)
GRANT ALL PRIVILEGES ON "OrderExportPreset" TO kroptos_app;
GRANT ALL PRIVILEGES ON "OrderExportJob" TO kroptos_app;
GRANT ALL PRIVILEGES ON "OrderExportSchedule" TO kroptos_app;

ALTER TABLE "OrderExportPreset" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderExportPreset";
CREATE POLICY tenant_isolation ON "OrderExportPreset" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "OrderExportJob" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderExportJob";
CREATE POLICY tenant_isolation ON "OrderExportJob" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "OrderExportSchedule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderExportSchedule";
CREATE POLICY tenant_isolation ON "OrderExportSchedule" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));
