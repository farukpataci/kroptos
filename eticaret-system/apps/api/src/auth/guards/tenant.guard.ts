import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedRequestUser, SessionTenantContext } from '../types/jwt-payload';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedRequestUser;
      tenant?: SessionTenantContext;
    }>();
    const user = request.user;

    if (!user?.tenantId) {
      throw new ForbiddenException('Active tenant is required');
    }

    const access = await this.database.client.storeUser.findFirst({
      where: {
        userId: user.userId,
        storeId: user.tenantId,
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
    });

    if (!access) {
      throw new ForbiddenException('Tenant access denied');
    }

    const permissions = access.role.permissions.map((item) => item.permission.key);
    request.tenant = {
      tenantId: access.store.id,
      tenantName: access.store.name,
      agencyId: access.store.client.agency.id,
      agencyName: access.store.client.agency.name,
      clientId: access.store.client.id,
      clientName: access.store.client.name,
      role: access.role.key,
      permissions,
    };
    request.user = {
      ...user,
      agencyId: access.store.client.agency.id,
      clientId: access.store.client.id,
      role: access.role.key,
      permissions,
    };

    return true;
  }
}
