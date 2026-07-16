import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuditLogService } from '@modules/audit/audit.service';
import { encrypt } from '@common/utils/encryption.util';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException('User not found or deleted');
    }

    // Role mapping
    const roleName = user.userRoles[0]?.role?.name || 'User';

    // Omit sensitive fields
    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    return {
      ...safeUser,
      roleName,
    };
  }

  async updateProfile(userId: string, data: any, agencyId: string, ip: string, userAgent: string) {
    const oldUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!oldUser) {
      throw new BadRequestException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        bio: data.bio,
        location: data.location,
        facebookUrl: data.facebookUrl,
        xUrl: data.xUrl,
        linkedinUrl: data.linkedinUrl,
        instagramUrl: data.instagramUrl,
      },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: oldUser.email,
      userName: `${oldUser.firstName || ''} ${oldUser.lastName || ''}`.trim() || oldUser.email,
      action: 'profile.update',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Updated profile information',
      oldValue: {
        firstName: oldUser.firstName,
        lastName: oldUser.lastName,
        phone: oldUser.phone,
        bio: oldUser.bio,
        location: oldUser.location,
        facebookUrl: oldUser.facebookUrl,
        xUrl: oldUser.xUrl,
        linkedinUrl: oldUser.linkedinUrl,
        instagramUrl: oldUser.instagramUrl,
      },
      newValue: {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        bio: updatedUser.bio,
        location: updatedUser.location,
        facebookUrl: updatedUser.facebookUrl,
        xUrl: updatedUser.xUrl,
        linkedinUrl: updatedUser.linkedinUrl,
        instagramUrl: updatedUser.instagramUrl,
      },
      ipAddress: ip,
      userAgent,
    });

    return this.getProfile(userId);
  }

  async updateAddress(userId: string, data: any, agencyId: string, ip: string, userAgent: string) {
    const oldUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!oldUser) {
      throw new BadRequestException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        country: data.country,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        taxId: data.taxId,
        fullAddress: data.fullAddress,
      },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: oldUser.email,
      userName: `${oldUser.firstName || ''} ${oldUser.lastName || ''}`.trim() || oldUser.email,
      action: 'profile.address.update',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Updated profile address information',
      oldValue: {
        country: oldUser.country,
        city: oldUser.city,
        state: oldUser.state,
        postalCode: oldUser.postalCode,
        taxId: oldUser.taxId,
        fullAddress: oldUser.fullAddress,
      },
      newValue: {
        country: updatedUser.country,
        city: updatedUser.city,
        state: updatedUser.state,
        postalCode: updatedUser.postalCode,
        taxId: updatedUser.taxId,
        fullAddress: updatedUser.fullAddress,
      },
      ipAddress: ip,
      userAgent,
    });

    return this.getProfile(userId);
  }

  async changePassword(userId: string, data: any, agencyId: string, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    if (data.newPassword !== data.confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      action: 'profile.password.change',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Changed password',
      ipAddress: ip,
      userAgent,
    });

    return { success: true };
  }

  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate random 16 character Base32-like string for Totp Secret
    const secret = crypto.randomBytes(10).toString('hex').substring(0, 16).toUpperCase();
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/KroptOS:${user.email}?secret=${secret}&issuer=KroptOS`;

    return { secret, qrCode };
  }

  async enable2fa(userId: string, secret: string, code: string, agencyId: string, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Simple validation of code in dev environment (accept any 6 digit numeric code for ease of demonstration)
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Invalid 2FA verification code. Must be a 6-digit number.');
    }

    const encryptedSecret = encrypt(secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptedSecret,
      },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      action: 'profile.2fa.enable',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Enabled Two-Factor Authentication',
      ipAddress: ip,
      userAgent,
    });

    return { success: true };
  }

  async disable2fa(userId: string, agencyId: string, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      action: 'profile.2fa.disable',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Disabled Two-Factor Authentication',
      ipAddress: ip,
      userAgent,
    });

    return { success: true };
  }

  async logoutAllDevices(userId: string, currentTokenHash: string, agencyId: string, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Invalidate all other active sessions (excluding the current token if requested)
    await this.prisma.session.updateMany({
      where: {
        userId,
        tokenHash: { not: currentTokenHash },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Also remove refresh tokens for other sessions
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        tokenHash: { not: currentTokenHash },
      },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      action: 'profile.logoutAllDevices',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Logged out all other active sessions',
      ipAddress: ip,
      userAgent,
    });

    return { success: true };
  }

  async deleteAccount(userId: string, agencyId: string, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user is the sole owner of the agency
    const isOwner = user.userRoles.some((ur) => ur.role?.name?.toLowerCase() === 'owner');
    if (isOwner) {
      // Count other owners in this agency
      const ownerCount = await this.prisma.userRole.count({
        where: {
          agencyId,
          role: {
            name: {
              equals: 'Owner',
              mode: 'insensitive',
            },
          },
          deletedAt: null,
          user: {
            deletedAt: null,
          },
        },
      });

      if (ownerCount <= 1) {
        throw new ForbiddenException(
          'Account deletion denied. You are the sole Owner of this tenant. Please transfer ownership or assign another Owner before deleting your account.'
        );
      }
    }

    // Soft delete the user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      action: 'profile.deleteAccount',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Soft deleted account',
      ipAddress: ip,
      userAgent,
    });

    return { success: true };
  }

  async updateAvatar(userId: string, base64Image: string, agencyId: string, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar: base64Image,
      },
    });

    // Write audit log
    await this.auditLogService.createLog({
      tenantId: agencyId,
      userId,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      action: 'profile.avatar.update',
      module: 'profile',
      entityType: 'user',
      entityId: userId,
      description: 'Updated profile avatar image',
      ipAddress: ip,
      userAgent,
    });

    return { avatarUrl: base64Image };
  }
}
