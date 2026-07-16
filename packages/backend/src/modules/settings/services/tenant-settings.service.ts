import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class TenantSettingsService {
  constructor(private prisma: PrismaService) {}

  async findOrCreate(agencyId: string) {
    let settings = await this.prisma.tenantSettings.findUnique({
      where: { agencyId },
    });

    if (!settings) {
      const agency = await this.prisma.agency.findUnique({
        where: { id: agencyId },
      });

      settings = await this.prisma.tenantSettings.create({
        data: {
          agencyId,
          companyName: agency?.name || 'My Company',
          settings: {},
        },
      });
    }

    return settings;
  }

  async update(agencyId: string, data: any, userId: string) {
    const current = await this.findOrCreate(agencyId);

    const updated = await this.prisma.tenantSettings.update({
      where: { id: current.id },
      data: {
        companyName: data.companyName,
        taxNumber: data.taxNumber,
        taxOffice: data.taxOffice,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        logoUrl: data.logoUrl,
        defaultWarehouseId: data.defaultWarehouseId,
        defaultShippingCarrier: data.defaultShippingCarrier,
        defaultAccountingId: data.defaultAccountingId,
        defaultCurrency: data.defaultCurrency,
        defaultInvoiceType: data.defaultInvoiceType,
        settings: data.settings ? JSON.parse(JSON.stringify(data.settings)) : current.settings,
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: agencyId,
        userId: userId,
        action: 'tenant.settings.update',
        module: 'settings',
        entityType: 'TenantSettings',
        entityId: current.id,
        oldValue: JSON.parse(JSON.stringify(current)),
        newValue: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }
}
