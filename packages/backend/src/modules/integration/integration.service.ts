import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integration.dto';
import { encrypt, decrypt } from '../../common/utils/encryption.util';
import { MarketplaceCredentialService } from '../../integrations/marketplaces/core/MarketplaceCredentialService';
import { MarketplaceConnectorFactory } from '../../integrations/marketplaces/core/MarketplaceConnectorFactory';
import { IntegrationQueueService } from './integration-queue.service';

@Injectable()
export class IntegrationService {
  constructor(
    private prisma: PrismaService,
    private credentialService: MarketplaceCredentialService,
    private connectorFactory: MarketplaceConnectorFactory,
    private queueService: IntegrationQueueService,
  ) {}

  private async writeAuditLog(
    tx: any,
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
          performedBy,
          agencyId,
          ipAddress: ipAddress || null,
          changes: JSON.stringify(changes),
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
    });
  }

  async get(
    id: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, deletedAt: null },
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID '${id}' not found or soft-deleted`);
    }

    if (!isSuperAdmin) {
      if (activeAgencyId && integration.agencyId !== activeAgencyId) {
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

    const credentialsEncrypted = encrypt(JSON.stringify(dto.credentials));

    return this.prisma.$transaction(async (tx) => {
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
      // Decrypt old keys, merge new keys, re-encrypt
      try {
        const oldCreds = JSON.parse(decrypt(integration.credentialsEncrypted));
        const mergedCreds = { ...oldCreds, ...dto.credentials };
        credentialsEncrypted = encrypt(JSON.stringify(mergedCreds));
      } catch (err) {
        credentialsEncrypted = encrypt(JSON.stringify(dto.credentials));
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedIntegration = await tx.integration.update({
        where: { id },
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

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const deletedIntegration = await tx.integration.update({
        where: { id },
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
      } else {
        // Fallback for non-marketplace integrations (e.g. ERP, payment, cargo)
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

    // Create sync_products and sync_orders jobs
    const productsJob = await this.queueService.addSyncJob(id, 'sync_products', {});
    const ordersJob = await this.queueService.addSyncJob(id, 'sync_orders', {});

    return {
      success: true,
      message: 'Senkronizasyon görevleri arka plan işleme kuyruğuna başarıyla eklendi',
      jobs: [productsJob.id, ordersJob.id],
    };
  }
}
