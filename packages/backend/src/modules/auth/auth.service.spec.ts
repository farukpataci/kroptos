import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PermissionCacheService } from '@common/services/permission-cache.service';
import { BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrismaService: any = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'user-id' }),
      create: jest.fn(),
    },
    agency: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    store: {
      findFirst: jest.fn(),
    },
    // `getMe` reads these to work out whether the user is pinned to specific
    // stores; an empty list means "no store restriction", which is what the
    // login cases below assume.
    storeUser: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockPermissionCache = { getPermissions: jest.fn().mockResolvedValue(['orders.read']), invalidateUser: jest.fn() };

  const mockJwtService = {
    sign: jest.fn(() => 'mock-jwt-token'),
    verify: jest.fn().mockImplementation(() => ({ userId: 'user-1', email: 'test@example.com', tenantId: 'agency-1', role: 'super_admin' })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PermissionCacheService, useValue: mockPermissionCache },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
    mockPrismaService.user.findFirst.mockResolvedValue({ id: 'user-id' }); // refresh: hesap aktif mi (P11)
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw BadRequestException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe',
          agencyName: 'Agency Inc',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user, agency, role, and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.agency.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        twoFactorEnabled: false,
      });
      mockPrismaService.agency.create.mockResolvedValue({
        id: 'new-agency-id',
        name: 'Agency Inc',
      });
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'owner-role-id',
        key: 'agency_owner',
        isSystem: true,
        permissions: [{ name: 'agencies.read' }, { name: 'clients.create' }],
      });

      const response = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        agencyName: 'Agency Inc',
      });

      expect(response).toHaveProperty('accessToken');
      expect(response).toHaveProperty('refreshToken');
      expect(response.user.email).toBe('test@example.com');
      expect(response.agencies[0].name).toBe('Agency Inc');
      expect(mockPrismaService.session.create).toHaveBeenCalled();
    });

    it('assigns agency_owner (never super_admin) and never creates a role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.agency.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.c', isActive: true });
      mockPrismaService.agency.create.mockResolvedValue({ id: 'ag1', name: 'A' });
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'owner-role-id',
        key: 'agency_owner',
        isSystem: true,
        permissions: [{ name: 'agencies.read' }],
      });

      const response = await service.register({
        email: 'a@b.c',
        password: 'Password123!',
        firstName: 'A',
        lastName: 'B',
        agencyName: 'A',
      });

      expect(mockPrismaService.role.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'agency_owner', agencyId: null, deletedAt: null } }),
      );
      expect(mockPrismaService.role.create).not.toHaveBeenCalled();
      expect(mockPrismaService.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'u1', agencyId: 'ag1', roleId: 'owner-role-id' },
      });
      expect(response.agencies[0].role).toBe('agency_owner');
      const signedPayload: any = (mockJwtService.sign as jest.Mock).mock.calls[0]?.[0];
      expect(signedPayload.role).toBe('agency_owner');
      // izinler artık token'da değil (P2): guard DB'den okur
      expect(signedPayload.permissions).toBeUndefined();
    });

    it('fails loudly when agency_owner is missing instead of falling back to super_admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.agency.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
      mockPrismaService.agency.create.mockResolvedValue({ id: 'ag1', name: 'A' });
      mockPrismaService.role.findFirst.mockResolvedValue(null);

      await expect(
        service.register({ email: 'a@b.c', password: 'Password123!', firstName: 'A', lastName: 'B', agencyName: 'A' }),
      ).rejects.toThrow("Role 'agency_owner' not found");
      expect(mockPrismaService.role.create).not.toHaveBeenCalled();
      expect(mockPrismaService.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'notfound@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login and return tokens', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash,
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        twoFactorEnabled: false,
      });

      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          agencyId: 'agency-id',
          clientId: null,
          storeId: null,
          agency: { id: 'agency-id', name: 'Agency Inc' },
          role: { id: 'role-id', key: 'super_admin', isSystem: true, permissions: [{ name: '*:*' }] },
        },
      ]);

      const response = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(response).toHaveProperty('accessToken');
      expect(response).toHaveProperty('refreshToken');
      expect(response.user.email).toBe('test@example.com');
      expect(mockPrismaService.session.create).toHaveBeenCalled();
    });

    it('picks the primary role by priority, not by row order', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash,
        isActive: true,
      });
      // DB sırası: viewer önce geliyor; eski kod userRoles[0] ile viewer token'ı basardı.
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          agencyId: 'agency-b',
          clientId: null,
          storeId: null,
          createdAt: new Date('2026-01-01'),
          agency: { id: 'agency-b', name: 'B', stores: [] },
          role: { id: 'r-viewer', key: 'viewer', isSystem: true, permissions: [{ name: 'orders.read' }] },
        },
        {
          agencyId: 'agency-a',
          clientId: null,
          storeId: null,
          createdAt: new Date('2026-02-01'),
          agency: { id: 'agency-a', name: 'A', stores: [] },
          role: { id: 'r-owner', key: 'agency_owner', isSystem: true, permissions: [{ name: 'clients.create' }] },
        },
      ]);

      await service.login({ email: 'test@example.com', password: 'Password123!' });

      const signedPayload: any = (mockJwtService.sign as jest.Mock).mock.calls[0]?.[0];
      expect(signedPayload.agencyId).toBe('agency-a');
      expect(signedPayload.role).toBe('agency_owner');
      expect(signedPayload.permissions).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('should deactivate the active session', async () => {
      await service.logout('some-refresh-token', 'user-id');
      expect(mockPrismaService.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          tokenHash: expect.any(String),
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException if session is not active', async () => {
      mockJwtService.verify.mockReturnValue({ userId: 'user-id', email: 'test@example.com' });
      mockPrismaService.session.findFirst.mockResolvedValue(null);

      await expect(service.refreshTokens('expired-refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should rotate refresh token and issue new access token', async () => {
      mockJwtService.verify.mockReturnValue({ userId: 'user-id', email: 'test@example.com' });
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        isActive: true,
      });
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          agencyId: 'agency-id',
          clientId: null,
          storeId: null,
          role: { key: 'super_admin', isSystem: true, permissions: [{ name: '*:*' }] },
        },
      ]);

      const response = await service.refreshTokens('valid-refresh-token');

      expect(response).toHaveProperty('accessToken');
      expect(response).toHaveProperty('refreshToken');
      expect(mockPrismaService.session.update).toHaveBeenCalledWith({
        where: { id: 'session-id' },
        data: { isActive: false },
      });
      expect(mockPrismaService.session.create).toHaveBeenCalled();
    });
  });

  describe('getMe accessibleTenants', () => {
    const agency = {
      id: 'agency-1',
      publicId: 'tn_a1',
      name: 'Agency',
      stores: [
        { id: 's1', publicId: 'tn_s1', name: 'S1', agencyId: 'agency-1', clientId: 'c1' },
        { id: 's2', publicId: 'tn_s2', name: 'S2', agencyId: 'agency-1', clientId: null },
      ],
    };
    const meUser = { id: 'user-id', email: 'u@x.y', isActive: true };
    const storeRole = { agencyId: 'agency-1', clientId: null, storeId: 's1', agency, client: null, role: { key: 'store_manager', isSystem: true } };
    const agencyRole = { agencyId: 'agency-1', clientId: null, storeId: null, agency, client: null, role: { key: 'agency_owner', isSystem: true } };
    const clientRole = { agencyId: 'agency-1', clientId: 'c1', storeId: null, agency, client: { id: 'c1', name: 'C1' }, role: { key: 'client_admin', isSystem: true } };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(meUser);
      mockPrismaService.storeUser.findMany.mockResolvedValue([]);
    });

    it('store-scoped only: NO agency entry, only that store', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([storeRole]);
      const { accessibleTenants } = await service.getMe('user-id');
      expect(accessibleTenants.map((t: any) => t.type)).toEqual(['brand']);
      expect(accessibleTenants[0]).toMatchObject({ id: 's1', agencyId: 'agency-1', clientId: 'c1', storeId: 's1' });
    });

    it('agency-wide + store-scoped: agency entry and every store', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([storeRole, agencyRole]);
      const { accessibleTenants } = await service.getMe('user-id');
      expect(accessibleTenants.map((t: any) => `${t.type}:${t.id}`)).toEqual(['agency:agency-1', 'brand:s1', 'brand:s2']);
    });

    it('client-scoped: client entry plus only that client\'s stores', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([clientRole]);
      const { accessibleTenants } = await service.getMe('user-id');
      expect(accessibleTenants.map((t: any) => `${t.type}:${t.id}`)).toEqual(['client:c1', 'brand:s1']);
      expect(accessibleTenants[0]).toMatchObject({ agencyId: 'agency-1', clientId: 'c1', storeId: null });
    });

    it('StoreUser rows are unioned with UserRole.storeId', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([storeRole]);
      mockPrismaService.storeUser.findMany.mockResolvedValue([{ storeId: 's2', store: { ...agency.stores[1], agency } }]);
      const { accessibleTenants } = await service.getMe('user-id');
      expect(accessibleTenants.map((t: any) => `${t.type}:${t.id}`)).toEqual(['brand:s1', 'brand:s2']);
    });

    it('agency-wide role with StoreUser restriction lists only the allowed stores (old behaviour kept)', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([agencyRole]);
      mockPrismaService.storeUser.findMany.mockResolvedValue([{ storeId: 's2', store: { ...agency.stores[1], agency } }]);
      const { accessibleTenants } = await service.getMe('user-id');
      expect(accessibleTenants.map((t: any) => `${t.type}:${t.id}`)).toEqual(['agency:agency-1', 'brand:s2']);
    });
  });

  describe('switchTenant', () => {
    const agencyWideRole = {
      agencyId: 'new-agency-id',
      clientId: null,
      storeId: null,
      role: { key: 'agency_owner', isSystem: true, permissions: [{ name: 'orders.read' }] },
    };

    it('should throw ForbiddenException if user has no access to target tenant', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([]);

      await expect(
        service.switchTenant('user-id', {
          agencyId: 'unauthorized-agency-id',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should generate new tokens with updated tenant context', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
      mockPrismaService.client.findFirst.mockResolvedValue({ id: 'client-id' });
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          agencyId: 'new-agency-id',
          clientId: 'client-id',
          storeId: null,
          role: { key: 'client_admin', isSystem: true, permissions: [{ name: 'orders.read' }] },
        },
      ]);

      const response = await service.switchTenant('user-id', {
        agencyId: 'new-agency-id',
        clientId: 'client-id',
      });

      expect(response).toHaveProperty('accessToken');
      expect(response).toHaveProperty('refreshToken');
      expect(mockPrismaService.session.create).toHaveBeenCalled();
    });

    // Daraltma yonu: ajans geneli baglam istenirse YALNIZCA ajans geneli bir rol
    // kapsar. Eski sorgu `clientId/storeId: dto.X || undefined` yazdigi icin bu
    // durumda filtreyi tamamen kaldiriyor, magaza kapsamli bir rolun ajans
    // geneli token almasina izin veriyordu.
    it('should only accept an agency-wide role when switching to agency scope', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
      mockPrismaService.userRole.findMany.mockResolvedValue([agencyWideRole]);

      await service.switchTenant('user-id', { agencyId: 'new-agency-id' });

      const where = mockPrismaService.userRole.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ clientId: null, storeId: null }]);
      expect(mockPrismaService.store.findFirst).not.toHaveBeenCalled();
    });

    // Gevsetme yonu: magaza baglami istenirse ajans geneli rol de kapsar.
    // Eski sorgu TAM eslesme aradigi icin marka gecisi 403 veriyordu.
    it('should accept an agency-wide role when switching to a store in that agency', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
      mockPrismaService.store.findFirst.mockResolvedValue({ clientId: null });
      mockPrismaService.userRole.findMany.mockResolvedValue([agencyWideRole]);

      const response = await service.switchTenant('user-id', {
        agencyId: 'new-agency-id',
        storeId: 'store-id',
      });

      const where = mockPrismaService.userRole.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ clientId: null, storeId: null }, { storeId: 'store-id' }]);
      expect(response).toHaveProperty('accessToken');
    });

    it('should reject a store that does not belong to the requested agency', async () => {
      mockPrismaService.store.findFirst.mockResolvedValue(null);

      await expect(
        service.switchTenant('user-id', { agencyId: 'new-agency-id', storeId: 'foreign-store-id' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.userRole.findMany).not.toHaveBeenCalled();
    });

    // Birden fazla rol ayni baglami kapsayabilir; token en OZEL rolun izinlerini
    // almali, findMany'nin dondurdugu rastgele ilk satirinkini degil.
    it('should pick the most specific covering role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
      mockPrismaService.store.findFirst.mockResolvedValue({ clientId: null });
      mockPrismaService.userRole.findMany.mockResolvedValue([
        agencyWideRole,
        {
          agencyId: 'new-agency-id',
          clientId: null,
          storeId: 'store-id',
          role: { key: 'store_manager', isSystem: true, permissions: [{ name: 'products.read' }] },
        },
      ]);

      await service.switchTenant('user-id', { agencyId: 'new-agency-id', storeId: 'store-id' });

      const signedPayload: any = (mockJwtService.sign as jest.Mock).mock.calls[0]?.[0];
      expect(signedPayload.role).toBe('store_manager');
      expect(signedPayload.permissions).toBeUndefined();
    });
  });
});

