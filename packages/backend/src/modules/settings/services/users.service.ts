import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  async findAll(agencyId: string, isSuperAdmin?: boolean) {
    // Sistem yöneticisi tüm ajansları görür; diğer herkes yalnızca aktif
    // ajansını. Kapsama sorgunun her katmanına inmek zorunda: satır seçimi
    // kapsansa bile include'lar kapsanmazsa başka ajansların rol, ajans ve
    // mağaza adları yanıta sızar.
    const agencyScope = isSuperAdmin ? {} : { agencyId };

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(isSuperAdmin ? {} : { userRoles: { some: { agencyId, deletedAt: null } } }),
      },
      include: {
        userRoles: {
          where: { ...agencyScope, deletedAt: null },
          include: { role: true, agency: true },
        },
        storeUsers: {
          where: { deletedAt: null, store: { ...agencyScope, deletedAt: null } },
          include: { store: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stores = await this.prisma.store.findMany({
      where: { ...agencyScope, deletedAt: null },
      select: { id: true, name: true, publicId: true },
    });

    return {
      users: users.map((u) => {
        // Süper admin başka ajansların kullanıcılarını da görür; onların aktif
        // ajansta rolü olmadığı için kendi ajanslarındaki rolü gösterilir.
        const agencyRole =
          u.userRoles.find((ur) => ur.agencyId === agencyId) ?? (isSuperAdmin ? u.userRoles[0] : undefined);
        const assignedStores = u.storeUsers.map((su) => su.store);
        return {
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
          role: agencyRole?.role?.name || 'Administrator',
          roleId: agencyRole?.roleId,
          status: u.isActive ? 'active' : 'inactive',
          createdAt: u.createdAt.toLocaleDateString('tr-TR'),
          allowedStoreIds: assignedStores.map((s) => s.id),
          allowedStores: assignedStores.map((s) => ({
            id: s.id,
            name: s.name,
            publicId: s.publicId || `tn_${s.id}`,
          })),
        };
      }),
      availableStores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        publicId: s.publicId || `tn_${s.id}`,
      })),
    };
  }

  async updateUserStores(
    userId: string,
    storeIds: string[],
    activeAgencyId?: string,
    isSuperAdmin?: boolean,
    performingUserId?: string,
    ipAddress?: string,
  ) {
    if (!activeAgencyId && !isSuperAdmin) {
      throw new BadRequestException('Active agency context is required (x-agency-id header)');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!isSuperAdmin) {
      const userRole = await this.prisma.userRole.findFirst({
        where: { userId, agencyId: activeAgencyId, deletedAt: null },
      });
      if (!userRole) {
        throw new ForbiddenException('Access denied. Target user does not belong to authorized agency context.');
      }
    }

    if (storeIds.length > 0 && !isSuperAdmin) {
      const validStores = await this.prisma.store.findMany({
        where: { id: { in: storeIds }, agencyId: activeAgencyId, deletedAt: null },
        select: { id: true },
      });
      if (validStores.length !== storeIds.length) {
        throw new ForbiddenException('Access denied. One or more stores do not belong to authorized agency context.');
      }
    }

    // Get default role for StoreUser ('store_manager'). Never fall back to super_admin.
    const storeManagerRole = await this.prisma.role.findFirst({
      where: { name: 'store_manager' },
    });
    if (!storeManagerRole) {
      throw new NotFoundException("Default store role ('store_manager') not found");
    }
    const roleId = storeManagerRole.id;

    // Soft delete existing store users for this user
    await this.prisma.storeUser.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    // Create new store user assignments
    for (const storeId of storeIds) {
      const existing = await this.prisma.storeUser.findUnique({
        where: { userId_storeId: { userId, storeId } },
      });

      if (existing) {
        await this.prisma.storeUser.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
      } else {
        await this.prisma.storeUser.create({
          data: {
            userId,
            storeId,
            roleId,
          },
        });
      }
    }

    if (performingUserId) {
      await this.auditLogService.createLog({
        tenantId: activeAgencyId,
        userId: performingUserId,
        action: 'user.update_stores',
        module: 'system',
        entityType: 'User',
        entityId: userId,
        entityDisplayName: user.email,
        description: `Updated store assignments for user ${user.email}`,
        newValue: { storeIds },
        ipAddress,
      });
    }

    return { success: true, updatedStoreIds: storeIds };
  }
}
