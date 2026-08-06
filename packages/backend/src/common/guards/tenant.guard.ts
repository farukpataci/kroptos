import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    // Super Admin has system-wide access bypass
    if (user.role === 'super_admin' || user.role === 'Super Admin') {
      return true;
    }

    // Extract tenantPublicId from URL parameters, query parameters, or headers
    const tenantPublicId =
      request.params.tenantPublicId ||
      request.query.tenantPublicId ||
      request.headers['x-tenant-id'];

    if (!tenantPublicId) {
      // Default to allowed access if request context does not require isolated tenant check
      return true;
    }

    // Resolve Agency (Tenant) or Store database record by publicId
    let agency = await this.prisma.agency.findFirst({
      where: { publicId: tenantPublicId, deletedAt: null },
    });

    if (!agency) {
      const store = await this.prisma.store.findFirst({
        where: { publicId: tenantPublicId, deletedAt: null },
        include: { agency: true },
      });
      if (store && store.agency) {
        agency = store.agency;
      }
    }

    if (!agency) {
      throw new ForbiddenException('Invalid tenant identifier');
    }

    // Validate if the authenticated user has an active membership role in the requested agency
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.userId,
        agencyId: agency.id,
        deletedAt: null,
      },
    });

    if (!userRole) {
      throw new ForbiddenException('Access denied. You do not have permissions for this tenant.');
    }

    // Attach resolved internal tenant entity to request context
    request.tenant = agency;

    return true;
  }
}
