import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.body?.refreshToken || req?.headers?.authorization?.replace('Bearer ', '');
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req.body?.refreshToken || req.headers.authorization?.replace('Bearer ', '');
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    return {
      userId: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      agencyId: payload.agencyId,
      clientId: payload.clientId,
      role: payload.role,
      permissions: payload.permissions || [],
      refreshToken,
    };
  }
}
