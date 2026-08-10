import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integration.dto';
import { Prisma } from '@prisma/client';
import { encrypt, decrypt } from '../../common/utils/encryption.util';
import { stripMaskedCredentials } from '@kroptos/shared';
import { MarketplaceCredentialService } from '../../integrations/marketplaces/core/MarketplaceCredentialService';
import { MarketplaceConnectorFactory } from '../../integrations/marketplaces/core/MarketplaceConnectorFactory';
import { IntegrationQueueService } from './integration-queue.service';
import { generatePublicId } from '../../common/utils/id-generator';
import { ErpConnectorFactory } from '../../integrations/erp/core/ErpConnectorFactory';
import { IntegrationSettingsService } from '../integration-settings/integration-settings.service';

@Injectable()
export class IntegrationService {
  constructor(
    private prisma: PrismaService,
    private credentialService: MarketplaceCredentialService,
    private connectorFactory: MarketplaceConnectorFactory,
    private erpConnectorFactory: ErpConnectorFactory,
    private queueService: IntegrationQueueService,
    @Inject(forwardRef(() => IntegrationSettingsService))
    private settingsService: IntegrationSettingsService,
  ) {}

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    performedBy: string,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await tx.auditLog.create({
        data: {
          action,
          entityType: 'Integration',
          entityId,
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in IntegrationService:', error);
    }
  }

  async list(
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const whereClause: any = { deletedAt: null };

    if (!isSuperAdmin) {
      if (activeStoreId) {
        whereClause.OR = [
          { storeId: activeStoreId },
          { storeId: null, clientId: activeClientId || null, agencyId: activeAgencyId },
          { storeId: null, clientId: null, agencyId: activeAgencyId },
        ];
      } else if (activeClientId) {
        whereClause.OR = [
          { clientId: activeClientId },
          { clientId: null, agencyId: activeAgencyId },
        ];
      } else if (activeAgencyId) {
        whereClause.agencyId = activeAgencyId;
      } else {
        throw new BadRequestException('Active tenant context is required (x-agency-id header)');
      }
    }

    return this.prisma.integration.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        // The list needs each row's configuration state to show the badge and
        // to disable sync; pulling it here avoids a settings request per row.
        setting: {
          select: { isConfigured: true, completedSteps: true, deletedAt: true },
        },
        // The row shows which store an integration belongs to; storeId is null
        // for agency-wide integrations, so the relation may come back null.
        store: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async get(
    id: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    if (!activeAgencyId && !isSuperAdmin) {
      throw new BadRequestException('Active agency context is required (x-agency-id header)');
    }

    const integration = await this.prisma.integration.findFirst({
      where: {
        OR: [
          { id },
          { publicId: id },
        ],
        deletedAt: null,
      },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID '${id}' not found or soft-deleted`);
    }

    if (!isSuperAdmin) {
      if (integration.agencyId !== activeAgencyId) {
        throw new ForbiddenException('Access denied. Integration belongs to a different agency.');
      }
      // If scoped to store or client specifically
      if (integration.storeId && activeStoreId && integration.storeId !== activeStoreId) {
        throw new ForbiddenException('Access denied. Integration belongs to a different store.');
      }
      if (integration.clientId && activeClientId && integration.clientId !== activeClientId) {
        throw new ForbiddenException('Access denied. Integration belongs to a different client.');
      }
    }

    return integration;
  }

  async create(
    dto: CreateIntegrationDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    ipAddress?: string,
  ) {
    const agencyId = dto.agencyId || activeAgencyId;
    const clientId = dto.clientId || activeClientId || null;
    const storeId = dto.storeId || activeStoreId || null;

    if (!agencyId) {
      throw new BadRequestException('Agency ID context is required');
    }

    // A create has no stored secret to fall back on, so a masked or blank secret
    // can only be a client bug — reject it rather than persisting an empty one.
    const { credentials: newCredentials, placeholders } = stripMaskedCredentials(dto.credentials);
    if (placeholders.length > 0) {
      throw new BadRequestException(
        `Credentials must carry a real value, not a masked or blank placeholder: ${placeholders.join(', ')}`,
      );
    }

    const credentialsEncrypted = encrypt(JSON.stringify(newCredentials));

    const integration = await this.prisma.$transaction(async (tx) => {
      const integration = await tx.integration.create({
        data: {
          agencyId,
          clientId,
          storeId,
          provider: dto.provider,
          providerType: dto.providerType,
          name: dto.name,
          credentialsEncrypted,
          status: 'active',
          publicId: generatePublicId('int', 12),
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        integration.id,
        userId,
        agencyId,
        ipAddress,
        { provider: integration.provider, providerType: integration.providerType, name: integration.name },
      );

      return integration;
    });

    // Opens the settings record straight away, so the integration reports
    // "awaiting configuration" from creation instead of looking ready until
    // someone opens the settings drawer for the first time.
    await this.settingsService.ensureForIntegration(integration);

    return integration;
  }

  async update(
    id: string,
    dto: UpdateIntegrationDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    ipAddress?: string,
  ) {
    const integration = await this.get(id, activeAgencyId, activeClientId, activeStoreId);

    let credentialsEncrypted = integration.credentialsEncrypted;
    if (dto.credentials) {
      // Values the client echoed back masked carry no new secret; dropping them
      // here lets the merge below keep the stored value instead of overwriting
      // the real credential with a string of bullets.
      const { credentials: incomingCreds } = stripMaskedCredentials(dto.credentials);

      // Decrypt old keys, merge new keys, re-encrypt
      try {
        const oldCreds = JSON.parse(decrypt(integration.credentialsEncrypted));
        const mergedCreds = { ...oldCreds, ...incomingCreds };
        credentialsEncrypted = encrypt(JSON.stringify(mergedCreds));
      } catch (err) {
        credentialsEncrypted = encrypt(JSON.stringify(incomingCreds));
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedIntegration = await tx.integration.update({
        where: { id: integration.id },
        data: {
          name: dto.name || undefined,
          status: dto.status || undefined,
          credentialsEncrypted,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update',
        id,
        userId,
        integration.agencyId,
        ipAddress,
        {
          before: { name: integration.name, status: integration.status },
          after: { name: updatedIntegration.name, status: updatedIntegration.status },
        },
      );

      return updatedIntegration;
    });
  }

  async delete(
    id: string,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    ipAddress?: string,
  ) {
    const integration = await this.get(id, activeAgencyId, activeClientId, activeStoreId);

    await this.settingsService.softDeleteForIntegration(integration.id);

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const deletedIntegration = await tx.integration.update({
        where: { id: integration.id },
        data: {
          deletedAt: now,
          status: 'inactive',
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'delete',
        id,
        userId,
        integration.agencyId,
        ipAddress,
        { name: integration.name, deletedAt: now },
      );

      return deletedIntegration;
    });
  }

  async testConnection(
    id: string,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const integration = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    const startTime = Date.now();
    let success = true;
    let message = 'Connection test passed successfully';

    try {
      if (integration.providerType === 'marketplace') {
        // 1. Decrypt raw credentials and validate structure
        const creds = this.credentialService.decrypt(integration.credentialsEncrypted);
        this.credentialService.validate(integration.provider, creds);

        // 2. Create the connector and run the connector's own connection test
        const connector = this.connectorFactory.create(integration.provider, creds);
        const testResult = await connector.testConnection();
        success = testResult.success;
        message = testResult.message;
      } else if (integration.providerType === 'erp') {
        const creds = JSON.parse(decrypt(integration.credentialsEncrypted));
        const connector = this.erpConnectorFactory.create(integration.provider, creds);
        const testResult = await connector.testConnection();
        success = testResult.success;
        message = testResult.message;
      } else {
        // Fallback for non-marketplace integrations (e.g. payment, cargo)
        const creds = JSON.parse(decrypt(integration.credentialsEncrypted));
        const checkKeys = Object.values(creds);
        const containsInvalid = checkKeys.some((val: any) => typeof val === 'string' && val.toLowerCase().includes('invalid'));

        if (containsInvalid) {
          success = false;
          message = 'Invalid connection parameters or unauthorized secret credentials provided';
        }
      }
    } catch (err: any) {
      success = false;
      message = err.message || 'An unexpected error occurred during the connection test.';
    }

    const durationMs = Date.now() - startTime;
    const statusCode = success ? 200 : 400;

    // 2. Write details inside ApiLog
    await this.prisma.apiLog.create({
      data: {
        agencyId: integration.agencyId,
        storeId: integration.storeId || activeStoreId || null,
        integrationId: id,
        endpoint: `/api/integrations/${id}/test-connection`,
        method: 'POST',
        requestBody: '[Redacted API Keys]',
        responseBody: JSON.stringify({ success, message, durationMs }),
        statusCode,
        durationMs,
        errorMessage: success ? null : message,
      },
    });

    // 3. Update status of the integration based on outcome
    const targetStatus = success ? 'active' : 'error';
    if (integration.status !== targetStatus) {
      await this.prisma.integration.update({
        where: { id },
        data: { status: targetStatus },
      });
    }

    return { success, message, durationMs };
  }

  async triggerSync(
    id: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
  ) {
    const integration = await this.get(id, activeAgencyId, activeClientId, activeStoreId);

    // A paused integration must stay paused: the status switch is the user's
    // explicit "do not talk to this marketplace", so it gates the manual button
    // too, not only the scheduled runs.
    if (integration.status === 'inactive') {
      throw new BadRequestException(
        'Pasif entegrasyon senkronize edilemez. Önce entegrasyonu aktifleştirin.',
      );
    }

    // The UI disables this button for an unconfigured integration, but the UI
    // is not the boundary: syncing without a stock source or price rule would
    // push wrong quantities and prices to a live marketplace.
    if (integration.providerType === 'marketplace') {
      await this.settingsService.assertConfigured(integration.id, integration.provider);
    }

    // Create sync_products and sync_orders jobs
    const productsJob = await this.queueService.addSyncJob(integration.id, 'sync_products', {});
    const ordersJob = await this.queueService.addSyncJob(integration.id, 'sync_orders', {});

    return {
      success: true,
      message: 'Senkronizasyon görevleri arka plan işleme kuyruğuna başarıyla eklendi',
      jobs: [productsJob.id, ordersJob.id],
    };
  }

  // ==================== Category & Attributes Mapping ====================

  async getTrendyolCategories(
    integrationId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const integration = await this.get(
      integrationId,
      activeAgencyId,
      activeClientId,
      activeStoreId,
      isSuperAdmin,
    );

    const credentials = this.credentialService.decrypt(integration.credentialsEncrypted);
    this.credentialService.validate(integration.provider, credentials);
    const connector = this.connectorFactory.create(integration.provider, credentials);

    return connector.getCategories();
  }

  async getTrendyolCategoryAttributes(
    integrationId: string,
    categoryId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const integration = await this.get(
      integrationId,
      activeAgencyId,
      activeClientId,
      activeStoreId,
      isSuperAdmin,
    );

    const credentials = this.credentialService.decrypt(integration.credentialsEncrypted);
    this.credentialService.validate(integration.provider, credentials);
    const connector = this.connectorFactory.create(integration.provider, credentials);

    return connector.getCategoryAttributes(categoryId);
  }

  async getProductMappings(
    productId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    return this.prisma.productMapping.findMany({
      where: {
        productId,
      },
      include: {
        integration: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async upsertProductMapping(
    productId: string,
    integrationId: string,
    marketplaceCategoryId: string,
    marketplaceCategoryName: string,
    attributesMapping: any,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    // Validate integration access
    await this.get(
      integrationId,
      activeAgencyId,
      activeClientId,
      activeStoreId,
      isSuperAdmin,
    );

    // Verify local product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${productId}' not found`);
    }

    return this.prisma.productMapping.upsert({
      where: {
        productId_integrationId: {
          productId,
          integrationId,
        },
      },
      update: {
        marketplaceCategoryId,
        marketplaceCategoryName,
        attributesMapping,
        status: 'draft',
      },
      create: {
        productId,
        integrationId,
        marketplaceCategoryId,
        marketplaceCategoryName,
        attributesMapping,
        status: 'draft',
      },
      include: {
        integration: true,
      },
    });
  }

  async deleteProductMapping(
    productId: string,
    mappingId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const mapping = await this.prisma.productMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping || mapping.productId !== productId) {
      throw new NotFoundException(`Product mapping with ID '${mappingId}' not found for this product`);
    }

    // Validate integration access
    await this.get(
      mapping.integrationId,
      activeAgencyId,
      activeClientId,
      activeStoreId,
      isSuperAdmin,
    );

    return this.prisma.productMapping.delete({
      where: { id: mappingId },
    });
  }
}
