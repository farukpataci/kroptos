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
import { TrendyolBaseConnector } from '../../integrations/marketplaces/trendyol/TrendyolBaseConnector';
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

    const rows = await this.prisma.integration.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        // The list needs each row's configuration state to show the badge and
        // to disable sync; pulling it here avoids a settings request per row.
        // `values` comes along only to resolve the run mode and is dropped
        // again below — the list has no business shipping the whole settings map.
        setting: {
          select: { isConfigured: true, completedSteps: true, deletedAt: true, values: true },
        },
        // The row shows which store an integration belongs to; storeId is null
        // for agency-wide integrations, so the relation may come back null.
        store: {
          select: { id: true, name: true },
        },
      },
    });

    return rows.map((row) => {
      const stored = (row.setting?.values ?? {}) as Record<string, unknown>;
      const mode = this.resolveMode(row.provider, row.providerType, stored);

      if (!row.setting) return { ...row, ...mode };

      const { values, ...setting } = row.setting;
      return { ...row, setting, ...mode };
    });
  }

  /**
   * The run mode for a list row, resolved without decrypting anything: a
   * connector constructed with no credentials still answers `connectionMode`
   * from the settings, the environment and its own default. Asking the connector
   * rather than re-deriving the rule here is what stops the badge from claiming
   * one mode while the sync runs in another.
   */
  private resolveMode(
    provider: string,
    providerType: string,
    values: Record<string, unknown>,
  ): { mode?: string; modeSource?: string } {
    if (providerType !== 'marketplace') return {};

    try {
      const { mode, source } = this.connectorFactory.create(provider, {}, values).connectionMode;
      return { mode, modeSource: source };
    } catch {
      // An unsupported provider has no connector to ask; the row simply carries
      // no mode rather than failing the whole list.
      return {};
    }
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

  /**
   * Decrypts, validates and builds a marketplace connector with the
   * integration's resolved settings.
   *
   * The settings are not optional decoration: `general.environment` picks the
   * host, so a connector built without them talks to production even when the
   * seller selected sandbox. Resolution falls back to `{}` for providers that
   * have no settings manifest — the connector's own defaults then apply, which
   * is what those providers had before.
   */
  private async buildMarketplaceConnector(integration: {
    id: string;
    provider: string;
    credentialsEncrypted: string;
  }) {
    const credentials = this.credentialService.decrypt(integration.credentialsEncrypted);
    this.credentialService.validate(integration.provider, credentials);

    const settings = await this.settingsService
      .resolveForRuntime(integration.id)
      .catch(() => ({}) as Record<string, unknown>);

    return this.connectorFactory.create(integration.provider, credentials, settings);
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
    // Carried to the caller so the UI can badge a simulated connection instead
    // of presenting sample data as a working marketplace link.
    let mode: string | undefined;
    let modeSource: string | undefined;

    try {
      if (integration.providerType === 'marketplace') {
        const connector = await this.buildMarketplaceConnector(integration);
        const testResult = await connector.testConnection();
        success = testResult.success;
        message = testResult.message;
        mode = testResult.mode;
        modeSource = testResult.modeSource;

        // An OAuth marketplace may have handed back a replacement refresh token
        // while authenticating. Persisting it here is what stops the next
        // process restart from finding a token the marketplace no longer honours.
        const rotated = connector.consumeRotatedCredentials();
        if (rotated) {
          await this.credentialService.persistRotatedCredentials(integration.id, rotated);
        }
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
        responseBody: JSON.stringify({ success, message, durationMs, mode, modeSource }),
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

    return { success, message, durationMs, mode, modeSource };
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

    // A simulated run imports nothing on purpose. Without saying so here, the
    // seller sees a sync finish with zero orders and reasonably concludes the
    // integration is broken — the log prefix is not enough, because the summary
    // is the only part most of them read.
    const stored = await this.settingsService
      .resolveForRuntime(integration.id)
      .catch(() => ({}) as Record<string, unknown>);
    const { mode, modeSource } = this.resolveMode(
      integration.provider,
      integration.providerType,
      stored,
    );

    return {
      success: true,
      message:
        mode === 'simulation'
          ? 'Senkronizasyon SİMÜLASYON modunda kuyruğa alındı: pazaryerine istek gönderilmeyecek, ' +
            'örnek kayıtlar üretilecek ve hiçbiri veritabanına yazılmayacak. Sıfır sipariş/ürün ' +
            'sonucu arıza değil, bu modun beklenen çıktısıdır.'
          : 'Senkronizasyon görevleri arka plan işleme kuyruğuna başarıyla eklendi',
      mode,
      modeSource,
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

    const connector = await this.buildMarketplaceConnector(integration);

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

    const connector = await this.buildMarketplaceConnector(integration);

    return connector.getCategoryAttributes(categoryId);
  }

  /**
   * Backs the `trendyol.shipmentAddressId` / `trendyol.returnAddressId` fields
   * in the settings form. Both are marked required, so without this route the
   * form could never be completed — the manifest referenced an endpoint that
   * did not exist.
   */
  async getTrendyolAddresses(
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

    const connector = await this.buildMarketplaceConnector(integration);

    // Addresses are a Trendyol concept, not part of the marketplace contract.
    // Asking the id for a provider that has none is the caller's mistake, and
    // saying so beats a TypeError from a method that is not there.
    if (!(connector instanceof TrendyolBaseConnector)) {
      throw new BadRequestException(
        `Adres listesi yalnızca Trendyol entegrasyonlarında var: '${integration.provider}'`,
      );
    }

    return connector.getAddresses();
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
