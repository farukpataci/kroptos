import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermission = this.reflector.getAllAndOverride<string>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    // 1. Validate Roles if defined
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied. Required roles: [${requiredRoles.join(', ')}]. Current role: ${user.role}`,
        );
      }
    }

    // 2. Validate Permissions if defined
    if (requiredPermission) {
      const userPermissions = user.permissions || [];
      const hasPermission =
        userPermissions.includes(requiredPermission) ||
        userPermissions.includes('*:*') ||
        user.role === 'super_admin' ||
        user.role === 'Super Admin';
      if (!hasPermission) {
        throw new ForbiddenException(`Access denied. Missing permission: ${requiredPermission}`);
      }
    }

    return true;
  }
}
