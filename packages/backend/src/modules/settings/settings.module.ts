import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UsersController } from './controllers/users.controller';
import { RolesController, PermissionsController } from './controllers/roles.controller';
import { TenantSettingsController } from './controllers/tenant-settings.controller';
import { IntegrationSettingsController } from './controllers/integration-settings.controller';
import { SecuritySettingsController } from './controllers/security-settings.controller';
import { NotificationSettingsController } from './controllers/notification-settings.controller';
import { ApiKeysController } from './controllers/api-keys.controller';

import { UsersService } from './services/users.service';
import { RolesService } from './services/roles.service';
import { TenantSettingsService } from './services/tenant-settings.service';
import { IntegrationSettingsService } from './services/integration-settings.service';
import { SecuritySettingsService } from './services/security-settings.service';
import { NotificationSettingsService } from './services/notification-settings.service';
import { ApiKeysService } from './services/api-keys.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '@common/prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuthModule } from '../auth/auth.module';

import { SettingsCacheService } from './services/settings-cache.service';
import { SettingsResolverService } from './services/settings-resolver.service';

@Module({
  imports: [PrismaModule, AuditModule, RbacModule, AuthModule],
  controllers: [
    SettingsController,
    UsersController,
    RolesController,
    PermissionsController,
    TenantSettingsController,
    IntegrationSettingsController,
    SecuritySettingsController,
    NotificationSettingsController,
    ApiKeysController,
  ],
  providers: [
    SettingsService,
    SettingsCacheService,
    SettingsResolverService,
    UsersService,
    RolesService,
    TenantSettingsService,
    IntegrationSettingsService,
    SecuritySettingsService,
    NotificationSettingsService,
    ApiKeysService,
  ],
  exports: [
    SettingsService,
    SettingsCacheService,
    SettingsResolverService,
    UsersService,
    RolesService,
    TenantSettingsService,
    IntegrationSettingsService,
    SecuritySettingsService,
    NotificationSettingsService,
    ApiKeysService,
  ],
})
export class SettingsModule {}
