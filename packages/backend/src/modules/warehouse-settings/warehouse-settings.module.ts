import { Module } from '@nestjs/common';
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
import { PrismaModule } from '@common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
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
