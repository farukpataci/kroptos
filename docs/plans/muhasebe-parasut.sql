-- KroptOS Paraşüt Muhasebe Entegrasyonu (Faz 1) DDL
-- Generated via prisma migrate diff

-- CreateTable
CREATE TABLE "AccountingIntegration" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "readiness" TEXT NOT NULL DEFAULT 'SCAFFOLDED',
    "credentials" TEXT,
    "scopeKey" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AccountingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingCompany" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalCompanyId" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "invoiceSeries" TEXT,
    "defaultAccountCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AccountingCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingDocument" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "externalNumber" TEXT,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingContactMapping" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kroptosKey" TEXT NOT NULL,
    "externalContactId" TEXT NOT NULL,
    "displayName" TEXT,
    "taxNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'matched',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingContactMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingProductMapping" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalCode" TEXT,
    "externalName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'matched',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingIntegration_publicId_key" ON "AccountingIntegration"("publicId");

-- CreateIndex
CREATE INDEX "AccountingIntegration_agencyId_idx" ON "AccountingIntegration"("agencyId");

-- CreateIndex
CREATE INDEX "AccountingIntegration_storeId_idx" ON "AccountingIntegration"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingIntegration_provider_scopeKey_key" ON "AccountingIntegration"("provider", "scopeKey");

-- CreateIndex
CREATE INDEX "AccountingCompany_agencyId_idx" ON "AccountingCompany"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingCompany_integrationId_externalCompanyId_key" ON "AccountingCompany"("integrationId", "externalCompanyId");

-- CreateIndex
CREATE INDEX "AccountingDocument_agencyId_idx" ON "AccountingDocument"("agencyId");

-- CreateIndex
CREATE INDEX "AccountingDocument_status_idx" ON "AccountingDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_agencyId_storeId_type_referenceCode_key" ON "AccountingDocument"("agencyId", "storeId", "type", "referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_integrationId_type_externalId_key" ON "AccountingDocument"("integrationId", "type", "externalId");

-- CreateIndex
CREATE INDEX "AccountingContactMapping_agencyId_idx" ON "AccountingContactMapping"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingContactMapping_companyId_kroptosKey_key" ON "AccountingContactMapping"("companyId", "kroptosKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingContactMapping_companyId_externalContactId_key" ON "AccountingContactMapping"("companyId", "externalContactId");

-- CreateIndex
CREATE INDEX "AccountingProductMapping_agencyId_idx" ON "AccountingProductMapping"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingProductMapping_companyId_productSku_key" ON "AccountingProductMapping"("companyId", "productSku");

-- AddForeignKey
ALTER TABLE "AccountingCompany" ADD CONSTRAINT "AccountingCompany_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "AccountingIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
