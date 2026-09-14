-- AlterTable
ALTER TABLE "AccountingCompany" ADD COLUMN     "branchCode" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "periodNo" TEXT;

-- AlterTable
ALTER TABLE "AccountingIntegration" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "agentLeaseUntil" TIMESTAMP(3),
ADD COLUMN     "credentialFingerprint" TEXT,
ADD COLUMN     "credentialSetAt" TIMESTAMP(3),
ADD COLUMN     "credentialSetBy" TEXT,
ADD COLUMN     "exclusiveAgentId" TEXT,
ADD COLUMN     "route" TEXT NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "transportSecurity" TEXT;

-- CreateTable
CREATE TABLE "AgentInstance" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "publicKey" TEXT NOT NULL,
    "certFingerprint" TEXT,
    "agentVersion" TEXT,
    "osVersion" TEXT,
    "protocolVersion" INTEGER,
    "clockSkewSec" INTEGER,
    "lastHeartbeatAt" TIMESTAMP(3),
    "connectedNodeId" TEXT,
    "enrolledAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEnrollmentCode" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "codeHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEnrollmentCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCredentialEnvelope" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCredentialEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "notBefore" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "resultRef" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingSyncCursor" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "cursor" TEXT,
    "lastFullSyncAt" TIMESTAMP(3),
    "lastDeltaAt" TIMESTAMP(3),
    "staleSince" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingSyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingProblem" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "integrationId" TEXT,
    "agentId" TEXT,
    "companyKey" TEXT,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warn',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "detail" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "AccountingProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentInstance_agencyId_idx" ON "AgentInstance"("agencyId");

-- CreateIndex
CREATE INDEX "AgentInstance_status_idx" ON "AgentInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_agencyId_name_key" ON "AgentInstance"("agencyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEnrollmentCode_codeHash_key" ON "AgentEnrollmentCode"("codeHash");

-- CreateIndex
CREATE INDEX "AgentEnrollmentCode_agencyId_idx" ON "AgentEnrollmentCode"("agencyId");

-- CreateIndex
CREATE INDEX "AgentCredentialEnvelope_agentId_idx" ON "AgentCredentialEnvelope"("agentId");

-- CreateIndex
CREATE INDEX "AgentCredentialEnvelope_agencyId_idx" ON "AgentCredentialEnvelope"("agencyId");

-- CreateIndex
CREATE INDEX "AgentJob_agencyId_idx" ON "AgentJob"("agencyId");

-- CreateIndex
CREATE INDEX "AgentJob_agentId_status_idx" ON "AgentJob"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentJob_integrationId_companyKey_status_idx" ON "AgentJob"("integrationId", "companyKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentJob_agentId_idempotencyKey_key" ON "AgentJob"("agentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingSyncCursor_integrationId_companyKey_stream_key" ON "AccountingSyncCursor"("integrationId", "companyKey", "stream");

-- CreateIndex
CREATE INDEX "AccountingProblem_agencyId_idx" ON "AccountingProblem"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingProblem_agencyId_integrationId_code_companyKey_key" ON "AccountingProblem"("agencyId", "integrationId", "code", "companyKey");

-- CreateIndex
CREATE INDEX "AccountingIntegration_exclusiveAgentId_idx" ON "AccountingIntegration"("exclusiveAgentId");

-- CreateIndex
CREATE INDEX "AccountingIntegration_deletedAt_idx" ON "AccountingIntegration"("deletedAt");

