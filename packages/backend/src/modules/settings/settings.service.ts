import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.systemSettings.create({
        data: {
          systemName: 'KroptOS',
        },
      });
    }
    return settings;
  }

  async updateSettings(data: any, userId: string, agencyId?: string | null) {
    const settings = await this.prisma.systemSettings.findFirst();

    const { id, updatedAt, ...writableData } = data;

    // Product.currency is per-agency data, so propagation needs an agency to scope to.
    // An unscoped updateMany would rewrite every tenant's catalogue. Callers without an
    // agency context (super admins) have no safe subset to rewrite, so the setting is
    // saved but the catalogue is left alone - surfaced here rather than passing unnoticed.
    if (writableData.defaultCurrency && !agencyId) {
      console.warn(
        `defaultCurrency set to '${writableData.defaultCurrency}' by user ${userId} without an agency context; existing products were left untouched.`,
      );
    }

    // Audit entry, currency propagation and the settings row commit together. Previously
    // the log was written first and the propagation swallowed its own errors, so a
    // failure left an audit trail describing a change the catalogue never adopted.
    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: userId,
          action: 'UPDATE_SYSTEM_SETTINGS',
          module: 'Settings',
          entityType: 'SystemSettings',
          entityId: settings?.id || 'new',
          oldValue: JSON.stringify(settings || {}),
          newValue: JSON.stringify(writableData),
        }
      });

      if (writableData.defaultCurrency && agencyId) {
        await tx.product.updateMany({
          where: { agencyId },
          data: { currency: writableData.defaultCurrency },
        });
      }

      if (settings) {
        return tx.systemSettings.update({
          where: { id: settings.id },
          data: writableData,
        });
      } else {
        return tx.systemSettings.create({
          data: writableData,
        });
      }
    });
  }
}
