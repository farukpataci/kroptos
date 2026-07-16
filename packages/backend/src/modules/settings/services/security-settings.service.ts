import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class SecuritySettingsService {
  constructor(private prisma: PrismaService) {}

  async findOrCreate(agencyId: string) {
    let settings = await this.prisma.securitySettings.findUnique({
      where: { agencyId },
    });

    if (!settings) {
      settings = await this.prisma.securitySettings.create({
        data: {
          agencyId,
          require2FA: false,
          passwordPolicy: 'standard',
          minPasswordLength: 8,
          sessionTimeoutMinutes: 120,
          ipWhitelist: [],
          loginAttemptLimit: 5,
        },
      });
    }

    return settings;
  }

  async update(agencyId: string, data: any, userId: string) {
    const current = await this.findOrCreate(agencyId);

    const updated = await this.prisma.securitySettings.update({
      where: { id: current.id },
      data: {
        require2FA: typeof data.require2FA === 'boolean' ? data.require2FA : current.require2FA,
        passwordPolicy: data.passwordPolicy || current.passwordPolicy,
        minPasswordLength: typeof data.minPasswordLength === 'number' ? data.minPasswordLength : Number(data.minPasswordLength || current.minPasswordLength),
        sessionTimeoutMinutes: typeof data.sessionTimeoutMinutes === 'number' ? data.sessionTimeoutMinutes : Number(data.sessionTimeoutMinutes || current.sessionTimeoutMinutes),
        ipWhitelist: Array.isArray(data.ipWhitelist) ? data.ipWhitelist : current.ipWhitelist,
        loginAttemptLimit: typeof data.loginAttemptLimit === 'number' ? data.loginAttemptLimit : Number(data.loginAttemptLimit || current.loginAttemptLimit),
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: agencyId,
        userId: userId,
        action: 'security.settings.update',
        module: 'settings',
        entityType: 'SecuritySettings',
        entityId: current.id,
        oldValue: JSON.parse(JSON.stringify(current)),
        newValue: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }
}
