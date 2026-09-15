-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'BUNDLE', 'VARIANT_PARENT', 'VARIANT_CHILD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "phone" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "taxId" TEXT,
    "fullAddress" TEXT,
    "facebookUrl" TEXT,
    "xUrl" TEXT,
    "linkedinUrl" TEXT,
    "instagramUrl" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "orderProcessingMode" TEXT NOT NULL DEFAULT 'LOGO_SYNC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "type" TEXT NOT NULL DEFAULT 'retail',
    "orderProcessingMode" TEXT NOT NULL DEFAULT 'LOGO_SYNC',
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2),
    "barcode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "weight" DECIMAL(8,3),
    "width" DECIMAL(8,2),
    "height" DECIMAL(8,2),
    "depth" DECIMAL(8,2),
    "image" TEXT,
    "erpCode" TEXT,
    "erpId" TEXT,
    "taxRate" INTEGER NOT NULL DEFAULT 20,
    "publicId" TEXT,
    "locationId" TEXT,
    "locationCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "type" "ProductType" NOT NULL DEFAULT 'SIMPLE',
    "variantAttributes" JSONB,
    "parentId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "defectiveQty" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT NOT NULL,
    "channelId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "marketplaceOrderNumber" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "shippingAddress" TEXT,
    "shippingFullName" TEXT,
    "shippingPhone" TEXT,
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingDistrict" TEXT,
    "shippingCity" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountryCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'unfulfilled',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "isPoolOrder" BOOLEAN NOT NULL DEFAULT false,
    "logoSyncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTimeline" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityDisplayName" TEXT,
    "description" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" TEXT,
    "clientId" TEXT,
    "productId" TEXT,
    "inventoryId" TEXT,
    "orderId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "sourceSystem" TEXT,
    "targetSystem" TEXT,
    "sourceReference" TEXT,
    "targetReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "severity" TEXT NOT NULL DEFAULT 'error',
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "errorStep" TEXT,
    "suggestedAction" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetryCount" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "provider" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentialsEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "publicId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSetting" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "storeId" TEXT,
    "provider" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "values" JSONB NOT NULL DEFAULT '{}',
    "secretsEncrypted" TEXT,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSettingRevision" (
    "id" TEXT NOT NULL,
    "integrationSettingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "diff" JSONB,
    "changedByUserId" TEXT,
    "changedByName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSettingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMapping" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "marketplaceCategoryId" TEXT NOT NULL,
    "marketplaceCategoryName" TEXT NOT NULL,
    "attributesMapping" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "errorMessage" TEXT,
    "marketplaceProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationQueue" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" TEXT NOT NULL,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "storeId" TEXT,
    "integrationId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "requestBody" TEXT,
    "responseBody" TEXT,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreUser" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoreUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WmsPrinterSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "printerName" TEXT NOT NULL,
    "printerType" TEXT NOT NULL,
    "driverName" TEXT,
    "driverVersion" TEXT,
    "driverInstalled" BOOLEAN NOT NULL DEFAULT false,
    "connectionType" TEXT NOT NULL DEFAULT 'USB',
    "labelFormat" TEXT NOT NULL DEFAULT 'PDF',
    "labelSize" TEXT NOT NULL DEFAULT '100x150',
    "lastTestPrintAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsPrinterSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WmsShippingLabel" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "orderId" TEXT,
    "shipmentId" TEXT,
    "carrierName" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "labelFormat" TEXT NOT NULL DEFAULT 'PDF',
    "labelUrl" TEXT,
    "previewUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsShippingLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WmsPrintJob" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "printerName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsPrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WmsStockMovement" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fromWarehouse" TEXT,
    "toWarehouse" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WmsPackagingTask" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "packerName" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsPackagingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDailySales" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "grossSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "returns" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cancellations" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDailySales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDailyOrders" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "shippedOrders" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "returnedOrders" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDailyOrders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsProductPerformance" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantitySold" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "returnsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsProductPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsMarketplacePerformance" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "grossRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "integrationErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsMarketplacePerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "systemName" TEXT NOT NULL DEFAULT 'KroptOS',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "invoiceNumberFormat" TEXT NOT NULL DEFAULT 'INV-{YYYY}-{00000}',
    "orderNumberFormat" TEXT NOT NULL DEFAULT 'ORD-{YYYY}-{00000}',
    "logoUrl" TEXT,
    "themePreference" TEXT NOT NULL DEFAULT 'light',
    "maintenanceModeActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "defaultWarehouseId" TEXT,
    "defaultShippingCarrier" TEXT,
    "defaultAccountingId" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultInvoiceType" TEXT NOT NULL DEFAULT 'e-archive',
    "settings" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT,
    "channels" JSONB NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuritySettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "require2FA" BOOLEAN NOT NULL DEFAULT false,
    "passwordPolicy" TEXT NOT NULL DEFAULT 'standard',
    "minPasswordLength" INTEGER NOT NULL DEFAULT 8,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 120,
    "ipWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "loginAttemptLimit" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecuritySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "responsibleUser" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "logoWarehouseCode" TEXT,
    "erpWarehouseCode" TEXT,
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 5000,
    "usedCapacity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseZone" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "aisle" TEXT,
    "shelf" TEXT,
    "bin" TEXT,
    "level" TEXT,
    "barcode" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pickPriority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSourceSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSourceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAllocationRule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "warehouseId" TEXT,
    "provider" TEXT,
    "storeId" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "productSku" TEXT,
    "minSafetyStock" INTEGER NOT NULL DEFAULT 0,
    "maxAllocatedStock" INTEGER NOT NULL DEFAULT 0,
    "percentAllocation" INTEGER NOT NULL DEFAULT 100,
    "fixedAllocation" INTEGER NOT NULL DEFAULT 0,
    "reserveRatio" INTEGER NOT NULL DEFAULT 0,
    "deactivateOnCritical" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseIfZero" BOOLEAN NOT NULL DEFAULT true,
    "allocationType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAllocationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceStockRule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "syncActive" BOOLEAN NOT NULL DEFAULT true,
    "maxAllocatedStock" INTEGER NOT NULL DEFAULT 0,
    "minStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "syncPeriodMinutes" INTEGER NOT NULL DEFAULT 15,
    "deactivateIfZero" BOOLEAN NOT NULL DEFAULT true,
    "retryFailed" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceStockRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpStockSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "connectionType" TEXT NOT NULL,
    "companyNo" TEXT,
    "periodNo" TEXT,
    "erpDepotCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "erpStockCardField" TEXT NOT NULL DEFAULT 'CODE',
    "erpBarcodeField" TEXT NOT NULL DEFAULT 'BARCODE',
    "variantTracking" BOOLEAN NOT NULL DEFAULT false,
    "lotTracking" BOOLEAN NOT NULL DEFAULT false,
    "syncPeriodMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "syncDirection" TEXT NOT NULL DEFAULT 'READ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpStockSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogoWarehouseMapping" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "erpDepotCode" TEXT NOT NULL,
    "erpDepotName" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogoWarehouseMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogoProductMapping" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "barcode" TEXT,
    "productName" TEXT,
    "erpStockCode" TEXT NOT NULL,
    "erpStockName" TEXT,
    "erpUnit" TEXT,
    "variantCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'matched',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogoProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT,
    "type" TEXT NOT NULL,
    "previousQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "user" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "availableQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL,
    "bundleProductId" TEXT NOT NULL,
    "childProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "discountRate" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossSellProduct" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossSellProduct_pkey" PRIMARY KEY ("id")
);

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
    "route" TEXT NOT NULL DEFAULT 'DIRECT',
    "agentId" TEXT,
    "exclusiveAgentId" TEXT,
    "agentLeaseUntil" TIMESTAMP(3),
    "transportSecurity" TEXT,
    "maxSessions" INTEGER NOT NULL DEFAULT 1,
    "credentialSetAt" TIMESTAMP(3),
    "credentialSetBy" TEXT,
    "credentialFingerprint" TEXT,
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
    "defaultRetailContactId" TEXT,
    "invoiceSeries" TEXT,
    "defaultAccountCodes" JSONB,
    "postingDefaults" JSONB,
    "periodNo" TEXT,
    "branchCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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

