import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class IntegrationSettingsService {
  private defaultProviders = ['amazon', 'trendyol', 'hepsiburada', 'shopify', 'woocommerce', 'logo'];

  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    const existing = await this.prisma.integrationSettings.findMany({
      where: { agencyId },
    });

    const result = this.defaultProviders.map((provider) => {
      const dbItem = existing.find((item) => item.provider.toLowerCase() === provider.toLowerCase());
      if (dbItem) {
        return dbItem;
      }
      return {
        id: provider,
        agencyId,
        provider,
        status: 'disconnected',
        config: {},
        isActive: false,
        lastSyncAt: null,
        errorCount: 0,
      };
    });

    return result;
  }

  async update(agencyId: string, provider: string, data: any, userId: string) {
    const providerLower = provider.toLowerCase();

    let dbItem = await this.prisma.integrationSettings.findUnique({
      where: {
        agencyId_provider: {
          agencyId,
          provider: providerLower,
        },
      },
    });

    const isConnecting = data.status === 'connected';

    if (dbItem) {
      dbItem = await this.prisma.integrationSettings.update({
        where: { id: dbItem.id },
        data: {
          status: data.status || dbItem.status,
          config: data.config ? JSON.parse(JSON.stringify(data.config)) : dbItem.config,
          isActive: typeof data.isActive === 'boolean' ? data.isActive : isConnecting,
          lastSyncAt: isConnecting ? new Date() : dbItem.lastSyncAt,
          errorCount: isConnecting ? 0 : dbItem.errorCount,
        },
      });
    } else {
      dbItem = await this.prisma.integrationSettings.create({
        data: {
          agencyId,
          provider: providerLower,
          status: data.status || 'connected',
          config: data.config ? JSON.parse(JSON.stringify(data.config)) : {},
          isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
          lastSyncAt: isConnecting ? new Date() : null,
        },
      });
    }

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: agencyId,
        userId: userId,
        action: `integration.${providerLower}.update`,
        module: 'settings',
        entityType: 'IntegrationSettings',
        entityId: dbItem.id,
        newValue: JSON.parse(JSON.stringify(dbItem)),
      },
    });

    return dbItem;
  }
}
