const fs = require('fs');
const path = require('path');

// 1. Fix settings.service.ts
const settingsServicePath = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/settings/settings.service.ts';
let settingsService = fs.readFileSync(settingsServicePath, 'utf8');
settingsService = settingsService.replace(
  `    await this.prisma.auditLog.create({
      data: {
        agencyId: 'system',
        userId: userId,
        action: 'UPDATE_SYSTEM_SETTINGS',
        module: 'Settings',
        oldValue: JSON.stringify(settings || {}),
        newValue: JSON.stringify(data),
      }
    });`,
  `    await this.prisma.auditLog.create({
      data: {
        tenantId: 'system',
        userId: userId,
        action: 'UPDATE_SYSTEM_SETTINGS',
        module: 'Settings',
        entityType: 'SystemSettings',
        entityId: settings?.id || 'new',
        oldValue: JSON.stringify(settings || {}),
        newValue: JSON.stringify(data),
      }
    });`
);
fs.writeFileSync(settingsServicePath, settingsService);
console.log('Fixed settings.service.ts');

// 2. Fix settings controllers imports
const settingsControllersDir = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/settings/controllers';
const settingsFiles = fs.readdirSync(settingsControllersDir);
for (const file of settingsFiles) {
  if (file.endsWith('.ts')) {
    const filePath = path.join(settingsControllersDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/import { PermissionsGuard } from '.*';/g, "import { PermissionsGuard } from '@common/guards/permissions.guard';");
    content = content.replace(/import { Permissions } from '.*';/g, "import { Permissions } from '@common/decorators/permissions.decorator';");
    fs.writeFileSync(filePath, content);
  }
}
// Also settings.controller.ts
const settingsCtrlPath = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/settings/settings.controller.ts';
let settingsCtrl = fs.readFileSync(settingsCtrlPath, 'utf8');
settingsCtrl = settingsCtrl.replace(/import { PermissionsGuard } from '.*';/g, "import { PermissionsGuard } from '@common/guards/permissions.guard';");
settingsCtrl = settingsCtrl.replace(/import { Permissions } from '.*';/g, "import { Permissions } from '@common/decorators/permissions.decorator';");
fs.writeFileSync(settingsCtrlPath, settingsCtrl);
console.log('Fixed settings controllers imports');

// 3. Fix warehouse-settings controllers imports
const warehouseControllersDir = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/warehouse-settings/controllers';
const warehouseFiles = fs.readdirSync(warehouseControllersDir);
for (const file of warehouseFiles) {
  if (file.endsWith('.ts')) {
    const filePath = path.join(warehouseControllersDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/import { PermissionsGuard } from '.*';/g, "import { PermissionsGuard } from '@common/guards/permissions.guard';");
    content = content.replace(/import { Permissions } from '.*';/g, "import { Permissions } from '@common/decorators/permissions.decorator';");
    fs.writeFileSync(filePath, content);
  }
}
console.log('Fixed warehouse-settings controllers imports');

// 4. Fix warehouse-settings.module.ts imports
const warehouseModulePath = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/warehouse-settings/warehouse-settings.module.ts';
const warehouseModuleCode = `import { Module } from '@nestjs/common';
import { WarehouseController } from './controllers/warehouses.controller';
import { WarehouseZoneController } from './controllers/warehouse-zones.controller';
import { WarehouseLocationController } from './controllers/warehouse-locations.controller';
import { StockSourceController } from './controllers/stock-source.controller';
import { StockAllocationController } from './controllers/stock-allocation.controller';
import { LogoStockIntegrationController } from './controllers/logo-stock.controller';
import { StockMovementController } from './controllers/stock-movements.controller';

import { WarehouseService } from './services/warehouses.service';
import { WarehouseZoneService } from './services/warehouse-zones.service';
import { WarehouseLocationService } from './services/warehouse-locations.service';
import { StockSourceService } from './services/stock-source.service';
import { StockAllocationService } from './services/stock-allocation.service';
import { LogoStockIntegrationService } from './services/logo-stock.service';
import { StockMovementService } from './services/stock-movements.service';

@Module({
  controllers: [
    WarehouseController,
    WarehouseZoneController,
    WarehouseLocationController,
    StockSourceController,
    StockAllocationController,
    LogoStockIntegrationController,
    StockMovementController,
  ],
  providers: [
    WarehouseService,
    WarehouseZoneService,
    WarehouseLocationService,
    StockSourceService,
    StockAllocationService,
    LogoStockIntegrationService,
    StockMovementService,
  ],
  exports: [
    WarehouseService,
    WarehouseZoneService,
    WarehouseLocationService,
    StockSourceService,
    StockAllocationService,
    LogoStockIntegrationService,
    StockMovementService,
  ],
})
export class WarehouseSettingsModule {}
`;
fs.writeFileSync(warehouseModulePath, warehouseModuleCode);
console.log('Fixed warehouse-settings.module.ts');