-- CreateTable
CREATE TABLE "AgentInstance" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "publicKey" TEXT NOT NULL,
    "tunnelSecret" TEXT,
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

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_publicId_key" ON "Agency"("publicId");

-- CreateIndex
CREATE INDEX "Agency_deletedAt_idx" ON "Agency"("deletedAt");

-- CreateIndex
CREATE INDEX "Client_agencyId_idx" ON "Client"("agencyId");

-- CreateIndex
CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Store_publicId_key" ON "Store"("publicId");

-- CreateIndex
CREATE INDEX "Store_agencyId_idx" ON "Store"("agencyId");

-- CreateIndex
CREATE INDEX "Store_clientId_idx" ON "Store"("clientId");

-- CreateIndex
CREATE INDEX "Store_deletedAt_idx" ON "Store"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_agencyId_idx" ON "UserRole"("agencyId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "UserRole_deletedAt_idx" ON "UserRole"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_agencyId_roleId_key" ON "UserRole"("userId", "agencyId", "roleId");

-- CreateIndex
CREATE INDEX "Category_agencyId_idx" ON "Category"("agencyId");

-- CreateIndex
CREATE INDEX "Category_clientId_idx" ON "Category"("clientId");

-- CreateIndex
CREATE INDEX "Category_storeId_idx" ON "Category"("storeId");