describe('AuthService.getMe permissions (P10)', () => {
  it('returns permissions for the active scope and for every accessible tenant; never in the JWT', async () => {
    const perms = { getPermissions: jest.fn(async (s: any) => (s.storeId ? ['products.read'] : ['orders.read', 'clients.create'])), invalidateUser: jest.fn() };
    const agency = { id: 'a1', publicId: 'tn_a1', name: 'A', stores: [{ id: 's1', publicId: 'tn_s1', name: 'S1', agencyId: 'a1', clientId: null }] };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'u@x.y', isActive: true }) },
      userRole: { findMany: jest.fn().mockResolvedValue([{ agencyId: 'a1', clientId: null, storeId: null, agency, client: null, role: { key: 'agency_owner', isSystem: true } }]) },
      storeUser: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new AuthService(prisma, { sign: jest.fn(() => 'tok') } as any, perms as any);

    const me = await svc.getMe('u1', { agencyId: 'a1', storeId: 's1' });
    expect(me.user.permissions).toEqual(['products.read']); // aktif baglam = magaza
    expect(me.accessibleTenants.map((t: any) => `${t.type}:${t.permissions.join('|')}`)).toEqual(['agency:orders.read|clients.create', 'brand:products.read']);
    expect(perms.getPermissions).toHaveBeenCalledWith({ userId: 'u1', agencyId: 'a1', clientId: null, storeId: 's1' });

    // baglam verilmezse birincil rolun kapsami
    const me2 = await svc.getMe('u1');
    expect(me2.user.permissions).toEqual(['orders.read', 'clients.create']);
  });
});

describe('AuthService.refreshTokens (P11)', () => {
  it('refuses to mint a new access token for a deactivated user', async () => {
    const prisma: any = {
      session: { findFirst: jest.fn().mockResolvedValue({ id: 's1', userId: 'u1', isActive: true }), update: jest.fn(), create: jest.fn() },
      user: { findFirst: jest.fn().mockResolvedValue(null) }, // isActive=false → null
      userRole: { findMany: jest.fn() },
      refreshToken: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const jwt: any = { verify: jest.fn(() => ({ userId: 'u1', email: 'u@x.y' })), sign: jest.fn(() => 't') };
    const svc = new AuthService(prisma, jwt, { getPermissions: jest.fn() } as any);
    await expect(svc.refreshTokens('rt')).rejects.toThrow(UnauthorizedException);
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });
});
