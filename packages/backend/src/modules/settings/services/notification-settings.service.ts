import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class NotificationSettingsService {
  constructor(private prisma: PrismaService) {}

  async findOrCreate(agencyId: string) {
    let settings = await this.prisma.notificationSettings.findFirst({
      where: { agencyId, userId: null },
    });

    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: {
          agencyId,
          userId: null,
          channels: {
            email: true,
            sms: false,
            slack: false,
            system: true,
          },
          events: {
            newOrder: true,
            criticalStock: true,
            integrationError: true,
          },
        },
      });
    }

    return settings;
  }

  async update(agencyId: string, data: any, userId: string) {
    const current = await this.findOrCreate(agencyId);

    const updated = await this.prisma.notificationSettings.update({
      where: { id: current.id },
      data: {
        channels: data.channels ? JSON.parse(JSON.stringify(data.channels)) : current.channels,
        events: data.events ? JSON.parse(JSON.stringify(data.events)) : current.events,
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: agencyId,
        userId: userId,
        action: 'profile.notification.update',
        module: 'settings',
        entityType: 'NotificationSettings',
        entityId: current.id,
        oldValue: JSON.parse(JSON.stringify(current)),
        newValue: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }
}
