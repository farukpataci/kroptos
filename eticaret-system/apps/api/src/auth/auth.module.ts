import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionGuard } from './guards/permission.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { TenantMiddleware } from './middleware/tenant.middleware';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, TenantGuard, PermissionGuard],
  exports: [AuthService, SessionAuthGuard, TenantGuard, PermissionGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
