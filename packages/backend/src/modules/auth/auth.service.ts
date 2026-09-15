import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto, SwitchTenantDto, RefreshDto, AuthResponseDto } from './dto/auth.dto';
import { isPlatformAdmin, isSuperAdminRole } from '../../common/constants/platform-admin';
import { resolvePrimaryRole } from '../../common/utils/primary-role';
import { buildUserRoleScopeWhere } from '../../common/utils/tenant-scope';
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
    role: { key: string; isSystem: boolean },
  ) {
    // permissions[] bilerek yok: izinler her istekte DB'den (PermissionCache)
    // okunur. Token'a gömülü izin, rol geri alındıktan sonra da geçerli kalıyordu.
    const payload = {
      userId,
      email,
      tenantId: agencyId, // Multi-tenant context: agencyId represents the root tenant
      agencyId,
      clientId,
      storeId,
      // Makine adi + sistem rolu mu: isSuperAdminRole ikisini birden ister (gorunen ad okunmaz).
      role: role.key,
      roleIsSystem: role.isSystem,
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

      // 3. Kayıt olan kullanıcı kendi ajansının SAHİBİDİR, platform yöneticisi
      // değil. Eskiden burada super_admin verilip (yoksa yaratılıp) '*:*'
      // bağlanıyordu: açık kayıt formu platform çapında tam yetki dağıtıyordu.
      // super_admin yalnız seed ile atanır; agency_owner seed'de yoksa sessizce
      // düşme, patla.
      const ownerRole = await tx.role.findFirst({ where: { key: 'agency_owner', agencyId: null, deletedAt: null } });
      if (!ownerRole) {
        throw new Error("Role 'agency_owner' not found — run prisma/seed.ts before registration");
      }

      // 4. Assign UserRole
      await tx.userRole.create({
        data: {
          userId: user.id,
          agencyId: agency.id,
          roleId: ownerRole.id,
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

      return { user, agency, role: ownerRole };
    });

    // 6. Generate tokens
    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.agency.id,
      null,
      null,
      result.role,
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
          role: result.role.key,
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
        role: true,
      },
    });

    if (userRoles.length === 0) {
      throw new UnauthorizedException('User has no tenant assignments');
    }

    const primaryUserRole = resolvePrimaryRole(userRoles)!;

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      primaryUserRole.agencyId,
      primaryUserRole.clientId,
      primaryUserRole.storeId,
      primaryUserRole.role,
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

      const userRole = resolvePrimaryRole(
        await this.prisma.userRole.findMany({
          where: {
            userId,
            deletedAt: null,
          },
          include: { role: true },
        }),
      );

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
        userRole.role,
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
    // İstenen bağlamı DB'den çöz; istemcinin gönderdiği clientId'ye güvenme.
    // Mağaza verilmişse gerçek clientId mağaza kaydından gelir ve mağazanın
    // hedef ajansa ait olduğu da böylece doğrulanmış olur.
    const requestedStoreId = dto.storeId || null;
    let requestedClientId = dto.clientId || null;

    if (requestedStoreId) {
      const store = await this.prisma.store.findFirst({
        where: { id: requestedStoreId, agencyId: dto.agencyId, deletedAt: null },
        select: { clientId: true },
      });
      if (!store) {
        throw new ForbiddenException('Access to the requested tenant context is denied');
      }
      requestedClientId = store.clientId ?? null;
    } else if (requestedClientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: requestedClientId, agencyId: dto.agencyId, deletedAt: null },
        select: { id: true },
      });
      if (!client) {
        throw new ForbiddenException('Access to the requested tenant context is denied');
      }
    }

    // Bir rol istenen bağlamı KAPSIYORSA geçiş yetkilidir. Kapsama semantiği
    // PermissionGuard ve TenantMiddleware ile aynı: buildUserRoleScopeWhere.
    const candidates = await this.prisma.userRole.findMany({
      where: buildUserRoleScopeWhere({
        userId,
        agencyId: dto.agencyId,
        clientId: requestedClientId,
        storeId: requestedStoreId,
      }),
      include: { role: true },
    });

    if (candidates.length === 0) {
      throw new ForbiddenException('Access to the requested tenant context is denied');
    }

    // Birden fazla rol aynı bağlamı kapsayabilir (ör. hem ajans geneli hem
    // mağaza kapsamlı). En özel olan kazanır; seçim kuralı resolvePrimaryRole'da.
    const userRole = resolvePrimaryRole(candidates, {
      agencyId: dto.agencyId,
      clientId: requestedClientId,
      storeId: requestedStoreId,
    })!;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(
      userId,
      user.email,
      dto.agencyId,
      requestedClientId,
      requestedStoreId,
      userRole.role,
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
      // Çözülmüş bağlamı logla, istemcinin gönderdiğini değil: token bununla üretildi.
      { switchTarget: { agencyId: dto.agencyId, clientId: requestedClientId, storeId: requestedStoreId } },
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
        agency: { include: { stores: { where: { deletedAt: null } } } },
        client: { select: { id: true, name: true } },
        role: true,
      },
    });

    const storeUsers = await this.prisma.storeUser.findMany({
      where: { userId, deletedAt: null, store: { deletedAt: null } },
      include: { store: { include: { agency: true } } },
    });

    // Girdi = kullanıcının GERÇEKTEN geçebileceği bağlam (switchTenant ve
    // TenantMiddleware'in kapsama kuralıyla aynı). Ajans girdisi yalnız ajans
    // geneli rolle çıkar: mağaza kapsamlı kullanıcıya ajans girdisi verilince
    // login onu varsayılan seçiyor, her istek 403'e düşüyor ve /auth/me 403'ü
    // oturumu siliyordu (P2.5 ★).
    type Entry = {
      id: string; publicId: string | null; name: string; type: 'agency' | 'client' | 'brand';
      agencyId: string; clientId: string | null; storeId: string | null;
    };
    const agencies = new Map<string, Entry>();
    const clients = new Map<string, Entry>();
    const stores = new Map<string, Entry>();
    const brand = (store: { id: string; publicId: string | null; name: string; agencyId: string; clientId: string | null }): Entry => ({
      id: store.id,
      publicId: store.publicId || `tn_${store.id}`,
      name: store.name,
      type: 'brand',
      agencyId: store.agencyId,
      clientId: store.clientId || null,
      storeId: store.id,
    });
    // Ajans geneli rol + StoreUser kısıtı birlikteyse yalnız kısıttaki mağazalar (eski davranış korunur).
    const restrictedTo = new Set(storeUsers.map((su) => su.storeId));

    for (const ur of userRoles) {
      const agency = ur.agency;
      const agencyStores = agency.stores ?? [];
      const agencyWide = (!ur.clientId && !ur.storeId) || isSuperAdminRole({ role: ur.role.key, roleIsSystem: ur.role.isSystem });
      if (agencyWide) {
        agencies.set(agency.id, {
          id: agency.id,
          publicId: agency.publicId || `tn_${agency.id}`,
          name: agency.name,
          type: 'agency',
          agencyId: agency.id,
          clientId: null,
          storeId: null,
        });
        for (const s of agencyStores) {
          if (restrictedTo.size > 0 && !restrictedTo.has(s.id)) continue;
          stores.set(s.id, brand(s));
        }
      } else if (ur.storeId) {
        const s = agencyStores.find((x) => x.id === ur.storeId);
        if (s) stores.set(s.id, brand(s));
      } else if (ur.clientId && ur.client) {
        // Client'ın publicId'si yok; UI bugün client bağlamına geçiş sunmuyor, girdi ileriye dönük.
        clients.set(ur.client.id, {
          id: ur.client.id,
          publicId: null,
          name: ur.client.name,
          type: 'client',
          agencyId: agency.id,
          clientId: ur.client.id,
          storeId: null,
        });
        for (const s of agencyStores) if (s.clientId === ur.clientId) stores.set(s.id, brand(s));
      }
    }
    for (const su of storeUsers) stores.set(su.store.id, brand(su.store));

    const accessibleTenants: Entry[] = [...agencies.values(), ...clients.values(), ...stores.values()];
    if (accessibleTenants.length === 0) {
      console.warn(
        `[getMe] user ${user.email} has no accessible tenant: roles=${JSON.stringify(
          userRoles.map((ur) => ({ role: ur.role.key, agencyId: ur.agencyId, clientId: ur.clientId, storeId: ur.storeId })),
        )} storeUsers=${storeUsers.length}`,
      );
    }

    // The UI needs the role to decide what to show; it is advisory only, every
    // protected route re-checks it server-side.
    const primary = resolvePrimaryRole(userRoles)?.role;
    const role = primary?.key ?? null;

    return {
      user: {
        ...user,
        role,
        isPlatformAdmin: isPlatformAdmin({ email: user.email, role, roleIsSystem: primary?.isSystem ?? false }),
      },
      accessibleTenants,
    };
  }
}
