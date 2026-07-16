import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      agencyId: payload.agencyId,
      clientId: payload.clientId,
      role: payload.role,
      permissions: payload.permissions || [],
    };
  }
}
