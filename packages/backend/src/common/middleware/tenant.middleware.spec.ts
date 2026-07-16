import { Test, TestingModule } from '@nestjs/testing';
import { TenantMiddleware } from './tenant.middleware';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let jwtService: JwtService;
  let prisma: PrismaService;

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockPrismaService: any = {
    store: {
      findFirst: jest.fn(),
    },
    storeUser: {
      findFirst: jest.fn(),
    },
    userRole: {
      findFirst: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    agency: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    middleware = module.get<TenantMiddleware>(TenantMiddleware);
    jwtService = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should bypass validation for public routes', async () => {
    const req: any = { path: '/api/auth/login' };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockJwtService.verify).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if authorization header is missing', async () => {
    const req: any = { path: '/api/protected', headers: {} };
    const res: any = {};
    const next = jest.fn();

    await expect(middleware.use(req, res, next)).rejects.toThrow(UnauthorizedException);
  });

  it('should validate JWT and inject user role/permissions context', async () => {
    const req: any = {
      path: '/api/protected',
      headers: { authorization: 'Bearer valid-token' },
    };
    const res: any = {};
    const next = jest.fn();

    mockJwtService.verify.mockReturnValue({
      userId: 'user-1',
      agencyId: 'agency-1',
      role: 'viewer',
      permissions: ['orders.read'],
    });

    await middleware.use(req, res, next);

    expect(req.user).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        agencyId: 'agency-1',
        role: 'viewer',
      }),
    );
    expect(next).toHaveBeenCalled();
  });

  describe('Agency Access Validation', () => {
    it('should throw ForbiddenException if agency not found', async () => {
      const req: any = {
        path: '/api/agencies/invalid-agency-id',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res: any = {};
      const next = jest.fn();

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        agencyId: 'agency-1', // active token agency
        role: 'viewer',
      });
      mockPrismaService.agency.findFirst.mockResolvedValue(null);

      await expect(middleware.use(req, res, next)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has no role in the requested agency', async () => {
      const req: any = {
        path: '/api/agencies/agency-2',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res: any = {};
      const next = jest.fn();

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        agencyId: 'agency-2', // token has agency-2
        role: 'viewer',
      });
      mockPrismaService.agency.findFirst.mockResolvedValue({ id: 'agency-2', name: 'Agency 2' });
      // DB check returns null (no role mapping)
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(middleware.use(req, res, next)).rejects.toThrow(ForbiddenException);
    });

    it('should allow access and inject activeAgency if user has role', async () => {
      const req: any = {
        path: '/api/agencies/agency-1',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res: any = {};
      const next = jest.fn();

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        agencyId: 'agency-1',
        role: 'viewer',
      });
      const mockAgency = { id: 'agency-1', name: 'Agency 1' };
      mockPrismaService.agency.findFirst.mockResolvedValue(mockAgency);
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });

      await middleware.use(req, res, next);

      expect(req.activeAgency).toEqual(mockAgency);
      expect(next).toHaveBeenCalled();
    });

    it('should bypass DB check for super admin but still inject activeAgency', async () => {
      const req: any = {
        path: '/api/agencies/agency-1',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res: any = {};
      const next = jest.fn();

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        agencyId: 'agency-1',
        role: 'super_admin',
      });
      const mockAgency = { id: 'agency-1', name: 'Agency 1' };
      mockPrismaService.agency.findFirst.mockResolvedValue(mockAgency);

      await middleware.use(req, res, next);

      expect(req.activeAgency).toEqual(mockAgency);
      expect(mockPrismaService.userRole.findFirst).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Client Access Validation', () => {
    it('should throw ForbiddenException if client does not belong to active agency', async () => {
      const req: any = {
        path: '/api/clients/client-1',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res: any = {};
      const next = jest.fn();

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        agencyId: 'agency-active',
        role: 'viewer',
      });
      // Client belongs to a different agency
      mockPrismaService.client.findFirst.mockResolvedValue({ id: 'client-1', agencyId: 'agency-other' });

      await expect(middleware.use(req, res, next)).rejects.toThrow(ForbiddenException);
    });

    it('should allow access and inject context if user is client_admin for that client', async () => {
      const req: any = {
        path: '/api/clients/client-1',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res: any = {};
      const next = jest.fn();

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        agencyId: 'agency-1',
        role: 'client_admin',
      });
      
      const mockClient = { id: 'client-1', agencyId: 'agency-1' };
      const mockAgency = { id: 'agency-1', name: 'Agency 1' };
      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.agency.findFirst.mockResolvedValue(mockAgency);
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'ur-1' });

      await middleware.use(req, res, next);

      expect(req.activeClient).toEqual(mockClient);
      expect(req.activeAgency).toEqual(mockAgency);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Store Access Validation', () => {
    it('should allow access via StoreUser direct mapping', async () => {
      const req: any = {
        path: '/api/stores/store-1',
        headers: { authorization: 'Bearer valid-token' },
      };
      const res: any = {};
      const next = jest.fn();

      mockJwtService.verify.mockReturnValue({
        userId: 'user-1',
        agencyId: 'agency-1',
        role: 'store_manager',
      });

      const mockStore = { id: 'store-1', agencyId: 'agency-1', clientId: 'client-1' };
      const mockClient = { id: 'client-1', agencyId: 'agency-1' };
      const mockAgency = { id: 'agency-1' };

      mockPrismaService.store.findFirst.mockResolvedValue(mockStore);
      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.agency.findFirst.mockResolvedValue(mockAgency);
      // UserRole returns null, but StoreUser returns active mapping
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);
      mockPrismaService.storeUser.findFirst.mockResolvedValue({ id: 'su-1' });

      await middleware.use(req, res, next);

      expect(req.activeStore).toEqual(mockStore);
      expect(req.activeClient).toEqual(mockClient);
      expect(req.activeAgency).toEqual(mockAgency);
      expect(next).toHaveBeenCalled();
    });
  });
});
