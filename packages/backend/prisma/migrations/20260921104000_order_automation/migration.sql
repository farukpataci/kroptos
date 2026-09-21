-- CreateTable
CREATE TABLE "OrderAutomationRule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrderAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAutomationRun" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "appliedAction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderAutomationRule_agencyId_idx" ON "OrderAutomationRule"("agencyId");

-- CreateIndex
CREATE INDEX "OrderAutomationRule_storeId_idx" ON "OrderAutomationRule"("storeId");

-- CreateIndex
CREATE INDEX "OrderAutomationRule_storeId_trigger_isActive_idx" ON "OrderAutomationRule"("storeId", "trigger", "isActive");

-- CreateIndex
CREATE INDEX "OrderAutomationRule_priority_idx" ON "OrderAutomationRule"("priority");

-- CreateIndex
CREATE INDEX "OrderAutomationRule_deletedAt_idx" ON "OrderAutomationRule"("deletedAt");

-- CreateIndex
CREATE INDEX "OrderAutomationRun_agencyId_idx" ON "OrderAutomationRun"("agencyId");

-- CreateIndex
CREATE INDEX "OrderAutomationRun_storeId_idx" ON "OrderAutomationRun"("storeId");

-- CreateIndex
CREATE INDEX "OrderAutomationRun_orderId_idx" ON "OrderAutomationRun"("orderId");

-- CreateIndex
CREATE INDEX "OrderAutomationRun_createdAt_idx" ON "OrderAutomationRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAutomationRun_ruleId_orderId_key" ON "OrderAutomationRun"("ruleId", "orderId");

-- AddForeignKey
ALTER TABLE "OrderAutomationRun" ADD CONSTRAINT "OrderAutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "OrderAutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
