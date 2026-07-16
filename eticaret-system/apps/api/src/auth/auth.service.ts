import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { ensureDefaultRoles } from 'eticaret-system-database';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AUDIT_ACTIONS } from './audit-actions';
import { hashSessionToken } from './guards/session-auth.guard';
import type { AuthenticatedRequestUser, SessionTenantContext } from './types/jwt-payload';

const PASSWORD_HASH_ROUNDS = 12;
const SESSION_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.database.client.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);

    const result = await this.database.client.$transaction(async (tx) => {
      await ensureDefaultRoles(tx);

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: dto.name?.trim(),
        },
      });

      const agency = await tx.agency.create({
        data: {
          name: dto.agencyName.trim(),
          slug: `${slugify(dto.agencyName)}-${randomUUID().slice(0, 8)}`,
        },
      });

      const client = await tx.client.create({
        data: {
          agencyId: agency.id,
          name: dto.clientName.trim(),
          slug: `${slugify(dto.clientName)}-${randomUUID().slice(0, 8)}`,
        },
      });

      const store = await tx.store.create({
        data: {
          agencyId: agency.id,
          clientId: client.id,
          name: dto.storeName.trim(),
          slug: `${slugify(dto.storeName)}-${randomUUID().slice(0, 8)}`,
        },
      });

      const ownerRole = await tx.role.findUniqueOrThrow({ where: { key: 'owner' } });

      await tx.storeUser.create({
        data: {
          userId: user.id,
          storeId: store.id,
          roleId: ownerRole.id,
          joinedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: store.id,
          userId: user.id,
          agencyId: agency.id,
          clientId: client.id,
          storeId: store.id,
        action: 'register',
          entityType: 'User',
          entityId: user.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      return user;
    });

    return this.createSessionResponse(result.id, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.database.client.user.findUnique({ where: { email } });
    const passwordMatches = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;

    if (!user || !passwordMatches || !user.isActive) {
      await this.audit.write({
        userId: user?.id,
        action: 'login_failed',
        entityType: 'User',
        entityId: user?.id,
        metadata: { email },
        ...meta,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.database.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.write({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN,
      entityType: 'User',
      entityId: user.id,
      ...meta,
    });

    return this.createSessionResponse(user.id, meta);
  }

  async logout(input: { sessionId: string; userId: string }, meta: RequestMeta) {
    const session = await this.database.client.session.update({
      where: { id: input.sessionId },
      data: { revokedAt: new Date() },
    });

    await this.audit.write({
      tenantId: session.activeTenantId ?? undefined,
      userId: input.userId,
      storeId: session.activeTenantId ?? undefined,
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: 'Session',
      entityId: session.id,
      ...meta,
    });

    return { success: true };
  }

  async me(user: AuthenticatedRequestUser) {
    const [account, availableTenants] = await Promise.all([
      this.database.client.user.findUniqueOrThrow({
        where: { id: user.userId },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          twoFactorEnabled: true,
          lastLoginAt: true,
        },
      }),
      this.getAvailableTenants(user.userId),
    ]);

    const activeTenant = user.tenantId
      ? availableTenants.find((tenant) => tenant.tenantId === user.tenantId) ?? null
      : null;

    return {
      user: account,
      activeTenant,
      currentRole: activeTenant?.role ?? null,
      currentPermissions: activeTenant?.permissions ?? [],
      availableTenants,
    };
  }

  async tenants(userId: string) {
    return this.getAvailableTenants(userId);
  }

  async selectTenant(input: { userId: string; sessionId: string; tenantId: string }, meta: RequestMeta) {
    const tenant = await this.getTenantAccess(input.userId, input.tenantId);

    await this.database.client.session.update({
      where: { id: input.sessionId },
      data: { activeTenantId: tenant.tenantId },
    });

    await this.audit.write({
      tenantId: tenant.tenantId,
      userId: input.userId,
      agencyId: tenant.agencyId,
      clientId: tenant.clientId,
      storeId: tenant.tenantId,
      action: AUDIT_ACTIONS.TENANT_SWITCH,
      entityType: 'Store',
      entityId: tenant.tenantId,
      ...meta,
    });

    return {
      activeTenant: tenant,
    };
  }

  private async createSessionResponse(userId: string, meta: RequestMeta) {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRES_IN_MS);

    const session = await this.database.client.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const availableTenants = await this.getAvailableTenants(userId);

    return {
      token,
      tokenType: 'Bearer',
      expiresAt,
      sessionId: session.id,
      availableTenants,
    };
  }

  private async getAvailableTenants(userId: string): Promise<SessionTenantContext[]> {
    const accesses = await this.database.client.storeUser.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        store: {
          status: 'ACTIVE',
          client: {
            status: 'ACTIVE',
            agency: {
              status: 'ACTIVE',
            },
          },
        },
      },
      include: {
        store: {
          include: {
            client: {
              include: {
                agency: true,
              },
            },
          },
        },
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
      orderBy: {
        store: {
          name: 'asc',
        },
      },
    });

    return accesses.map((access) => ({
      tenantId: access.store.id,
      tenantName: access.store.name,
      agencyId: access.store.client.agency.id,
      agencyName: access.store.client.agency.name,
      clientId: access.store.client.id,
      clientName: access.store.client.name,
      role: access.role.name,
      permissions: access.role.permissions.map((item) => item.permission.key),
    }));
  }

  private async getTenantAccess(userId: string, tenantId: string) {
    const tenant = await this.getAvailableTenants(userId).then((tenants) =>
      tenants.find((item) => item.tenantId === tenantId),
    );

    if (!tenant) {
      throw new ForbiddenException('Tenant access denied');
    }

    return tenant;
  }
}
