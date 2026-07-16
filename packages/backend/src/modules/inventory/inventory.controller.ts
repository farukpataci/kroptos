import { Controller, Get, Post, Body, Req, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto, InventoryResponseDto } from './dto/inventory.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-store-id', required: true, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('warehouse.manage')
  @ApiOperation({ summary: 'List all inventory items in active store context' })
  @ApiResponse({ status: 200, type: [InventoryResponseDto] })
  async list(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeStore = (req as any).activeStore;

    if (!activeAgency?.id || !activeStore?.id) {
      throw new BadRequestException('Active Agency and Store headers are required');
    }

    return this.inventoryService.list(activeAgency.id, activeStore.id);
  }

  @Post('adjust')
  @HttpCode(200)
  @RequirePermission('wms.stock.update')
  @ApiOperation({ summary: 'Register a stock adjustment, inbound, or cycle count' })
  @ApiResponse({ status: 200, type: InventoryResponseDto })
  async adjust(@Body() dto: AdjustInventoryDto, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeStore = (req as any).activeStore;

    if (!activeAgency?.id || !activeStore?.id) {
      throw new BadRequestException('Active Agency and Store headers are required');
    }

    return this.inventoryService.adjust(dto, user.userId, activeAgency.id, activeStore.id);
  }

  @Get('movements')
  @HttpCode(200)
  @RequirePermission('wms.stock.view')
  @ApiOperation({ summary: 'Get recent inventory stock movements logs' })
  async getMovements(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeStore = (req as any).activeStore;

    if (!activeAgency?.id || !activeStore?.id) {
      throw new BadRequestException('Active Agency and Store headers are required');
    }

    return this.inventoryService.getMovements(activeAgency.id, activeStore.id);
  }
}
