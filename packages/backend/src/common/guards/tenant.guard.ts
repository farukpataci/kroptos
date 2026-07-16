import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { agencyId } = request.params;
    const { userId } = request.user;

    if (!agencyId) {
      throw new ForbiddenException('Missing agency context');
    }

    // Verify user has access to this agency
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        agencyId,
        deletedAt: null,
      },
    });

    if (!userRole) {
      throw new ForbiddenException(
        `User does not have access to agency ${agencyId}`
      );
    }

    request['validatedTenantId'] = agencyId;
    request['userRole'] = userRole;

    return true;
  }
}
