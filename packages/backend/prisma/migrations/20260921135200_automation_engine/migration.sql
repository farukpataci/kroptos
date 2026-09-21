-- AlterTable: add hold, priority, tags to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "holdReason" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'normal';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Drop old temporary automation tables if they exist
DROP TABLE IF EXISTS "OrderAutomationRun" CASCADE;
DROP TABLE IF EXISTS "OrderAutomationRule" CASCADE;

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "scopeLevel" TEXT NOT NULL DEFAULT 'STORE',
    "triggerType" TEXT NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "conditions" JSONB NOT NULL DEFAULT '{"version":1,"operator":"and","conditions":[]}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
    "runOncePerOrder" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "AutomationRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL DEFAULT 1,
    "orderId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "conditionTrace" JSONB,
    "status" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationActionRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_agencyId_idx" ON "AutomationRule"("agencyId");

-- CreateIndex
CREATE INDEX "AutomationRule_storeId_idx" ON "AutomationRule"("storeId");

-- CreateIndex
CREATE INDEX "AutomationRule_storeId_triggerType_isActive_idx" ON "AutomationRule"("storeId", "triggerType", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRule_priority_idx" ON "AutomationRule"("priority");

-- CreateIndex
CREATE INDEX "AutomationRule_deletedAt_idx" ON "AutomationRule"("deletedAt");

-- CreateIndex
CREATE INDEX "AutomationRuleVersion_ruleId_idx" ON "AutomationRuleVersion"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRuleVersion_ruleId_version_key" ON "AutomationRuleVersion"("ruleId", "version");

-- CreateIndex
CREATE INDEX "AutomationRun_agencyId_idx" ON "AutomationRun"("agencyId");

-- CreateIndex
CREATE INDEX "AutomationRun_storeId_idx" ON "AutomationRun"("storeId");

-- CreateIndex
CREATE INDEX "AutomationRun_storeId_createdAt_idx" ON "AutomationRun"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationRun_orderId_idx" ON "AutomationRun"("orderId");

-- CreateIndex
CREATE INDEX "AutomationRun_ruleId_createdAt_idx" ON "AutomationRun"("ruleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_ruleId_eventId_key" ON "AutomationRun"("ruleId", "eventId");

-- CreateIndex
CREATE INDEX "AutomationActionRun_runId_idx" ON "AutomationActionRun"("runId");

-- CreateIndex
CREATE INDEX "AutomationActionRun_status_idx" ON "AutomationActionRun"("status");

-- AddForeignKey
ALTER TABLE "AutomationRuleVersion" ADD CONSTRAINT "AutomationRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationActionRun" ADD CONSTRAINT "AutomationActionRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
