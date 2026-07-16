const fs = require('fs');
const path = require('path');

const moduleDir = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/warehouse-settings';
const controllersDir = path.join(moduleDir, 'controllers');
const servicesDir = path.join(moduleDir, 'services');

fs.mkdirSync(controllersDir, { recursive: true });
fs.mkdirSync(servicesDir, { recursive: true });

// 1. WarehouseSettingsModule definition
const moduleCode = `import { Module } from '@nestjs/common';
import { WarehouseController } from './controllers/warehouse.controller';
import { WarehouseZoneController } from './controllers/warehouse-zone.controller';
import { WarehouseLocationController } from './controllers/warehouse-location.controller';
import { StockSourceController } from './controllers/stock-source.controller';
import { StockAllocationController } from './controllers/stock-allocation.controller';
import { LogoStockIntegrationController } from './controllers/logo-stock-integration.controller';
import { StockMovementController } from './controllers/stock-movement.controller';

import { WarehouseService } from './services/warehouse.service';
import { WarehouseZoneService } from './services/warehouse-zone.service';
import { WarehouseLocationService } from './services/warehouse-location.service';
import { StockSourceService } from './services/stock-source.service';
import { StockAllocationService } from './services/stock-allocation.service';
import { LogoStockIntegrationService } from './services/logo-stock-integration.service';
import { StockMovementService } from './services/stock-movement.service';

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

fs.writeFileSync(path.join(moduleDir, 'warehouse-settings.module.ts'), moduleCode);

// Generic boilerplate generator
const controllers = [
  { name: 'Warehouse', param: 'warehouses' },
  { name: 'WarehouseZone', param: 'warehouse-zones' },
  { name: 'WarehouseLocation', param: 'warehouse-locations' },
  { name: 'StockSource', param: 'stock-source' },
  { name: 'LogoStockIntegration', param: 'logo-stock' },
  { name: 'StockMovement', param: 'stock-movements' }
];

for (const c of controllers) {
  const serviceCode = `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ${c.name}Service {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return [];
  }

  async findOne(id: string, agencyId: string) {
    return null;
  }

  async create(data: any, agencyId: string) {
    return { success: true };
  }

  async update(id: string, data: any, agencyId: string) {
    return { success: true };
  }

  async remove(id: string, agencyId: string) {
    return { success: true };
  }
}
`;
  fs.writeFileSync(path.join(servicesDir, `${c.param}.service.ts`), serviceCode);

  const controllerCode = `import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ${c.name}Service } from '../services/${c.param}.service';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';

@ApiTags('${c.name}')
@Controller('/api/${c.param}')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@ApiBearerAuth()
export class ${c.name}Controller {
  constructor(private readonly service: ${c.name}Service) {}

  @Get()
  @Permissions('warehouse.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }

  @Get('/:id')
  @Permissions('warehouse.settings.read')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.service.findOne(id, user.agencyId);
  }

  @Post()
  @Permissions('warehouse.settings.manage')
  async create(@Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.create(data, user.agencyId);
  }

  @Put('/:id')
  @Permissions('warehouse.settings.manage')
  async update(@Param('id') id: string, @Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.update(id, data, user.agencyId);
  }

  @Delete('/:id')
  @Permissions('warehouse.settings.manage')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.service.remove(id, user.agencyId);
  }
}
`;
  fs.writeFileSync(path.join(controllersDir, `${c.param}.controller.ts`), controllerCode);
}

// Custom StockAllocation logic
const allocationServiceCode = `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class StockAllocationService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return this.prisma.stockAllocationRule.findMany({
      where: { agencyId }
    });
  }

  async create(data: any, agencyId: string) {
    return this.prisma.stockAllocationRule.create({
      data: { ...data, agencyId }
    });
  }

  async calculate(data: any) {
    const actualStock = Number(data.actualStock || 0);
    const reservedStock = Number(data.reservedStock || 0);
    const safetyStock = Number(data.safetyStock || 0);
    const damagedStock = Number(data.damagedStock || 0);
    const reserveRatio = Number(data.reserveRatio || 0);
    const percentAllocation = Number(data.percentAllocation || 100);
    const fixedAllocation = Number(data.fixedAllocation || 0);
    const allocationType = data.allocationType || 'ALL_STOCK';

    // Satılabilir Stok = Gerçek Stok - Rezerve Stok - Güvenlik Stoğu - Hasarlı Stok
    const sellableStock = Math.max(0, actualStock - reservedStock - safetyStock - damagedStock);

    let allocatedStock = 0;
    if (allocationType === 'FIXED') {
      allocatedStock = Math.min(sellableStock, fixedAllocation);
    } else if (allocationType === 'PERCENT') {
      allocatedStock = Math.floor(sellableStock * (percentAllocation / 100));
    } else {
      allocatedStock = sellableStock;
    }

    // Reserve ratio adjustment
    if (reserveRatio > 0) {
      allocatedStock = Math.max(0, allocatedStock - Math.floor(allocatedStock * (reserveRatio / 100)));
    }

    return {
      actualStock,
      sellableStock,
      allocatedStock,
      riskLevel: sellableStock <= safetyStock ? 'HIGH' : 'LOW'
    };
  }
}
`;
fs.writeFileSync(path.join(servicesDir, 'stock-allocation.service.ts'), allocationServiceCode);

const allocationControllerCode = `import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { StockAllocationService } from '../services/stock-allocation.service';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';

@ApiTags('StockAllocation')
@Controller('/api/stock-allocation')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@ApiBearerAuth()
export class StockAllocationController {
  constructor(private readonly service: StockAllocationService) {}

  @Get('/rules')
  @Permissions('stock.allocation.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }

  @Post('/rules')
  @Permissions('stock.allocation.manage')
  async create(@Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.create(data, user.agencyId);
  }

  @Post('/calculate')
  @Permissions('stock.allocation.read')
  async calculate(@Body() data: any) {
    return this.service.calculate(data);
  }
}
`;
fs.writeFileSync(path.join(controllersDir, 'stock-allocation.controller.ts'), allocationControllerCode);

console.log('Backend scaffold completed successfully.');
