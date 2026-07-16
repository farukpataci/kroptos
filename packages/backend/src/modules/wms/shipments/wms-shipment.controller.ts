import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { WmsShipmentService } from './wms-shipment.service';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('WMS Shipments')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/wms')
export class WmsShipmentController {
  constructor(private shipmentService: WmsShipmentService) {}

  @Get('status')
  @RequirePermission('wms.view')
  @ApiOperation({ summary: 'Get current WMS dashboard status metrics' })
  async getStatus(@Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    return this.shipmentService.getWmsStatus(activeAgency.id, user.userId, req.ip);
  }

  @Get('shipments')
  @RequirePermission('wms.view')
  @ApiOperation({ summary: 'Get recent WMS shipments list' })
  async getShipments(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    return this.shipmentService.getShipments(activeAgency.id);
  }
}
