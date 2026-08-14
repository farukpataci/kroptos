import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrismaService: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    agency: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
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
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'role-id',
        name: 'super_admin',
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
          role: { id: 'role-id', name: 'super_admin', permissions: [{ name: '*:*' }] },
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
      mockPrismaService.userRole.findFirst.mockResolvedValue({
        agencyId: 'agency-id',
        clientId: null,
        storeId: null,
        role: { name: 'super_admin', permissions: [{ name: '*:*' }] },
      });

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

  describe('switchTenant', () => {
    const agencyWideRole = {
      agencyId: 'new-agency-id',
      clientId: null,
      storeId: null,
      role: { name: 'agency_owner', permissions: [{ name: 'orders.read' }] },
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
          role: { name: 'client_admin', permissions: [{ name: 'orders.read' }] },
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
          role: { name: 'store_manager', permissions: [{ name: 'products.read' }] },
        },
      ]);

      await service.switchTenant('user-id', { agencyId: 'new-agency-id', storeId: 'store-id' });

      const signedPayload: any = (mockJwtService.sign as jest.Mock).mock.calls[0]?.[0];
      expect(signedPayload.role).toBe('store_manager');
      expect(signedPayload.permissions).toEqual(['products.read']);
    });
  });
});
