-- CreateTable
CREATE TABLE "CarrierIntegration" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "senderAddress" JSONB,
    "settings" JSONB,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CarrierIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT,
    "carrierIntegrationId" TEXT,
    "provider" TEXT NOT NULL,
    "subCarrier" TEXT,
    "trackingNumber" TEXT,
    "barcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "carrierStatusCode" TEXT,
    "serviceLevel" TEXT,
    "paymentType" TEXT NOT NULL DEFAULT 'sender_pays',
    "codAmount" DECIMAL(12,2),
    "codCurrency" TEXT,
    "totalDesi" DECIMAL(10,2),
    "totalWeightKg" DECIMAL(10,3),
    "chargeableWeightKg" DECIMAL(10,3),
    "priceAmount" DECIMAL(12,2),
    "labelUrl" TEXT,
    "labelFormat" TEXT,
    "referenceCode" TEXT,
    "isTestMode" BOOLEAN NOT NULL DEFAULT false,
    "senderAddress" JSONB,
    "recipientAddress" JSONB,
    "notes" TEXT,
    "handedOverAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "carrierCancelledAt" TIMESTAMP(3),
    "carrierCancelError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentPackage" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "barcode" TEXT,
    "weightKg" DECIMAL(10,3) NOT NULL,
    "lengthCm" DECIMAL(8,2) NOT NULL,
    "widthCm" DECIMAL(8,2) NOT NULL,
    "heightCm" DECIMAL(8,2) NOT NULL,
    "desi" DECIMAL(10,2) NOT NULL,
    "chargeableWeightKg" DECIMAL(10,3) NOT NULL,
    "contentDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentTrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "carrierStatusCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierRule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CarrierRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierWebhookEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureOk" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarrierWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarrierIntegration_publicId_key" ON "CarrierIntegration"("publicId");

-- CreateIndex
CREATE INDEX "CarrierIntegration_agencyId_idx" ON "CarrierIntegration"("agencyId");

-- CreateIndex
CREATE INDEX "CarrierIntegration_storeId_idx" ON "CarrierIntegration"("storeId");

-- CreateIndex
CREATE INDEX "CarrierIntegration_provider_idx" ON "CarrierIntegration"("provider");

-- CreateIndex
CREATE INDEX "CarrierIntegration_deletedAt_idx" ON "CarrierIntegration"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierIntegration_agencyId_storeId_provider_key" ON "CarrierIntegration"("agencyId", "storeId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_publicId_key" ON "Shipment"("publicId");

-- CreateIndex
CREATE INDEX "Shipment_agencyId_idx" ON "Shipment"("agencyId");

-- CreateIndex
CREATE INDEX "Shipment_storeId_idx" ON "Shipment"("storeId");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_agencyId_storeId_orderId_idx" ON "Shipment"("agencyId", "storeId", "orderId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_deletedAt_idx" ON "Shipment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_provider_trackingNumber_key" ON "Shipment"("provider", "trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_agencyId_storeId_referenceCode_key" ON "Shipment"("agencyId", "storeId", "referenceCode");

-- CreateIndex
CREATE INDEX "ShipmentPackage_shipmentId_idx" ON "ShipmentPackage"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentPackage_agencyId_idx" ON "ShipmentPackage"("agencyId");

-- CreateIndex
CREATE INDEX "ShipmentTrackingEvent_shipmentId_idx" ON "ShipmentTrackingEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentTrackingEvent_agencyId_idx" ON "ShipmentTrackingEvent"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentTrackingEvent_shipmentId_carrierStatusCode_occurred_key" ON "ShipmentTrackingEvent"("shipmentId", "carrierStatusCode", "occurredAt");

-- CreateIndex
CREATE INDEX "CarrierRule_agencyId_idx" ON "CarrierRule"("agencyId");

-- CreateIndex
CREATE INDEX "CarrierRule_storeId_idx" ON "CarrierRule"("storeId");

-- CreateIndex
CREATE INDEX "CarrierRule_priority_idx" ON "CarrierRule"("priority");

-- CreateIndex
CREATE INDEX "CarrierRule_deletedAt_idx" ON "CarrierRule"("deletedAt");

-- CreateIndex
CREATE INDEX "CarrierWebhookEvent_provider_idx" ON "CarrierWebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "CarrierWebhookEvent_processedAt_idx" ON "CarrierWebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierWebhookEvent_provider_externalId_key" ON "CarrierWebhookEvent"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_carrierIntegrationId_fkey" FOREIGN KEY ("carrierIntegrationId") REFERENCES "CarrierIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentTrackingEvent" ADD CONSTRAINT "ShipmentTrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

