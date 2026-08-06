import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        userRoles: {
          where: { deletedAt: null },
          include: { role: true, agency: true },
        },
        storeUsers: {
          where: { deletedAt: null },
          include: { store: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stores = await this.prisma.store.findMany({
      where: { agencyId, deletedAt: null },
      select: { id: true, name: true, publicId: true },
    });

    return {
      users: users.map((u) => {
        const agencyRole = u.userRoles.find((ur) => ur.agencyId === agencyId) || u.userRoles[0];
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

  async updateUserStores(userId: string, storeIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Get default role for StoreUser (or super admin role)
    const defaultRole = await this.prisma.role.findFirst();
    const roleId = defaultRole ? defaultRole.id : 'cmqs71dv9000eqk3t4qahl4vt';

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

    return { success: true, updatedStoreIds: storeIds };
  }
}
