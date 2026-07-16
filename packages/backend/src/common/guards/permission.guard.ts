import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = (request as any).user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    // Super Admin bypass
    if (user.role === 'super_admin' || user.role === 'Super Admin') {
      return true;
    }

    // Dynamic database check for active tenant role & permissions to ensure real-time enforcement
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.userId,
        agencyId: user.agencyId,
        clientId: user.clientId || null,
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
      throw new ForbiddenException('Access denied. No active role in the current tenant context.');
    }

    const hasPermission = userRole.role.permissions.some(
      (p) => p.name === requiredPermission || p.name === '*:*',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`Access denied. Missing permission: ${requiredPermission}`);
    }

    return true;
  }
}
