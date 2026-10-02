-- Yetişme migration'ı (2026-10-02).
--
-- 2026-09-15'te migration düzenine geçildi (0_init baseline), ancak sonraki şema ve RLS
-- değişiklikleri prisma/scripts/*.sql ile psql üzerinden elle uygulandı. Bu dosya o farkı
-- kapatır: boş bir veritabanında 0_init + 2026-09-21 migration'ları + bu dosya, canlı şemanın
-- aynısını kurar (tablolar, RLS rolü/fonksiyonu/politikaları, kısmi unique index'ler).
--
-- Canlıda (eticaret) ve mevcut lokal DB'lerde bu nesneler ZATEN VAR. Orada bu dosya
-- ÇALIŞTIRILMAZ; yalnız uygulanmış olarak işaretlenir (packages/backend içinden):
--   node prisma/scripts/with-migration-url.js npx prisma migrate resolve --applied 20261002000000_manual_scripts_catchup
--
-- Kaynaklar: Bölüm 1 = prisma migrate diff --from-migrations --to-schema-datamodel.
-- Bölüm 2 = p12-rls-00-role.sql, ortamdan bağımsız: parola yok, DB adı ve sahip rol sabit değil.
-- Bölüm 3 = p3-role-schema.sql kısmi index'leri.
-- Bölüm 4 = p12-rls-01..04, notification-templates, order-{export,import,settings}-init ve
-- automation-rls betiklerindeki RLS ifadeleri, birebir.
--
-- kroptos_app rolü PAROLASIZ oluşur. Her ortamda parola ayrıca atanır:
--   ALTER ROLE kroptos_app PASSWORD '<gizli>';

-- ============ Bölüm 1: Prisma şema farkı ============
-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'COD_REMINDER', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_RECEIVED', 'REFUND_COMPLETED', 'INVOICE_CREATED', 'ORDER_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "NotificationScope" AS ENUM ('AGENCY', 'CLIENT', 'STORE');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- DropIndex
DROP INDEX "Role_name_key";

-- DropIndex
DROP INDEX "UserRole_userId_agencyId_roleId_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "importJobId" TEXT,
ADD COLUMN     "settingsSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "category" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "agencyId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "scopeLevel" "NotificationScope" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "orderStatusKey" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodyText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "senderName" TEXT,
    "replyTo" TEXT,
    "smsSenderId" TEXT,
    "sendDelayMinutes" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplateVersion" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "templateId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "orderId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "renderedBody" TEXT NOT NULL,
    "status" "NotificationLogStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationProviderConfig" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secretsEncrypted" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExportPreset" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "rowMode" TEXT NOT NULL DEFAULT 'ORDER',
    "format" TEXT NOT NULL DEFAULT 'XLSX',
    "formatOptions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrderExportPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExportJob" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "presetId" TEXT,
    "requestedById" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "rowMode" TEXT NOT NULL DEFAULT 'ORDER',
    "format" TEXT NOT NULL DEFAULT 'XLSX',
    "formatOptions" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "includesPii" BOOLEAN NOT NULL DEFAULT false,
    "scheduleId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "downloadTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrderExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExportSchedule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "cron" TEXT NOT NULL DEFAULT '0 8 * * 1',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "relativeRange" TEXT NOT NULL DEFAULT 'LAST_7_DAYS',
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrderExportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderImportMapping" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'UPSERT',
    "matchKey" TEXT NOT NULL DEFAULT 'orderNumber',
    "columnMap" JSONB NOT NULL DEFAULT '{}',
    "valueMaps" JSONB NOT NULL DEFAULT '{}',
    "defaults" JSONB NOT NULL DEFAULT '{}',
    "fileHints" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrderImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderImportJob" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "mappingId" TEXT,
    "requestedById" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'XLSX',
    "mode" TEXT NOT NULL DEFAULT 'UPSERT',
    "matchKey" TEXT NOT NULL DEFAULT 'orderNumber',
    "columnMap" JSONB NOT NULL DEFAULT '{}',
    "valueMaps" JSONB NOT NULL DEFAULT '{}',
    "options" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "validOrders" INTEGER NOT NULL DEFAULT 0,
    "invalidOrders" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorReportKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rollbackDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrderImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderImportRowResult" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "rowNumbers" INTEGER[],
    "action" TEXT NOT NULL DEFAULT 'CREATE',
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "orderId" TEXT,
    "beforeSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderImportRowResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingValue" (
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL DEFAULT 'order',
    "key" TEXT NOT NULL,
    "scopeLevel" TEXT NOT NULL DEFAULT 'STORE',
    "scopeKey" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "value" JSONB NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SettingValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingChangeLog" (
    "id" TEXT NOT NULL,
    "settingValueId" TEXT,
    "namespace" TEXT NOT NULL DEFAULT 'order',
    "key" TEXT NOT NULL,
    "scopeLevel" TEXT NOT NULL DEFAULT 'STORE',
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedById" TEXT,
    "reason" TEXT,
    "changeSetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNumberSequence" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT 'DEFAULT',
    "period" TEXT NOT NULL DEFAULT 'GLOBAL',
    "current" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_agencyId_idx" ON "Invitation"("agencyId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE INDEX "NotificationTemplate_agencyId_idx" ON "NotificationTemplate"("agencyId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_storeId_idx" ON "NotificationTemplate"("storeId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_deletedAt_idx" ON "NotificationTemplate"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_agencyId_scopeKey_channel_event_orderS_key" ON "NotificationTemplate"("agencyId", "scopeKey", "channel", "event", "orderStatusKey", "locale");

-- CreateIndex
CREATE INDEX "NotificationTemplateVersion_agencyId_idx" ON "NotificationTemplateVersion"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplateVersion_templateId_version_key" ON "NotificationTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "NotificationLog_agencyId_idx" ON "NotificationLog"("agencyId");

-- CreateIndex
CREATE INDEX "NotificationLog_storeId_createdAt_idx" ON "NotificationLog"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_orderId_idx" ON "NotificationLog"("orderId");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX "NotificationProviderConfig_agencyId_idx" ON "NotificationProviderConfig"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationProviderConfig_agencyId_channel_key" ON "NotificationProviderConfig"("agencyId", "channel");

-- CreateIndex
CREATE INDEX "OrderExportPreset_agencyId_idx" ON "OrderExportPreset"("agencyId");

-- CreateIndex
CREATE INDEX "OrderExportPreset_storeId_idx" ON "OrderExportPreset"("storeId");

-- CreateIndex
CREATE INDEX "OrderExportPreset_deletedAt_idx" ON "OrderExportPreset"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExportPreset_storeId_name_key" ON "OrderExportPreset"("storeId", "name");

-- CreateIndex
CREATE INDEX "OrderExportJob_storeId_createdAt_idx" ON "OrderExportJob"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderExportJob_requestedById_createdAt_idx" ON "OrderExportJob"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "OrderExportJob_status_idx" ON "OrderExportJob"("status");

-- CreateIndex
CREATE INDEX "OrderExportJob_agencyId_idx" ON "OrderExportJob"("agencyId");

-- CreateIndex
CREATE INDEX "OrderExportSchedule_agencyId_idx" ON "OrderExportSchedule"("agencyId");

-- CreateIndex
CREATE INDEX "OrderExportSchedule_storeId_idx" ON "OrderExportSchedule"("storeId");

-- CreateIndex
CREATE INDEX "OrderExportSchedule_isActive_nextRunAt_idx" ON "OrderExportSchedule"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "OrderImportMapping_agencyId_idx" ON "OrderImportMapping"("agencyId");

-- CreateIndex
CREATE INDEX "OrderImportMapping_storeId_idx" ON "OrderImportMapping"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderImportMapping_storeId_name_key" ON "OrderImportMapping"("storeId", "name");

-- CreateIndex
CREATE INDEX "OrderImportJob_storeId_createdAt_idx" ON "OrderImportJob"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderImportJob_storeId_fileHash_idx" ON "OrderImportJob"("storeId", "fileHash");

-- CreateIndex
CREATE INDEX "OrderImportJob_agencyId_idx" ON "OrderImportJob"("agencyId");

-- CreateIndex
CREATE INDEX "OrderImportRowResult_jobId_status_idx" ON "OrderImportRowResult"("jobId", "status");

-- CreateIndex
CREATE INDEX "OrderImportRowResult_agencyId_idx" ON "OrderImportRowResult"("agencyId");

-- CreateIndex
CREATE INDEX "SettingValue_agencyId_idx" ON "SettingValue"("agencyId");

-- CreateIndex
CREATE INDEX "SettingValue_storeId_idx" ON "SettingValue"("storeId");

-- CreateIndex
CREATE INDEX "SettingValue_namespace_key_idx" ON "SettingValue"("namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SettingValue_agencyId_scopeKey_key" ON "SettingValue"("agencyId", "scopeKey");

-- CreateIndex
CREATE INDEX "SettingChangeLog_agencyId_idx" ON "SettingChangeLog"("agencyId");

-- CreateIndex
CREATE INDEX "SettingChangeLog_storeId_idx" ON "SettingChangeLog"("storeId");

-- CreateIndex
CREATE INDEX "SettingChangeLog_namespace_key_idx" ON "SettingChangeLog"("namespace", "key");

-- CreateIndex
CREATE INDEX "SettingChangeLog_changeSetId_idx" ON "SettingChangeLog"("changeSetId");

-- CreateIndex
CREATE INDEX "OrderNumberSequence_agencyId_idx" ON "OrderNumberSequence"("agencyId");

-- CreateIndex
CREATE INDEX "OrderNumberSequence_storeId_idx" ON "OrderNumberSequence"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderNumberSequence_storeId_series_period_key" ON "OrderNumberSequence"("storeId", "series", "period");

-- CreateIndex
CREATE INDEX "Order_importJobId_idx" ON "Order"("importJobId");

-- CreateIndex
CREATE INDEX "Role_agencyId_idx" ON "Role"("agencyId");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "OrderImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplateVersion" ADD CONSTRAINT "NotificationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExportJob" ADD CONSTRAINT "OrderExportJob_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "OrderExportPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExportJob" ADD CONSTRAINT "OrderExportJob_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "OrderExportSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExportSchedule" ADD CONSTRAINT "OrderExportSchedule_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "OrderExportPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderImportJob" ADD CONSTRAINT "OrderImportJob_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "OrderImportMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderImportRowResult" ADD CONSTRAINT "OrderImportRowResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OrderImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingChangeLog" ADD CONSTRAINT "SettingChangeLog_settingValueId_fkey" FOREIGN KEY ("settingValueId") REFERENCES "SettingValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ Bölüm 2: uygulama rolü ve RLS yardımcı fonksiyonu ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kroptos_app') THEN
    CREATE ROLE kroptos_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO kroptos_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO kroptos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kroptos_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO kroptos_app;
-- Migration'ı çalıştıran rolün (DATABASE_MIGRATION_URL) ileride yaratacağı tablolar için.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kroptos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO kroptos_app;

-- Bypass yalnız açıkça 'on' ise; app.agency_id yoksa/boşsa hiçbir satır eşleşmez.
CREATE OR REPLACE FUNCTION public.app_rls_allowed(row_agency text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
  SELECT current_setting('app.rls_bypass', true) = 'on'
      OR (row_agency IS NOT NULL AND row_agency = current_setting('app.agency_id', true));
$fn$;

GRANT EXECUTE ON FUNCTION public.app_rls_allowed(text) TO kroptos_app;

-- ============ Bölüm 3: kısmi unique index'ler (Prisma ifade edemez) ============
CREATE UNIQUE INDEX IF NOT EXISTS role_agency_key_uq ON "Role"("agencyId", "key")
  WHERE "agencyId" IS NOT NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_system_key_uq ON "Role"("key")
  WHERE "agencyId" IS NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS userrole_scope_uq ON "UserRole"(
  "userId", "agencyId", COALESCE("clientId", ''), COALESCE("storeId", ''), "roleId"
) WHERE "deletedAt" IS NULL;

-- ============ Bölüm 4: RLS politikaları ============

-- kaynak: prisma/scripts/p12-rls-01-wave1.sql
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

-- kaynak: prisma/scripts/p12-rls-02-wave2.sql
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

-- kaynak: prisma/scripts/p12-rls-03-wave3.sql
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

-- kaynak: prisma/scripts/p12-rls-04-wave4.sql
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

-- kaynak: prisma/scripts/notification-templates.sql
ALTER TABLE "NotificationTemplate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NotificationTemplate";
CREATE POLICY tenant_isolation ON "NotificationTemplate" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));
ALTER TABLE "NotificationTemplateVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NotificationTemplateVersion";
CREATE POLICY tenant_isolation ON "NotificationTemplateVersion" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));
ALTER TABLE "NotificationLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NotificationLog";
CREATE POLICY tenant_isolation ON "NotificationLog" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));
ALTER TABLE "NotificationProviderConfig" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NotificationProviderConfig";
CREATE POLICY tenant_isolation ON "NotificationProviderConfig" FOR ALL
  USING (public.app_rls_allowed("agencyId"))
  WITH CHECK (public.app_rls_allowed("agencyId"));

-- kaynak: prisma/scripts/order-export-init.sql
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

-- kaynak: prisma/scripts/order-import-init.sql
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

-- kaynak: prisma/scripts/order-settings-init.sql
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

-- kaynak: prisma/scripts/automation-rls.sql
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
