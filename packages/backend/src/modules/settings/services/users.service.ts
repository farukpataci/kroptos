import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isSuperAdminRole } from '../../../common/constants/platform-admin';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PermissionCacheService } from '../../../common/services/permission-cache.service';
import { AuditLogService } from '../../audit/audit.service';
import { ActorContext, RbacService } from '../../rbac/rbac.service';
import { ChangeUserRoleDto, ListUsersQueryDto, UpdateUserDto } from '../dto/users.dto';

/** Hassas alanlar (passwordHash, twoFactorSecret, twoFactorBackupCodes) BURADA YOK. */
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  isActive: true,
  twoFactorEnabled: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const SCOPE_INCLUDE = {
  role: { select: { id: true, key: true, name: true } },
  client: { select: { id: true, name: true } },
  store: { select: { id: true, name: true, publicId: true } },
} satisfies Prisma.UserRoleInclude;

type ScopeRow = Prisma.UserRoleGetPayload<{ include: typeof SCOPE_INCLUDE }>;

function toScope(ur: ScopeRow) {
  return {
    userRoleId: ur.id,
    roleId: ur.role.id,
    roleKey: ur.role.key,
    roleName: ur.role.name,
    clientId: ur.clientId,
    clientName: ur.client?.name ?? null,
    storeId: ur.storeId,
    storeName: ur.store?.name ?? null,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    private rbac: RbacService,
    private permissionCache: PermissionCacheService,
  ) {}

  /**
   * Listeleme her zaman UserRole join'i uzerinden aktif ajansla kapsanir (Kural 1):
   * satir secimi VE her include. Sistem super_admin'i tum ajanslari gorur.
   */
  async findAll(query: ListUsersQueryDto, actor: ActorContext) {
    const isSuperAdmin = isSuperAdminRole(actor);
    const agencyId = actor.agencyId;
    const agencyScope = isSuperAdmin ? {} : { agencyId };

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(isSuperAdmin ? {} : { userRoles: { some: { agencyId, deletedAt: null } } }),
      ...(query.status ? { isActive: query.status === 'active' } : {}),
      ...(query.role ? { userRoles: { some: { ...agencyScope, deletedAt: null, role: { key: query.role } } } } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users, stores] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_SELECT,
          userRoles: { where: { ...agencyScope, deletedAt: null }, include: { ...SCOPE_INCLUDE, agency: { select: { id: true, name: true } } } },
          storeUsers: { where: { deletedAt: null, store: { ...agencyScope, deletedAt: null } }, include: { store: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.store.findMany({
        where: { ...agencyScope, deletedAt: null },
        select: { id: true, name: true, publicId: true },
      }),
    ]);

    return {
      total,
      page: query.page,
      limit: query.limit,
      users: users.map((u) => {
        // Super admin baska ajanslarin kullanicilarini da gorur; onlarin aktif
        // ajansta rolu olmadigi icin kendi ajanslarindaki rolu gosterilir.
        const agencyRole = u.userRoles.find((ur) => ur.agencyId === agencyId) ?? (isSuperAdmin ? u.userRoles[0] : undefined);
        const assignedStores = u.storeUsers.map((su) => su.store);
        return {
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
          role: agencyRole?.role?.key ?? null,
          roleId: agencyRole?.roleId,
          status: u.isActive ? 'active' : 'inactive',
          createdAt: u.createdAt.toLocaleDateString('tr-TR'),
          scopes: u.userRoles.map(toScope),
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

  /** Aktif ajansta rolu olmayan kullanici 404: varligi sizmaz. Super admin istisna. */
  private async findInAgency(userId: string, actor: ActorContext) {
    const isSuperAdmin = isSuperAdminRole(actor);
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        ...(isSuperAdmin ? {} : { userRoles: { some: { agencyId: actor.agencyId, deletedAt: null } } }),
      },
      select: {
        ...USER_SELECT,
        userRoles: { where: { agencyId: actor.agencyId, deletedAt: null }, include: SCOPE_INCLUDE },
        storeUsers: { where: { deletedAt: null, store: { agencyId: actor.agencyId, deletedAt: null } }, select: { storeId: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findOne(userId: string, actor: ActorContext) {
    const u = await this.findInAgency(userId, actor);
    const { userRoles, storeUsers, ...rest } = u;
    return { ...rest, scopes: userRoles.map(toScope), allowedStoreIds: storeUsers.map((s) => s.storeId) };
  }

  async update(userId: string, dto: UpdateUserDto, actor: ActorContext) {
    const before = await this.findInAgency(userId, actor);
    if (userId === actor.userId && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    if (dto.isActive === false && (await this.rbac.isLastAgencyOwner(userId, actor.agencyId))) {
      throw new BadRequestException('Cannot deactivate the last agency_owner of this agency');
    }

    const data: Prisma.UserUpdateInput = {};
    for (const k of ['isActive', 'firstName', 'lastName', 'phone'] as const) {
      if (dto[k] !== undefined) (data as any)[k] = dto[k];
    }
    const after = await this.prisma.user.update({ where: { id: userId }, data, select: USER_SELECT });

    await this.auditLogService.createLog({
      tenantId: actor.agencyId,
      userId: actor.userId,
      action: 'user.update',
      module: 'system',
      entityType: 'User',
      entityId: userId,
      entityDisplayName: before.email,
      oldValue: { isActive: before.isActive, firstName: before.firstName, lastName: before.lastName, phone: before.phone },
      newValue: { isActive: after.isActive, firstName: after.firstName, lastName: after.lastName, phone: after.phone },
      ipAddress: actor.ipAddress,
    });
    // isActive degisimi yetkiyi etkiler (P11 JwtStrategy'de okuyacak); simdiden dusur.
    await this.permissionCache.invalidateUser(userId);
    return after;
  }

  /**
   * Bu ajanstaki rolu DEGISTIRIR: aktif satirlar kapanir, yeni rol+kapsam tek
   * satir olur. Kendi rolu degistirilemez; son agency_owner dusurulemez;
   * escalation/super_admin kurallari RbacService.assertAssignableRole'da.
   */
  async changeRole(userId: string, dto: ChangeUserRoleDto, actor: ActorContext) {
    if (userId === actor.userId) {
      throw new BadRequestException('You cannot change your own role');
    }
    const user = await this.findInAgency(userId, actor);
    const role = await this.rbac.assertAssignableRole(dto.roleId, actor);

    const scope = { clientId: dto.clientId || null, storeId: dto.storeId || null };
    if (scope.clientId) {
      const client = await this.prisma.client.findFirst({ where: { id: scope.clientId, agencyId: actor.agencyId, deletedAt: null } });
      if (!client) throw new BadRequestException(`Client '${scope.clientId}' does not belong to the active agency`);
    }
    if (scope.storeId) {
      const store = await this.prisma.store.findFirst({ where: { id: scope.storeId, agencyId: actor.agencyId, deletedAt: null } });
      if (!store) throw new BadRequestException(`Store '${scope.storeId}' does not belong to the active agency`);
      if (scope.clientId && store.clientId !== scope.clientId) {
        throw new BadRequestException(`Store '${scope.storeId}' does not belong to client '${scope.clientId}'`);
      }
    }

    const staysAgencyOwner = role.key === 'agency_owner' && role.isSystem && !scope.clientId && !scope.storeId;
    if (!staysAgencyOwner && (await this.rbac.isLastAgencyOwner(userId, actor.agencyId))) {
      throw new BadRequestException('Cannot demote the last agency_owner of this agency');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.userRole.updateMany({
        where: { userId, agencyId: actor.agencyId, deletedAt: null },
        data: { deletedAt: now },
      });
      // Ayni kapsamla daha once kapatilmis satir varsa geri ac (userrole_scope_uq aktif satirlari kapsar).
      const existing = await tx.userRole.findFirst({ where: { userId, agencyId: actor.agencyId, roleId: role.id, ...scope } });
      return existing
        ? tx.userRole.update({ where: { id: existing.id }, data: { deletedAt: null } })
        : tx.userRole.create({ data: { userId, agencyId: actor.agencyId, roleId: role.id, ...scope } });
    });

    await this.auditLogService.createLog({
      tenantId: actor.agencyId,
      userId: actor.userId,
      action: 'user.change_role',
      module: 'system',
      entityType: 'User',
      entityId: userId,
      entityDisplayName: user.email,
      oldValue: { scopes: user.userRoles.map(toScope) },
      newValue: { scopes: [toScope({ ...created, role: { id: role.id, key: role.key, name: role.name }, client: null, store: null })] },
      ipAddress: actor.ipAddress,
    });
    // Kapsam daralinca getMe degisir; eski cache ile 403 yagmuru olmasin (P2.6).
    await this.permissionCache.invalidateUser(userId);
    return this.findOne(userId, actor);
  }

  /**
   * Tenant'tan cikarir. User.deletedAt'e DOKUNMAZ: ayni kisi baska ajansta
   * calisiyor olabilir. Bu ajanstaki UserRole'ler VE bu ajansin magazalarindaki
   * StoreUser satirlari kapanir - TenantMiddleware StoreUser'i tek basina da
   * erisim sayar; yalniz UserRole kapansa magaza erisimi acik kalirdi.
   */
  async removeFromTenant(userId: string, actor: ActorContext) {
    if (userId === actor.userId) {
      throw new BadRequestException('You cannot remove yourself from the tenant');
    }
    const user = await this.findInAgency(userId, actor);
    if (await this.rbac.isLastAgencyOwner(userId, actor.agencyId)) {
      throw new BadRequestException('Cannot remove the last agency_owner of this agency');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.updateMany({ where: { userId, agencyId: actor.agencyId, deletedAt: null }, data: { deletedAt: now } });
      await tx.storeUser.updateMany({
        where: { userId, deletedAt: null, store: { agencyId: actor.agencyId } },
        data: { deletedAt: now },
      });
    });

    await this.auditLogService.createLog({
      tenantId: actor.agencyId,
      userId: actor.userId,
      action: 'user.remove_from_tenant',
      module: 'system',
      entityType: 'User',
      entityId: userId,
      entityDisplayName: user.email,
      oldValue: { scopes: user.userRoles.map(toScope), allowedStoreIds: user.storeUsers.map((s) => s.storeId) },
      newValue: { scopes: [], allowedStoreIds: [] },
      ipAddress: actor.ipAddress,
    });
    await this.permissionCache.invalidateUser(userId);
  }

  async updateUserStores(userId: string, storeIds: string[], actor: ActorContext) {
    const isSuperAdmin = isSuperAdminRole(actor);
    const activeAgencyId = actor.agencyId;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
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
      where: { key: 'store_manager', agencyId: null, deletedAt: null },
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

    await this.auditLogService.createLog({
      tenantId: activeAgencyId,
      userId: actor.userId,
      action: 'user.update_stores',
      module: 'system',
      entityType: 'User',
      entityId: userId,
      entityDisplayName: user.email,
      description: `Updated store assignments for user ${user.email}`,
      newValue: { storeIds },
      ipAddress: actor.ipAddress,
    });
    await this.permissionCache.invalidateUser(userId);

    return { success: true, updatedStoreIds: storeIds };
  }
}
