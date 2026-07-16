import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedRequestUser } from '../types/jwt-payload';

function extractBearerToken(authorization?: string) {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedRequestUser;
      sessionToken?: string;
    }>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const tokenHash = hashSessionToken(token);
    const session = await this.database.client.session.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        activeTenant: {
          include: {
            client: {
              include: {
                agency: true,
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.sessionToken = token;
    request.user = {
      userId: session.userId,
      sessionId: session.id,
      email: session.user.email,
      tenantId: session.activeTenantId,
      agencyId: session.activeTenant?.client.agency.id ?? null,
      clientId: session.activeTenant?.client.id ?? null,
      role: null,
      permissions: [],
    };

    return true;
  }
}
