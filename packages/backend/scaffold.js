const fs = require('fs');
const path = require('path');

const controllersDir = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/settings/controllers';
const servicesDir = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/settings/services';

fs.mkdirSync(controllersDir, { recursive: true });
fs.mkdirSync(servicesDir, { recursive: true });

const modules = [
  { name: 'Users', param: 'users', entity: 'user' },
  { name: 'Roles', param: 'roles', entity: 'role' },
  { name: 'Permissions', param: 'permissions', entity: 'permission' },
  { name: 'TenantSettings', param: 'tenant-settings', entity: 'tenant setting' },
  { name: 'IntegrationSettings', param: 'integration-settings', entity: 'integration setting' },
  { name: 'SecuritySettings', param: 'security-settings', entity: 'security setting' },
  { name: 'NotificationSettings', param: 'notification-settings', entity: 'notification setting' },
  { name: 'ApiKeys', param: 'api-keys', entity: 'api key' }
];

for (const mod of modules) {
  const serviceCode = `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ${mod.name}Service {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return [];
  }
}
`;
  fs.writeFileSync(path.join(servicesDir, `${mod.param}.service.ts`), serviceCode);

  const controllerCode = `import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ${mod.name}Service } from '../services/${mod.param}.service';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';

@ApiTags('${mod.name}')
@Controller('/api/system/${mod.param}')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@ApiBearerAuth()
export class ${mod.name}Controller {
  constructor(private readonly service: ${mod.name}Service) {}

  @Get()
  @Permissions('system.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }
}
`;
  fs.writeFileSync(path.join(controllersDir, `${mod.param}.controller.ts`), controllerCode);
}
console.log('Scaffolded successfully.');
