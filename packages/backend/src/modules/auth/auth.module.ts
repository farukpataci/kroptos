import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PrismaModule } from '@common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-jwt-secret-min-32-characters',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController, SessionController],
  providers: [AuthService, SessionService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService, SessionService, PassportModule, JwtModule],
})
export class AuthModule {}
