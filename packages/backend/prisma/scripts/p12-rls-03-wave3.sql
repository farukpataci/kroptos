-- P12 Adım 2 / dalga 3: WMS, analitik, ayarlar, depo, muhasebe, agent (36 tablo, toplam 68)
-- Uygulanma (superuser): psql "$DATABASE_MIGRATION_URL" -f prisma/scripts/p12-rls-03-wave3.sql
-- Ön koşul: p12-rls-00-role.sql (kroptos_app rolü + app_rls_allowed()).
-- Politika: USING + WITH CHECK aynı koşul → okuma kadar yazma da kapalı.
--   app.rls_bypass='on'  → her satır (sistem bağlamı: pre-auth, worker çözümü, super admin, seed)
--   app.agency_id=<id>   → yalnız o ajans;  set edilmemişse → hiçbir satır (fail-closed)
-- Geri alma: her tablo için  ALTER TABLE "T" DISABLE ROW LEVEL SECURITY;  (politika kalabilir)
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.

\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE "WmsPrinterSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WmsPrinterSettings";
CREATE POLICY tenant_isolation ON "WmsPrinterSettings" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "WmsShippingLabel" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WmsShippingLabel";
CREATE POLICY tenant_isolation ON "WmsShippingLabel" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "WmsPrintJob" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WmsPrintJob";
CREATE POLICY tenant_isolation ON "WmsPrintJob" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "WmsStockMovement" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WmsStockMovement";
CREATE POLICY tenant_isolation ON "WmsStockMovement" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "WmsPackagingTask" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WmsPackagingTask";
CREATE POLICY tenant_isolation ON "WmsPackagingTask" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AnalyticsDailySales" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AnalyticsDailySales";
CREATE POLICY tenant_isolation ON "AnalyticsDailySales" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AnalyticsDailyOrders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AnalyticsDailyOrders";
CREATE POLICY tenant_isolation ON "AnalyticsDailyOrders" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AnalyticsProductPerformance" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AnalyticsProductPerformance";
CREATE POLICY tenant_isolation ON "AnalyticsProductPerformance" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AnalyticsMarketplacePerformance" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AnalyticsMarketplacePerformance";
CREATE POLICY tenant_isolation ON "AnalyticsMarketplacePerformance" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "TenantSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TenantSettings";
CREATE POLICY tenant_isolation ON "TenantSettings" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "NotificationSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NotificationSettings";
CREATE POLICY tenant_isolation ON "NotificationSettings" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "SecuritySettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SecuritySettings";
CREATE POLICY tenant_isolation ON "SecuritySettings" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ApiKey";
CREATE POLICY tenant_isolation ON "ApiKey" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Warehouse";
CREATE POLICY tenant_isolation ON "Warehouse" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "WarehouseZone" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WarehouseZone";
CREATE POLICY tenant_isolation ON "WarehouseZone" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Warehouse" p WHERE p."id" = "WarehouseZone"."warehouseId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Warehouse" p WHERE p."id" = "WarehouseZone"."warehouseId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "WarehouseLocation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WarehouseLocation";
CREATE POLICY tenant_isolation ON "WarehouseLocation" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Warehouse" p WHERE p."id" = "WarehouseLocation"."warehouseId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Warehouse" p WHERE p."id" = "WarehouseLocation"."warehouseId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "StockSourceSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StockSourceSettings";
CREATE POLICY tenant_isolation ON "StockSourceSettings" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "StockAllocationRule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StockAllocationRule";
CREATE POLICY tenant_isolation ON "StockAllocationRule" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "MarketplaceStockRule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MarketplaceStockRule";
CREATE POLICY tenant_isolation ON "MarketplaceStockRule" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "ErpStockSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ErpStockSettings";
CREATE POLICY tenant_isolation ON "ErpStockSettings" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "LogoWarehouseMapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LogoWarehouseMapping";
CREATE POLICY tenant_isolation ON "LogoWarehouseMapping" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "LogoProductMapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LogoProductMapping";
CREATE POLICY tenant_isolation ON "LogoProductMapping" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StockMovement";
CREATE POLICY tenant_isolation ON "StockMovement" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "StockReservation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StockReservation";
CREATE POLICY tenant_isolation ON "StockReservation" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "InventorySnapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "InventorySnapshot";
CREATE POLICY tenant_isolation ON "InventorySnapshot" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AccountingIntegration" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingIntegration";
CREATE POLICY tenant_isolation ON "AccountingIntegration" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AccountingCompany" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingCompany";
CREATE POLICY tenant_isolation ON "AccountingCompany" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AccountingDocument" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingDocument";
CREATE POLICY tenant_isolation ON "AccountingDocument" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AccountingContactMapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingContactMapping";
CREATE POLICY tenant_isolation ON "AccountingContactMapping" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AccountingProductMapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingProductMapping";
CREATE POLICY tenant_isolation ON "AccountingProductMapping" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AccountingSyncCursor" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingSyncCursor";
CREATE POLICY tenant_isolation ON "AccountingSyncCursor" FOR ALL
  USING (EXISTS (SELECT 1 FROM "AccountingIntegration" p WHERE p."id" = "AccountingSyncCursor"."integrationId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "AccountingIntegration" p WHERE p."id" = "AccountingSyncCursor"."integrationId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "AccountingProblem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingProblem";
CREATE POLICY tenant_isolation ON "AccountingProblem" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AgentInstance" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AgentInstance";
CREATE POLICY tenant_isolation ON "AgentInstance" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AgentEnrollmentCode" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AgentEnrollmentCode";
CREATE POLICY tenant_isolation ON "AgentEnrollmentCode" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AgentCredentialEnvelope" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AgentCredentialEnvelope";
CREATE POLICY tenant_isolation ON "AgentCredentialEnvelope" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "AgentJob" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AgentJob";
CREATE POLICY tenant_isolation ON "AgentJob" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

COMMIT;

-- Doğrulama
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('WmsPrinterSettings', 'WmsShippingLabel', 'WmsPrintJob', 'WmsStockMovement', 'WmsPackagingTask', 'AnalyticsDailySales', 'AnalyticsDailyOrders', 'AnalyticsProductPerformance', 'AnalyticsMarketplacePerformance', 'TenantSettings', 'NotificationSettings', 'SecuritySettings', 'ApiKey', 'Warehouse', 'WarehouseZone', 'WarehouseLocation', 'StockSourceSettings', 'StockAllocationRule', 'MarketplaceStockRule', 'ErpStockSettings', 'LogoWarehouseMapping', 'LogoProductMapping', 'StockMovement', 'StockReservation', 'InventorySnapshot', 'AccountingIntegration', 'AccountingCompany', 'AccountingDocument', 'AccountingContactMapping', 'AccountingProductMapping', 'AccountingSyncCursor', 'AccountingProblem', 'AgentInstance', 'AgentEnrollmentCode', 'AgentCredentialEnvelope', 'AgentJob')
ORDER BY 1;
