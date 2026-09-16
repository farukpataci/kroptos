import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { isSuperAdminRole } from '@common/constants/platform-admin';
import { PrismaService } from '@common/prisma/prisma.service';
import { PermissionCacheService } from '@common/services/permission-cache.service';
import { SessionService } from '../auth/session.service';
import { AssignRoleDto, RevokeRoleDto } from './dto/rbac.dto';
import { Prisma } from '@prisma/client';

/**
 * Cagiranin kimligi ve AKTIF baglami. agencyId TenantMiddleware'in cozdugu
 * req.activeAgency'den gelir, DTO'dan asla. Controller'lar bunu uretir.
 */
export interface ActorContext {
  userId: string;
  email?: string | null;
  agencyId: string;
  clientId?: string | null;
  storeId?: string | null;
  role?: string | null;
  roleIsSystem?: boolean | null;
  ipAddress?: string;
}

export function actorFromRequest(req: any): ActorContext {
  const user = req.user ?? {};
  const agencyId: string | undefined = req.activeAgency?.id ?? user.agencyId;
  if (!agencyId) throw new BadRequestException('Active agency context is required');
  return {
    userId: user.userId ?? user.id,
    email: user.email,
    agencyId,
    clientId: req.activeClient?.id ?? user.clientId ?? null,
    storeId: req.activeStore?.id ?? user.storeId ?? null,
    role: user.role,
    roleIsSystem: user.roleIsSystem,
    ipAddress: req.ip || (req.headers?.['x-forwarded-for'] as string),
  };
}

