import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isPermissionKey, SYSTEM_ROLE_KEYS } from '@kroptos/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PermissionCacheService } from '../../../common/services/permission-cache.service';
import { ActorContext, RbacService } from '../../rbac/rbac.service';
import { SessionService } from '../../auth/session.service';
import { CreateRoleDto, UpdateRoleDto } from '../dto/roles.dto';

/**
 * Bu servis bir guvenlik siniri acar: ajans yoneticisi rol yaratabilir. Uc kilit:
 *  - sistem rolleri (isSystem) dokunulmaz -> JWT roleIsSystem claim'i bayatlamaz
 *  - rezerve key'ler (9 sistem rolu, super_admin dahil) tenant roluna verilmez ->
 *    isSuperAdminRole key+isSystem ister, bu ikinci katman
 *  - '*:*' tenant roluna asla; kalan izinler assertCanGrant (escalation)
 */
const RESERVED_KEYS = new Set<string>(SYSTEM_ROLE_KEYS);

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '') || 'role';
}

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
    private permissionCache: PermissionCacheService,
    private sessions: SessionService,
  ) {}

  /** Sistem rolleri + bu ajansin ozel rolleri; userCount bu ajanstaki aktif atamalar. */
  async list(actor: ActorContext) {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null, OR: [{ agencyId: null }, { agencyId: actor.agencyId }] },
      include: {
        permissions: { select: { name: true } },
        _count: { select: { userRoles: { where: { agencyId: actor.agencyId, deletedAt: null } } } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map((r) => this.toDto(r));
  }

  async get(id: string, actor: ActorContext) {
    return this.toDto(await this.findScoped(id, actor));
  }

  async create(dto: CreateRoleDto, actor: ActorContext) {
    const permissions = this.validatePermissions(dto.permissions);
    await this.rbac.assertCanGrant(permissions, actor);

    const base = slugify(dto.name);
    if (RESERVED_KEYS.has(base)) {
      // Slug cakismasi degil, acik ret: sistem rolu adiyla tenant rolu acilamaz.
      throw new BadRequestException(`'${base}' is a reserved system role key`);
    }
    const key = await this.uniqueKey(base, actor.agencyId);

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          agencyId: actor.agencyId,
          key,
          name: dto.name.trim(),
          description: dto.description ?? null,
          isSystem: false,
          permissions: { connect: permissions.map((name) => ({ name })) },
        },
        include: { permissions: { select: { name: true } } },
      });
      await this.audit(tx, 'role.create', role.id, actor, { newValue: { key, name: role.name, permissions } });
      return this.toDto({ ...role, _count: { userRoles: 0 } });
    });
  }

  async update(id: string, dto: UpdateRoleDto, actor: ActorContext) {
    const role = await this.findScoped(id, actor);
    this.assertMutable(role);

    const before = role.permissions.map((p) => p.name).sort();
    const after = dto.permissions ? this.validatePermissions(dto.permissions) : before;
    const added = after.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !after.includes(p));
    if (added.length) await this.rbac.assertCanGrant(added, actor);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.role.update({
        where: { id: role.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.permissions ? { permissions: { set: after.map((name) => ({ name })) } } : {}),
        },
        include: { permissions: { select: { name: true } }, _count: { select: { userRoles: { where: { agencyId: actor.agencyId, deletedAt: null } } } } },
      });
      await this.audit(tx, 'role.update', role.id, actor, {
        oldValue: { name: role.name, description: role.description, permissions: before },
        // Fark okunabilir olsun: hangi izin eklendi, hangisi cikti.
        newValue: { name: row.name, description: row.description, permissions: after, added, removed },
      });
      return row;
    });
    if (added.length || removed.length) {
      await this.permissionCache.invalidateRole(role.id);
      // P11: izin matrisi degisti -> bu role bagli HERKESIN oturumlari kapanir (yeniden giris).
      await this.sessions.revokeForRole(role.id, 'role.permissions_changed', actor.userId, actor.agencyId);
    }
    return this.toDto(updated);
  }

  async remove(id: string, actor: ActorContext) {
    const role = await this.findScoped(id, actor);
    this.assertMutable(role);
    const active = await this.prisma.userRole.count({ where: { roleId: role.id, deletedAt: null } });
    if (active > 0) {
      throw new BadRequestException(`Role '${role.name}' is still assigned to ${active} user(s); reassign them first`);
    }
    await this.prisma.$transaction(async (tx) => {
      // Soft delete: partial index'ler deletedAt IS NULL kosullu, key yeniden kullanilabilir.
      await tx.role.update({ where: { id: role.id }, data: { deletedAt: new Date() } });
      await this.audit(tx, 'role.delete', role.id, actor, { oldValue: { key: role.key, name: role.name, permissions: role.permissions.map((p) => p.name) } });
    });
    await this.permissionCache.invalidateRole(role.id);
  }

  // ---------------- helpers ----------------

  private async findScoped(id: string, actor: ActorContext) {
    // Baska ajansin rolu -> 404 (Forbidden degil: varligi sizmaz).
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null, OR: [{ agencyId: null }, { agencyId: actor.agencyId }] },
      include: { permissions: { select: { name: true } }, _count: { select: { userRoles: { where: { agencyId: actor.agencyId, deletedAt: null } } } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private assertMutable(role: { isSystem: boolean; key: string }) {
    if (role.isSystem) {
      throw new ForbiddenException(`System role '${role.key}' cannot be modified or deleted`);
    }
  }

  private validatePermissions(keys: string[]): string[] {
    const unknown = keys.filter((k) => !isPermissionKey(k));
    if (unknown.length) throw new BadRequestException(`Unknown permission(s): ${unknown.join(', ')}`);
    if (keys.includes('*:*')) throw new ForbiddenException("'*:*' cannot be granted to a tenant role");
    return [...new Set(keys)].sort();
  }

  /** Aktif roller arasinda benzersiz key; soft-deleted key'ler serbest (partial index kosulu). */
  private async uniqueKey(base: string, agencyId: string): Promise<string> {
    let key = base;
    for (let n = 2; ; n++) {
      const taken = await this.prisma.role.findFirst({ where: { agencyId, key, deletedAt: null }, select: { id: true } });
      if (!taken) return key;
      key = `${base}_${n}`;
    }
  }

  // try/catch YOK (P5 bulgusu).
  private audit(
    tx: Prisma.TransactionClient,
    action: string,
    roleId: string,
    actor: ActorContext,
    values: { oldValue?: unknown; newValue?: unknown },
  ) {
    return tx.auditLog.create({
      data: {
        action,
        module: 'system',
        entityType: 'Role',
        entityId: roleId,
        userId: actor.userId,
        tenantId: actor.agencyId,
        ipAddress: actor.ipAddress || null,
        oldValue: values.oldValue ? JSON.parse(JSON.stringify(values.oldValue)) : undefined,
        newValue: values.newValue ? JSON.parse(JSON.stringify(values.newValue)) : undefined,
      },
    });
  }

  private toDto(r: {
    id: string; agencyId: string | null; key: string; name: string; description: string | null; isSystem: boolean;
    permissions: { name: string }[]; _count: { userRoles: number };
  }) {
    return {
      id: r.id,
      agencyId: r.agencyId,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      permissions: r.permissions.map((p) => p.name).sort(),
    };
  }
}
