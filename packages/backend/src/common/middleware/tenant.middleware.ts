import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Public routes that don't require active Bearer access token
    const publicRoutes = [
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/refresh-token',
      '/api/docs',
      '/api-json',
      // Which build is serving: has to answer when something is already wrong,
      // including when authentication is what is broken. It returns a commit id
      // and process uptime — nothing a repository reader cannot already see.
      '/api/health',
      '/auth/register',
      '/auth/login',
      '/auth/refresh',
      '/auth/refresh-token',
    ];

    // Check if the current route is public (check path, originalUrl, and url)
    const currentPath = req.originalUrl?.split('?')[0] || req.path || req.url;
    const isPublic = publicRoutes.some((route) => currentPath === route || currentPath.startsWith(route));
    if (isPublic) {
      return next();
    }

    try {
      const reqAny = req as any;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedException('Missing authorization header');
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
      });

      // Extract details from JWT payload
      const userId = payload.userId || payload.sub;
      const tenantId = payload.tenantId;
      const tokenAgencyId = payload.agencyId;
      const tokenClientId = payload.clientId;
      const role = payload.role;
      const permissions = payload.permissions || [];

      if (!userId) {
        throw new UnauthorizedException('Invalid token payload: missing user identification');
      }

      // Attach user context to request
      reqAny.user = {
        userId,
        email: payload.email,
        tenantId,
        agencyId: tokenAgencyId,
        clientId: tokenClientId,
        role,
        permissions,
      };

      // Resolve requested resource IDs from headers or path parameters
      let agencyId = (req.headers['x-agency-id'] || req.headers['x-tenant-id']) as string;
      let clientId = req.headers['x-client-id'] as string;
      let storeId = req.headers['x-store-id'] as string;

      // Fallback: parse from URL path if headers are missing
      const pathParts = req.path.split('/');
      if (pathParts[1] === 'api' || pathParts[1] === '') {
        const offset = pathParts[1] === 'api' ? 2 : 1;
        const controller = pathParts[offset];
        const idSegment = pathParts[offset + 1];

        if (idSegment && idSegment !== 'create' && idSegment !== 'search' && !idSegment.includes('?')) {
          if (controller === 'agencies') {
            if (!agencyId) agencyId = idSegment;
          } else if (controller === 'clients') {
            if (!clientId) clientId = idSegment;
          } else if (controller === 'stores') {
            if (!storeId) storeId = idSegment;
          }
        }
      }

      // Translate agencyId / storeId to internal CUIDs and ensure storeId -> agencyId mapping
      if (agencyId) {
        const agencyRecord = await this.prisma.agency.findFirst({
          where: { OR: [{ id: agencyId }, { publicId: agencyId }], deletedAt: null },
        });
        if (agencyRecord) {
          agencyId = agencyRecord.id;
        } else {
          const storeRecord = await this.prisma.store.findFirst({
            where: { OR: [{ id: agencyId }, { publicId: agencyId }], deletedAt: null },
          });
          if (storeRecord) {
            storeId = storeRecord.id;
            agencyId = storeRecord.agencyId;
            clientId = storeRecord.clientId || clientId;
          }
        }
      }

      if (storeId) {
        const storeRecord = await this.prisma.store.findFirst({
          where: { OR: [{ id: storeId }, { publicId: storeId }], deletedAt: null },
        });
        if (storeRecord) {
          storeId = storeRecord.id;
          if (!agencyId) agencyId = storeRecord.agencyId;
          if (!clientId) clientId = storeRecord.clientId || clientId;
        }
      }

      const isSuper = role === 'super_admin' || role === 'Super Admin';

      // 1. Validate Store access if storeId is requested
      if (storeId) {
        const store = await this.prisma.store.findFirst({
          where: { id: storeId, deletedAt: null },
        });

        if (!store) {
          throw new ForbiddenException(`Store context '${storeId}' not found or soft-deleted.`);
        }

        // Prevent cross-agency context leakage
        if (tokenAgencyId && store.agencyId !== tokenAgencyId) {
          throw new ForbiddenException('Tenant context mismatch. Store does not belong to active agency.');
        }

        if (!isSuper) {
          const hasStoreUser = await this.prisma.storeUser.findFirst({
            where: { userId, storeId, deletedAt: null },
          });

          const hasUserRole = await this.prisma.userRole.findFirst({
            where: {
              userId,
              agencyId: store.agencyId,
              deletedAt: null,
              OR: [
                { storeId },
                { storeId: null, clientId: store.clientId },
                { storeId: null, clientId: null },
              ],
            },
          });

          if (!hasStoreUser && !hasUserRole) {
            throw new ForbiddenException(`Access denied. You do not have permission to access store '${storeId}'.`);
          }
        }

        reqAny.activeStore = store;

        if (store.clientId) {
          const client = await this.prisma.client.findFirst({
            where: { id: store.clientId, deletedAt: null },
          });
          if (client) reqAny.activeClient = client;
        }

        const agency = await this.prisma.agency.findFirst({
          where: { id: store.agencyId, deletedAt: null },
        });
        if (agency) reqAny.activeAgency = agency;

      // 2. Validate Client access if clientId is requested
      } else if (clientId) {
        const client = await this.prisma.client.findFirst({
          where: { id: clientId, deletedAt: null },
        });

        if (!client) {
          throw new ForbiddenException(`Client context '${clientId}' not found or soft-deleted.`);
        }

        if (tokenAgencyId && client.agencyId !== tokenAgencyId) {
          throw new ForbiddenException('Tenant context mismatch. Client does not belong to active agency.');
        }

        if (!isSuper) {
          const hasUserRole = await this.prisma.userRole.findFirst({
            where: {
              userId,
              agencyId: client.agencyId,
              deletedAt: null,
              OR: [
                { clientId },
                { clientId: null },
              ],
            },
          });

          if (!hasUserRole) {
            throw new ForbiddenException(`Access denied. You do not have permission to access client '${clientId}'.`);
          }
        }

        reqAny.activeClient = client;

        const agency = await this.prisma.agency.findFirst({
          where: { id: client.agencyId, deletedAt: null },
        });
        if (agency) reqAny.activeAgency = agency;

      // 3. Validate Agency access if agencyId is requested
      } else if (agencyId) {
        const agency = await this.prisma.agency.findFirst({
          where: { id: agencyId, deletedAt: null },
        });

        if (!agency) {
          throw new ForbiddenException(`Agency context '${agencyId}' not found or soft-deleted.`);
        }

        if (tokenAgencyId && agencyId !== tokenAgencyId) {
          throw new ForbiddenException('Tenant context mismatch. Access to requested agency is denied.');
        }

        if (!isSuper) {
          const hasUserRole = await this.prisma.userRole.findFirst({
            where: {
              userId,
              agencyId,
              deletedAt: null,
            },
          });

          if (!hasUserRole) {
            throw new ForbiddenException(`Access denied. You do not have permission to access agency '${agencyId}'.`);
          }
        }

        reqAny.activeAgency = agency;
      }

      next();
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
