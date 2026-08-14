import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UsersController } from './controllers/users.controller';
import { RolesController } from './controllers/roles.controller';
import { RequirePermissionController } from './controllers/permissions.controller';
import { TenantSettingsController } from './controllers/tenant-settings.controller';
import { IntegrationSettingsController } from './controllers/integration-settings.controller';
import { SecuritySettingsController } from './controllers/security-settings.controller';
import { NotificationSettingsController } from './controllers/notification-settings.controller';
import { ApiKeysController } from './controllers/api-keys.controller';

import { UsersService } from './services/users.service';
import { RolesService } from './services/roles.service';
import { RequirePermissionService } from './services/permissions.service';
import { TenantSettingsService } from './services/tenant-settings.service';
import { IntegrationSettingsService } from './services/integration-settings.service';
import { SecuritySettingsService } from './services/security-settings.service';
import { NotificationSettingsService } from './services/notification-settings.service';
import { ApiKeysService } from './services/api-keys.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '@common/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    SettingsController,
    UsersController,
    RolesController,
    RequirePermissionController,
    TenantSettingsController,
    IntegrationSettingsController,
    SecuritySettingsController,
    NotificationSettingsController,
    ApiKeysController,
  ],
  providers: [
    SettingsService,
    UsersService,
    RolesService,
    RequirePermissionService,
    TenantSettingsService,
    IntegrationSettingsService,
    SecuritySettingsService,
    NotificationSettingsService,
    ApiKeysService,
  ],
  exports: [
    SettingsService,
    UsersService,
    RolesService,
    RequirePermissionService,
    TenantSettingsService,
    IntegrationSettingsService,
    SecuritySettingsService,
    NotificationSettingsService,
    ApiKeysService,
  ],
})
export class SettingsModule {}
