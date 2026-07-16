import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { WarehouseService } from '../services/warehouses.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('Warehouse')
@Controller('/api/warehouses')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class WarehouseController {
  constructor(private readonly service: WarehouseService) {}

  @Get()
  @RequirePermission('warehouse.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }

  @Get('/:id')
  @RequirePermission('warehouse.settings.read')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.service.findOne(id, user.agencyId);
  }

  @Post()
  @RequirePermission('warehouse.settings.manage')
  async create(@Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.create(data, user.agencyId);
  }

  @Put('/:id')
  @RequirePermission('warehouse.settings.manage')
  async update(@Param('id') id: string, @Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.update(id, data, user.agencyId);
  }

  @Delete('/:id')
  @RequirePermission('warehouse.settings.manage')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.service.remove(id, user.agencyId);
  }
}
