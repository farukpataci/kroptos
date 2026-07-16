import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedRequestUser } from '../types/jwt-payload';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedRequestUser }>();
    const user = request.user;

    if (!user?.tenantId) {
      throw new ForbiddenException('Active tenant is required');
    }

    const currentPermissions = new Set(user.permissions ?? []);

    if (user.role === 'owner' || currentPermissions.has('*')) {
      return true;
    }

    const allowed = requiredPermissions.every((permission) => currentPermissions.has(permission));

    if (!allowed) {
      throw new ForbiddenException('Missing required permission');
    }

    return true;
  }
}
