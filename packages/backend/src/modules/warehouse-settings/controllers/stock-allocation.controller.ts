import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { StockAllocationService } from '../services/stock-allocation.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('StockAllocation')
@Controller('/api/stock-allocation')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class StockAllocationController {
  constructor(private readonly service: StockAllocationService) {}

  @Get('/rules')
  @RequirePermission('stock.allocation.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }

  @Post('/rules')
  @RequirePermission('stock.allocation.manage')
  async create(@Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.create(data, user.agencyId);
  }

  @Post('/calculate')
  @RequirePermission('stock.allocation.read')
  async calculate(@Body() data: any) {
    return this.service.calculate(data);
  }
}
