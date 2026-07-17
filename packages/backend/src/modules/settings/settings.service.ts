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

  async updateSettings(data: any, userId: string) {
    let settings = await this.prisma.systemSettings.findFirst();
    
    const { id, updatedAt, ...writableData } = data;

    // Log the change
    await this.prisma.auditLog.create({
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

    if (settings) {
      return this.prisma.systemSettings.update({
        where: { id: settings.id },
        data: writableData,
      });
    } else {
      return this.prisma.systemSettings.create({
        data: writableData,
      });
    }
  }
}
