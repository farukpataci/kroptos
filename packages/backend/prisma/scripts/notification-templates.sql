-- Bildirim şablonları (docs/eposta.md). Uygulama: psql "$DATABASE_MIGRATION_URL" -f prisma/scripts/notification-templates.sql
-- Üretim: prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script + RLS bloğu.
-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'COD_REMINDER', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_RECEIVED', 'REFUND_COMPLETED', 'INVOICE_CREATED', 'ORDER_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "NotificationScope" AS ENUM ('AGENCY', 'CLIENT', 'STORE');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

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

-- AddForeignKey
ALTER TABLE "NotificationTemplateVersion" ADD CONSTRAINT "NotificationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS (P12 kalıbı): dört tablo da agencyId taşır. GRANT'lar 00-role'deki
-- ALTER DEFAULT PRIVILEGES ile otomatik gelir (postgres rolüyle çalıştırıldığında).
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