-- CreateIndex
CREATE INDEX "Category_slug_idx" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_deletedAt_idx" ON "Category"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_publicId_key" ON "Product"("publicId");

-- CreateIndex
CREATE INDEX "Product_agencyId_idx" ON "Product"("agencyId");

-- CreateIndex
CREATE INDEX "Product_clientId_idx" ON "Product"("clientId");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_storeId_sku_key" ON "Product"("storeId", "sku");

-- CreateIndex
CREATE INDEX "Inventory_agencyId_idx" ON "Inventory"("agencyId");

-- CreateIndex
CREATE INDEX "Inventory_storeId_idx" ON "Inventory"("storeId");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_storeId_productId_key" ON "Inventory"("storeId", "productId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_inventoryId_idx" ON "InventoryAdjustment"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicId_key" ON "Order"("publicId");

-- CreateIndex
CREATE INDEX "Order_agencyId_idx" ON "Order"("agencyId");

-- CreateIndex
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_deletedAt_idx" ON "Order"("deletedAt");

-- CreateIndex
CREATE INDEX "Order_storeId_marketplaceOrderNumber_idx" ON "Order"("storeId", "marketplaceOrderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_storeId_idempotencyKey_key" ON "Order"("storeId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_storeId_orderNumber_key" ON "Order"("storeId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderTimeline_orderId_idx" ON "OrderTimeline"("orderId");

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_idx" ON "AuditLog"("agencyId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_tenantId_idx" ON "IntegrationLog"("tenantId");

-- CreateIndex
CREATE INDEX "IntegrationLog_provider_idx" ON "IntegrationLog"("provider");

-- CreateIndex
CREATE INDEX "IntegrationLog_status_idx" ON "IntegrationLog"("status");

-- CreateIndex
CREATE INDEX "IntegrationLog_entityType_entityId_idx" ON "IntegrationLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_publicId_key" ON "Integration"("publicId");

-- CreateIndex
CREATE INDEX "Integration_agencyId_idx" ON "Integration"("agencyId");

-- CreateIndex
CREATE INDEX "Integration_clientId_idx" ON "Integration"("clientId");

-- CreateIndex
CREATE INDEX "Integration_storeId_idx" ON "Integration"("storeId");

-- CreateIndex
CREATE INDEX "Integration_providerType_idx" ON "Integration"("providerType");

-- CreateIndex
CREATE INDEX "Integration_deletedAt_idx" ON "Integration"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetting_integrationId_key" ON "IntegrationSetting"("integrationId");

-- CreateIndex
CREATE INDEX "IntegrationSetting_agencyId_idx" ON "IntegrationSetting"("agencyId");

-- CreateIndex
CREATE INDEX "IntegrationSetting_clientId_idx" ON "IntegrationSetting"("clientId");

-- CreateIndex
CREATE INDEX "IntegrationSetting_storeId_idx" ON "IntegrationSetting"("storeId");

-- CreateIndex
CREATE INDEX "IntegrationSetting_provider_idx" ON "IntegrationSetting"("provider");

-- CreateIndex
CREATE INDEX "IntegrationSetting_deletedAt_idx" ON "IntegrationSetting"("deletedAt");

-- CreateIndex
CREATE INDEX "IntegrationSettingRevision_integrationSettingId_idx" ON "IntegrationSettingRevision"("integrationSettingId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSettingRevision_integrationSettingId_version_key" ON "IntegrationSettingRevision"("integrationSettingId", "version");

-- CreateIndex
CREATE INDEX "ProductMapping_productId_idx" ON "ProductMapping"("productId");

-- CreateIndex
CREATE INDEX "ProductMapping_integrationId_idx" ON "ProductMapping"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMapping_productId_integrationId_key" ON "ProductMapping"("productId", "integrationId");

-- CreateIndex
CREATE INDEX "IntegrationQueue_configId_idx" ON "IntegrationQueue"("configId");

-- CreateIndex
CREATE INDEX "IntegrationQueue_status_idx" ON "IntegrationQueue"("status");

-- CreateIndex
CREATE INDEX "IntegrationQueue_eventType_idx" ON "IntegrationQueue"("eventType");

-- CreateIndex
CREATE INDEX "ApiLog_agencyId_idx" ON "ApiLog"("agencyId");

-- CreateIndex
CREATE INDEX "ApiLog_integrationId_idx" ON "ApiLog"("integrationId");

-- CreateIndex
CREATE INDEX "WebhookSubscription_agencyId_idx" ON "WebhookSubscription"("agencyId");

-- CreateIndex
CREATE INDEX "WebhookSubscription_eventType_idx" ON "WebhookSubscription"("eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_subscriptionId_idx" ON "WebhookEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "StoreUser_userId_idx" ON "StoreUser"("userId");

-- CreateIndex
CREATE INDEX "StoreUser_storeId_idx" ON "StoreUser"("storeId");

-- CreateIndex
CREATE INDEX "StoreUser_deletedAt_idx" ON "StoreUser"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreUser_userId_storeId_key" ON "StoreUser"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "WmsPrinterSettings_agencyId_idx" ON "WmsPrinterSettings"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "WmsShippingLabel_publicId_key" ON "WmsShippingLabel"("publicId");

-- CreateIndex
CREATE INDEX "WmsShippingLabel_agencyId_idx" ON "WmsShippingLabel"("agencyId");

-- CreateIndex
CREATE INDEX "WmsShippingLabel_shipmentId_idx" ON "WmsShippingLabel"("shipmentId");

-- CreateIndex
CREATE INDEX "WmsPrintJob_agencyId_idx" ON "WmsPrintJob"("agencyId");

-- CreateIndex
CREATE INDEX "WmsStockMovement_agencyId_idx" ON "WmsStockMovement"("agencyId");

-- CreateIndex
CREATE INDEX "WmsStockMovement_productId_idx" ON "WmsStockMovement"("productId");

-- CreateIndex
CREATE INDEX "WmsPackagingTask_agencyId_idx" ON "WmsPackagingTask"("agencyId");

-- CreateIndex
CREATE INDEX "WmsPackagingTask_orderId_idx" ON "WmsPackagingTask"("orderId");

-- CreateIndex
CREATE INDEX "AnalyticsDailySales_agencyId_idx" ON "AnalyticsDailySales"("agencyId");

-- CreateIndex
CREATE INDEX "AnalyticsDailySales_date_idx" ON "AnalyticsDailySales"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDailySales_agencyId_date_key" ON "AnalyticsDailySales"("agencyId", "date");

-- CreateIndex
CREATE INDEX "AnalyticsDailyOrders_agencyId_idx" ON "AnalyticsDailyOrders"("agencyId");

-- CreateIndex
CREATE INDEX "AnalyticsDailyOrders_date_idx" ON "AnalyticsDailyOrders"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDailyOrders_agencyId_date_key" ON "AnalyticsDailyOrders"("agencyId", "date");

-- CreateIndex
CREATE INDEX "AnalyticsProductPerformance_agencyId_idx" ON "AnalyticsProductPerformance"("agencyId");

-- CreateIndex
CREATE INDEX "AnalyticsProductPerformance_date_idx" ON "AnalyticsProductPerformance"("date");

-- CreateIndex
CREATE INDEX "AnalyticsProductPerformance_productId_idx" ON "AnalyticsProductPerformance"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsProductPerformance_agencyId_date_productId_key" ON "AnalyticsProductPerformance"("agencyId", "date", "productId");

-- CreateIndex
CREATE INDEX "AnalyticsMarketplacePerformance_agencyId_idx" ON "AnalyticsMarketplacePerformance"("agencyId");

-- CreateIndex
CREATE INDEX "AnalyticsMarketplacePerformance_date_idx" ON "AnalyticsMarketplacePerformance"("date");

-- CreateIndex
CREATE INDEX "AnalyticsMarketplacePerformance_provider_idx" ON "AnalyticsMarketplacePerformance"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsMarketplacePerformance_agencyId_date_provider_key" ON "AnalyticsMarketplacePerformance"("agencyId", "date", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_agencyId_key" ON "TenantSettings"("agencyId");

-- CreateIndex
CREATE INDEX "TenantSettings_agencyId_idx" ON "TenantSettings"("agencyId");

-- CreateIndex
CREATE INDEX "IntegrationSettings_agencyId_idx" ON "IntegrationSettings"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSettings_agencyId_provider_key" ON "IntegrationSettings"("agencyId", "provider");

-- CreateIndex
CREATE INDEX "NotificationSettings_agencyId_idx" ON "NotificationSettings"("agencyId");

-- CreateIndex
CREATE INDEX "NotificationSettings_userId_idx" ON "NotificationSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SecuritySettings_agencyId_key" ON "SecuritySettings"("agencyId");

-- CreateIndex
CREATE INDEX "SecuritySettings_agencyId_idx" ON "SecuritySettings"("agencyId");

-- CreateIndex
CREATE INDEX "ApiKey_agencyId_idx" ON "ApiKey"("agencyId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_publicId_key" ON "Warehouse"("publicId");

-- CreateIndex
CREATE INDEX "Warehouse_agencyId_idx" ON "Warehouse"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_agencyId_code_key" ON "Warehouse"("agencyId", "code");

-- CreateIndex
CREATE INDEX "WarehouseZone_warehouseId_idx" ON "WarehouseZone"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseZone_warehouseId_code_key" ON "WarehouseZone"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "WarehouseLocation_warehouseId_idx" ON "WarehouseLocation"("warehouseId");

-- CreateIndex
CREATE INDEX "WarehouseLocation_zoneId_idx" ON "WarehouseLocation"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_warehouseId_code_key" ON "WarehouseLocation"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StockSourceSettings_agencyId_key" ON "StockSourceSettings"("agencyId");

-- CreateIndex
CREATE INDEX "StockSourceSettings_agencyId_idx" ON "StockSourceSettings"("agencyId");

-- CreateIndex
CREATE INDEX "StockAllocationRule_agencyId_idx" ON "StockAllocationRule"("agencyId");

-- CreateIndex
CREATE INDEX "MarketplaceStockRule_agencyId_idx" ON "MarketplaceStockRule"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceStockRule_agencyId_provider_key" ON "MarketplaceStockRule"("agencyId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ErpStockSettings_agencyId_key" ON "ErpStockSettings"("agencyId");

-- CreateIndex
CREATE INDEX "ErpStockSettings_agencyId_idx" ON "ErpStockSettings"("agencyId");

-- CreateIndex
CREATE INDEX "LogoWarehouseMapping_agencyId_idx" ON "LogoWarehouseMapping"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "LogoWarehouseMapping_agencyId_warehouseId_erpDepotCode_key" ON "LogoWarehouseMapping"("agencyId", "warehouseId", "erpDepotCode");

-- CreateIndex
CREATE INDEX "LogoProductMapping_agencyId_idx" ON "LogoProductMapping"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "LogoProductMapping_agencyId_productSku_key" ON "LogoProductMapping"("agencyId", "productSku");

-- CreateIndex
CREATE INDEX "StockMovement_agencyId_idx" ON "StockMovement"("agencyId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");

-- CreateIndex
CREATE INDEX "StockReservation_agencyId_idx" ON "StockReservation"("agencyId");

-- CreateIndex
CREATE INDEX "StockReservation_productId_idx" ON "StockReservation"("productId");

-- CreateIndex
CREATE INDEX "StockReservation_warehouseId_idx" ON "StockReservation"("warehouseId");

-- CreateIndex
CREATE INDEX "InventorySnapshot_agencyId_idx" ON "InventorySnapshot"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySnapshot_agencyId_date_productId_warehouseId_key" ON "InventorySnapshot"("agencyId", "date", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "BundleItem_bundleProductId_idx" ON "BundleItem"("bundleProductId");

-- CreateIndex
CREATE INDEX "BundleItem_childProductId_idx" ON "BundleItem"("childProductId");

-- CreateIndex
CREATE INDEX "CrossSellProduct_sourceProductId_idx" ON "CrossSellProduct"("sourceProductId");

-- CreateIndex
CREATE INDEX "CrossSellProduct_targetProductId_idx" ON "CrossSellProduct"("targetProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CrossSellProduct_sourceProductId_targetProductId_key" ON "CrossSellProduct"("sourceProductId", "targetProductId");

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

-- CreateIndex
CREATE UNIQUE INDEX "AccountingIntegration_publicId_key" ON "AccountingIntegration"("publicId");

-- CreateIndex
CREATE INDEX "AccountingIntegration_agencyId_idx" ON "AccountingIntegration"("agencyId");

-- CreateIndex
CREATE INDEX "AccountingIntegration_storeId_idx" ON "AccountingIntegration"("storeId");

-- CreateIndex
CREATE INDEX "AccountingIntegration_exclusiveAgentId_idx" ON "AccountingIntegration"("exclusiveAgentId");

-- CreateIndex
CREATE INDEX "AccountingIntegration_deletedAt_idx" ON "AccountingIntegration"("deletedAt");

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
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeline" ADD CONSTRAINT "OrderTimeline_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetting" ADD CONSTRAINT "IntegrationSetting_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSettingRevision" ADD CONSTRAINT "IntegrationSettingRevision_integrationSettingId_fkey" FOREIGN KEY ("integrationSettingId") REFERENCES "IntegrationSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationQueue" ADD CONSTRAINT "IntegrationQueue_configId_fkey" FOREIGN KEY ("configId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiLog" ADD CONSTRAINT "ApiLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreUser" ADD CONSTRAINT "StoreUser_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreUser" ADD CONSTRAINT "StoreUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreUser" ADD CONSTRAINT "StoreUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsPrinterSettings" ADD CONSTRAINT "WmsPrinterSettings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsShippingLabel" ADD CONSTRAINT "WmsShippingLabel_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsShippingLabel" ADD CONSTRAINT "WmsShippingLabel_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsPrintJob" ADD CONSTRAINT "WmsPrintJob_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsStockMovement" ADD CONSTRAINT "WmsStockMovement_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsStockMovement" ADD CONSTRAINT "WmsStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsPackagingTask" ADD CONSTRAINT "WmsPackagingTask_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsPackagingTask" ADD CONSTRAINT "WmsPackagingTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleProductId_fkey" FOREIGN KEY ("bundleProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_childProductId_fkey" FOREIGN KEY ("childProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellProduct" ADD CONSTRAINT "CrossSellProduct_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellProduct" ADD CONSTRAINT "CrossSellProduct_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_carrierIntegrationId_fkey" FOREIGN KEY ("carrierIntegrationId") REFERENCES "CarrierIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentTrackingEvent" ADD CONSTRAINT "ShipmentTrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingCompany" ADD CONSTRAINT "AccountingCompany_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "AccountingIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

