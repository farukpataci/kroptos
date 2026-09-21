-- P12 Adım 2 / dalga 2: Sipariş, stok, entegrasyon, kargo (23 tablo, toplam 68)
-- Uygulanma (superuser): psql "$DATABASE_MIGRATION_URL" -f prisma/scripts/p12-rls-02-wave2.sql
-- Ön koşul: p12-rls-00-role.sql (kroptos_app rolü + app_rls_allowed()).
-- Politika: USING + WITH CHECK aynı koşul → okuma kadar yazma da kapalı.
--   app.rls_bypass='on'  → her satır (sistem bağlamı: pre-auth, worker çözümü, super admin, seed)
--   app.agency_id=<id>   → yalnız o ajans;  set edilmemişse → hiçbir satır (fail-closed)
-- Geri alma: her tablo için  ALTER TABLE "T" DISABLE ROW LEVEL SECURITY;  (politika kalabilir)
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.

\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Order";
CREATE POLICY tenant_isolation ON "Order" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderItem";
CREATE POLICY tenant_isolation ON "OrderItem" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Order" p WHERE p."id" = "OrderItem"."orderId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Order" p WHERE p."id" = "OrderItem"."orderId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "OrderTimeline" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderTimeline";
CREATE POLICY tenant_isolation ON "OrderTimeline" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Order" p WHERE p."id" = "OrderTimeline"."orderId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Order" p WHERE p."id" = "OrderTimeline"."orderId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Inventory";
CREATE POLICY tenant_isolation ON "Inventory" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "InventoryAdjustment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "InventoryAdjustment";
CREATE POLICY tenant_isolation ON "InventoryAdjustment" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Inventory" p WHERE p."id" = "InventoryAdjustment"."inventoryId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Inventory" p WHERE p."id" = "InventoryAdjustment"."inventoryId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Integration";
CREATE POLICY tenant_isolation ON "Integration" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "IntegrationSetting" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IntegrationSetting";
CREATE POLICY tenant_isolation ON "IntegrationSetting" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "IntegrationSettingRevision" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IntegrationSettingRevision";
CREATE POLICY tenant_isolation ON "IntegrationSettingRevision" FOR ALL
  USING (EXISTS (SELECT 1 FROM "IntegrationSetting" p WHERE p."id" = "IntegrationSettingRevision"."integrationSettingId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "IntegrationSetting" p WHERE p."id" = "IntegrationSettingRevision"."integrationSettingId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "IntegrationSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IntegrationSettings";
CREATE POLICY tenant_isolation ON "IntegrationSettings" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "IntegrationQueue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IntegrationQueue";
CREATE POLICY tenant_isolation ON "IntegrationQueue" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "IntegrationLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IntegrationLog";
CREATE POLICY tenant_isolation ON "IntegrationLog" FOR ALL
  USING (public.app_rls_allowed("tenantId"))
  WITH CHECK (public.app_rls_allowed("tenantId"));

ALTER TABLE "ApiLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ApiLog";
CREATE POLICY tenant_isolation ON "ApiLog" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "ProductMapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ProductMapping";
CREATE POLICY tenant_isolation ON "ProductMapping" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "ProductMapping"."productId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "ProductMapping"."productId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "BundleItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BundleItem";
CREATE POLICY tenant_isolation ON "BundleItem" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "BundleItem"."bundleProductId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "BundleItem"."bundleProductId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "CrossSellProduct" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CrossSellProduct";
CREATE POLICY tenant_isolation ON "CrossSellProduct" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "CrossSellProduct"."sourceProductId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "CrossSellProduct"."sourceProductId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "WebhookSubscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WebhookSubscription";
CREATE POLICY tenant_isolation ON "WebhookSubscription" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WebhookEvent";
CREATE POLICY tenant_isolation ON "WebhookEvent" FOR ALL
  USING (EXISTS (SELECT 1 FROM "WebhookSubscription" p WHERE p."id" = "WebhookEvent"."subscriptionId" AND public.app_rls_allowed(p."agencyId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "WebhookSubscription" p WHERE p."id" = "WebhookEvent"."subscriptionId" AND public.app_rls_allowed(p."agencyId")));

ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Shipment";
CREATE POLICY tenant_isolation ON "Shipment" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "ShipmentPackage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ShipmentPackage";
CREATE POLICY tenant_isolation ON "ShipmentPackage" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "ShipmentTrackingEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ShipmentTrackingEvent";
CREATE POLICY tenant_isolation ON "ShipmentTrackingEvent" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "CarrierIntegration" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CarrierIntegration";
CREATE POLICY tenant_isolation ON "CarrierIntegration" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "CarrierRule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CarrierRule";
CREATE POLICY tenant_isolation ON "CarrierRule" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

ALTER TABLE "CarrierWebhookEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CarrierWebhookEvent";
CREATE POLICY tenant_isolation ON "CarrierWebhookEvent" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

COMMIT;

-- Doğrulama
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('Order', 'OrderItem', 'OrderTimeline', 'Inventory', 'InventoryAdjustment', 'Integration', 'IntegrationSetting', 'IntegrationSettingRevision', 'IntegrationSettings', 'IntegrationQueue', 'IntegrationLog', 'ApiLog', 'ProductMapping', 'BundleItem', 'CrossSellProduct', 'WebhookSubscription', 'WebhookEvent', 'Shipment', 'ShipmentPackage', 'ShipmentTrackingEvent', 'CarrierIntegration', 'CarrierRule', 'CarrierWebhookEvent')
ORDER BY 1;