@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    private permissionCache: PermissionCacheService,
    private sessions: SessionService,
  ) {}

  // AuditLog semasinda performedBy/agencyId/changes alanlari yok; dogru
  // adlar: userId, tenantId (@map("agencyId")) ve newValue. Kalip: OrderService.writeAuditLog.
  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    performedBy: string,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
    oldValue?: any,
  ) {
    // try/catch YOK: transaction icinde yutulan bir hata (or. gecersiz userId FK) Postgres
    // tx'ini abort eder, COMMIT sessizce ROLLBACK olur ve atama kaybolurken cagri
    // "basarili" doner. Audit yazilamiyorsa mutasyon da yazilmamali.
    await tx.auditLog.create({
      data: {
        action,
        entityType: 'UserRole',
        entityId,
        userId: performedBy,
        tenantId: agencyId,
        ipAddress: ipAddress || null,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
      },
    });
  }

  /**
   * Rol bu ajansta atanabilir mi? Uc kural, tek yer (UsersService de kullanir):
   *  - super_admin hicbir kosulda (P1)
   *  - rol ya sistem rolu ya da bu ajansin kendi rolu (baska ajansinki -> 404, varligi sizmaz)
   *  - escalation: cagiran kendi sahip olmadigi izni iceren rolu veremez (super_admin / '*:*' haric)
   */
  async assertAssignableRole(roleId: string, actor: ActorContext) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null, OR: [{ agencyId: null }, { agencyId: actor.agencyId }] },
      include: { permissions: { select: { name: true } } },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID '${roleId}' not found`);
    }
    // super_admin platform roludur: yalniz seed atar, hicbir runtime akisi veremez.
    if (isSuperAdminRole({ role: role.key, roleIsSystem: role.isSystem })) {
      throw new ForbiddenException(`Role '${role.key}' cannot be assigned at runtime`);
    }
    await this.assertCanGrant(role.permissions.map((p) => p.name), actor);
    return role;
  }

  /**
   * Escalation: cagiran, kendi izin kumesinde olmayan bir izni baskasina (rol atamasi
   * ya da rol tanimi yoluyla) veremez. Sistem super_admin ve '*:*' sahibi muaf.
   * Tek yer: assignRole, changeRole, davet ve RolesService create/update buradan gecer.
   */
  async assertCanGrant(permissionNames: string[], actor: ActorContext) {
    if (isSuperAdminRole(actor)) return;
    const mine =
      (await this.permissionCache.getPermissions({
        userId: actor.userId,
        agencyId: actor.agencyId,
        clientId: actor.clientId ?? null,
        storeId: actor.storeId ?? null,
      })) ?? [];
    if (mine.includes('*:*')) return;
    const missing = permissionNames.filter((p) => !mine.includes(p));
    if (missing.length) {
      throw new ForbiddenException(`Cannot grant permissions you do not hold: ${missing.join(', ')}`);
    }
  }

  /** Ajansta bu kullanici disinda aktif, ajans geneli agency_owner var mi? */
  async isLastAgencyOwner(userId: string, agencyId: string): Promise<boolean> {
    const ownerRole = { key: 'agency_owner', isSystem: true };
    const holds = await this.prisma.userRole.count({
      where: { userId, agencyId, deletedAt: null, clientId: null, storeId: null, role: ownerRole },
    });
    if (holds === 0) return false;
    const others = await this.prisma.userRole.count({
      where: { agencyId, deletedAt: null, clientId: null, storeId: null, userId: { not: userId }, role: ownerRole },
    });
    return others === 0;
  }

  async assignRole(dto: AssignRoleDto, actor: ActorContext) {
    const agencyId = actor.agencyId;

    // 1. Hedef kullanici var mi
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, deletedAt: null } });
    if (!user) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found`);
    }

    // 2. Rol atanabilir mi (sistem/ajans, super_admin degil, escalation yok)
    const role = await this.assertAssignableRole(dto.roleId, actor);

    // 3. Kapsam bu ajansa ait mi
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, agencyId, deletedAt: null },
      });
      if (!client) {
        throw new BadRequestException(`Client '${dto.clientId}' does not exist or does not belong to the active agency`);
      }
    }
    if (dto.storeId) {
      const store = await this.prisma.store.findFirst({
        where: { id: dto.storeId, agencyId, deletedAt: null },
      });
      if (!store) {
        throw new BadRequestException(`Store '${dto.storeId}' does not exist or does not belong to the active agency`);
      }
      if (dto.clientId && store.clientId !== dto.clientId) {
        throw new BadRequestException(`Store '${dto.storeId}' does not belong to client '${dto.clientId}'`);
      }
    }

    const scope = { clientId: dto.clientId || null, storeId: dto.storeId || null };

    // 4. Farkli kapsam = farkli satir. Eski kod userId+agencyId+roleId ile bulup
    // storeId'yi EZIYORDU; userrole_scope_uq (P3) kapsami anahtarin parcasi yapiyor.
    const assigned = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userRole.findFirst({
        where: { userId: dto.userId, agencyId, roleId: dto.roleId, ...scope },
      });

      let userRole;
      if (existing && !existing.deletedAt) {
        return existing; // idempotent
      } else if (existing) {
        userRole = await tx.userRole.update({ where: { id: existing.id }, data: { deletedAt: null } });
      } else {
        userRole = await tx.userRole.create({
          data: { userId: dto.userId, agencyId, roleId: dto.roleId, ...scope },
        });
      }

      await this.writeAuditLog(tx, 'assign', userRole.id, actor.userId, agencyId, actor.ipAddress, {
        userId: dto.userId,
        roleKey: role.key,
        ...scope,
      });

      return userRole;
    });
    await this.permissionCache.invalidateUser(dto.userId);
    return assigned;
  }

  async revokeRole(dto: RevokeRoleDto, actor: ActorContext) {
    // Aktif ajansa ait degilse 404: varligini sizdirma.
    const userRole = await this.prisma.userRole.findFirst({
      where: { id: dto.userRoleId, agencyId: actor.agencyId, deletedAt: null },
      include: { role: { select: { key: true } } },
    });

    if (!userRole) {
      throw new NotFoundException(`Active role assignment with ID '${dto.userRoleId}' not found`);
    }
    if (userRole.userId === actor.userId) {
      throw new BadRequestException('You cannot revoke your own role');
    }
    if (
      !userRole.clientId &&
      !userRole.storeId &&
      userRole.role.key === 'agency_owner' &&
      (await this.isLastAgencyOwner(userRole.userId, actor.agencyId))
    ) {
      throw new BadRequestException('Cannot revoke the last agency_owner of this agency');
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.userRole.update({
        where: { id: dto.userRoleId },
        data: { deletedAt: now },
      });

      await this.writeAuditLog(
        tx,
        'revoke',
        dto.userRoleId,
        actor.userId,
        actor.agencyId,
        actor.ipAddress,
        { userId: userRole.userId, roleId: userRole.roleId, deletedAt: now },
        { roleId: userRole.roleId, clientId: userRole.clientId, storeId: userRole.storeId },
      );
    });
    // P11: bu kiracidaki erisim dusuyor; baska ajansta rolu yoksa oturumlar da kapanir.
    await this.sessions.revokeForUserInTenant(userRole.userId, actor.agencyId, 'rbac.revoke', actor.userId);
  }
}
