import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto, SwitchTenantDto, RefreshDto, AuthResponseDto } from './dto/auth.dto';
import { isPlatformAdmin } from '../../common/constants/platform-admin';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    action: string,
    entityType: string,
    entityId: string,
    performedBy: string,
    agencyId?: string | null,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await tx.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          userId: performedBy,
          tenantId: agencyId || null,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
    agencyId: string,
    clientId: string | null = null,
    storeId: string | null = null,
    role: string = 'user',
    permissions: string[] = [],
  ) {
    const payload = {
      userId,
      email,
      tenantId: agencyId, // Multi-tenant context: agencyId represents the root tenant
      agencyId,
      clientId,
      storeId,
      role,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
    });

    const refreshToken = this.jwtService.sign(
      { userId, email, salt: crypto.randomBytes(16).toString('hex') },
      {
        expiresIn: '7d',
        secret: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
      },
    );

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto, ipAddress?: string): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: true,
          twoFactorEnabled: false,
        },
      });

      // 2. Create Agency with unique slug check
      let baseSlug = dto.agencyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!baseSlug) {
        baseSlug = 'agency';
      }
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existingAgency = await tx.agency.findFirst({
          where: { slug },
        });
        if (!existingAgency) {
          break;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const agency = await tx.agency.create({
        data: {
          name: dto.agencyName,
          slug,
          isActive: true,
        },
      });

      // 3. Create or find Super Admin role
      let superAdminRole = await tx.role.findUnique({
        where: { name: 'super_admin' },
      });

      if (!superAdminRole) {
        superAdminRole = await tx.role.create({
          data: {
            name: 'super_admin',
            description: 'Super administrator with full access',
          },
        });

        // Seed default permission
        await tx.permission.upsert({
          where: { name: '*:*' },
          update: {},
          create: {
            name: '*:*',
            description: 'Wildcard access permission',
            roles: {
              connect: { id: superAdminRole.id },
            },
          },
        });
      }

      // 4. Assign UserRole
      await tx.userRole.create({
        data: {
          userId: user.id,
          agencyId: agency.id,
          roleId: superAdminRole.id,
        },
      });

      // 5. Audit Log
      await this.writeAuditLog(
        tx,
        'register',
        'User',
        user.id,
        user.id,
        agency.id,
        ipAddress,
        { email: user.email, agencyName: agency.name },
      );

      return { user, agency, role: superAdminRole };
    });

    // 6. Generate tokens
    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.agency.id,
      null,
      null,
      result.role.name,
      ['*:*'],
    );

    // 7. Save sessions
    const tokenHash = this.hashToken(tokens.refreshToken);
    await this.prisma.session.create({
      data: {
        userId: result.user.id,
        tokenHash,
        ipAddress: ipAddress || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        tokenHash: await this.hashPassword(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName || undefined,
        lastName: result.user.lastName || undefined,
        isActive: result.user.isActive,
        twoFactorEnabled: result.user.twoFactorEnabled,
      },
      agencies: [
        {
          id: result.agency.id,
          publicId: result.agency.publicId,
          name: result.agency.name,
          role: result.role.name,
          clientId: null,
          storeId: null,
        },
      ],
    };
  }

  async login(dto: LoginDto, ipAddress?: string, deviceInfo?: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.verifyPassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      include: {
        agency: true,
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (userRoles.length === 0) {
      throw new UnauthorizedException('User has no tenant assignments');
    }

    const primaryUserRole = userRoles[0];
    const permissions = primaryUserRole.role.permissions.map((p) => p.name);

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      primaryUserRole.agencyId,
      primaryUserRole.clientId,
      primaryUserRole.storeId,
      primaryUserRole.role.name,
      permissions,
    );

    const tokenHash = this.hashToken(tokens.refreshToken);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceInfo: deviceInfo || null,
        ipAddress: ipAddress || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await this.hashPassword(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.writeAuditLog(
      this.prisma,
      'login',
      'User',
      user.id,
      user.id,
      primaryUserRole.agencyId,
      ipAddress,
      { email: user.email },
    );

    const { accessibleTenants } = await this.getMe(user.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        isActive: user.isActive,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      agencies: accessibleTenants,
    };
  }

  async logout(refreshToken: string, userId: string, ipAddress?: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.session.updateMany({
      where: {
        userId,
        tokenHash,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    await this.writeAuditLog(
      this.prisma,
      'logout',
      'User',
      userId,
      userId,
      null,
      ipAddress,
      { status: 'success' },
    );
  }

  async refreshTokens(refreshToken: string, ipAddress?: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
      });

      const userId = payload.userId || payload.sub;
      const tokenHash = this.hashToken(refreshToken);

      const session = await this.prisma.session.findFirst({
        where: {
          userId,
          tokenHash,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Session not found or expired');
      }

      const userRole = await this.prisma.userRole.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!userRole) {
        throw new UnauthorizedException('User has no active roles');
      }

      // Rotate session
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isActive: false },
      });

      const newTokens = await this.generateTokens(
        userId,
        payload.email,
        userRole.agencyId,
        userRole.clientId,
        userRole.storeId,
        userRole.role.name,
        userRole.role.permissions.map((p) => p.name),
      );

      const newHash = this.hashToken(newTokens.refreshToken);
      await this.prisma.session.create({
        data: {
          userId,
          tokenHash: newHash,
          ipAddress: ipAddress || null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await this.writeAuditLog(
        this.prisma,
        'refresh_token',
        'User',
        userId,
        userId,
        userRole.agencyId,
        ipAddress,
      );

      return newTokens;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async switchTenant(userId: string, dto: SwitchTenantDto, ipAddress?: string): Promise<{ accessToken: string; refreshToken: string }> {
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        agencyId: dto.agencyId,
        clientId: dto.clientId || undefined,
        storeId: dto.storeId || undefined,
        deletedAt: null,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!userRole) {
      throw new ForbiddenException('Access to the requested tenant context is denied');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(
      userId,
      user.email,
      dto.agencyId,
      dto.clientId || null,
      dto.storeId || null,
      userRole.role.name,
      userRole.role.permissions.map((p) => p.name),
    );

    const tokenHash = this.hashToken(tokens.refreshToken);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress: ipAddress || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.writeAuditLog(
      this.prisma,
      'switch_tenant',
      'User',
      userId,
      userId,
      dto.agencyId,
      ipAddress,
      { switchTarget: dto },
    );

    return tokens;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, deletedAt: null },
      include: {
        agency: {
          include: {
            stores: {
              where: { deletedAt: null },
            },
          },
        },
        role: true,
      },
    });

    const storeUsers = await this.prisma.storeUser.findMany({
      where: { userId, deletedAt: null },
      select: { storeId: true },
    });
    const allowedStoreIds = new Set(storeUsers.map((su) => su.storeId));
    const hasSpecificStoreRestrictions = allowedStoreIds.size > 0;

    const accessibleTenants: any[] = [];
    const addedIds = new Set<string>();

    for (const ur of userRoles) {
      if (ur.agency && !addedIds.has(ur.agency.id)) {
        addedIds.add(ur.agency.id);
        accessibleTenants.push({
          id: ur.agency.id,
          publicId: ur.agency.publicId || `tn_${ur.agency.id}`,
          name: ur.agency.name,
          type: 'agency',
          agencyId: ur.agency.id,
          clientId: null,
          storeId: null,
        });

        for (const store of ur.agency.stores || []) {
          if (hasSpecificStoreRestrictions && !allowedStoreIds.has(store.id)) {
            continue;
          }

          if (!addedIds.has(store.id)) {
            addedIds.add(store.id);
            accessibleTenants.push({
              id: store.id,
              publicId: store.publicId || `tn_${store.id}`,
              name: store.name,
              type: 'brand',
              agencyId: ur.agency.id,
              clientId: store.clientId || null,
              storeId: store.id,
            });
          }
        }
      }
    }

    // The UI needs the role to decide what to show; it is advisory only, every
    // protected route re-checks it server-side.
    const role = userRoles[0]?.role?.name ?? null;

    return {
      user: {
        ...user,
        role,
        isPlatformAdmin: isPlatformAdmin({ email: user.email, role }),
      },
      accessibleTenants,
    };
  }
}
