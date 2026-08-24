import { Controller, Get, Post, Body, Req, Param, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { WmsLabelService } from './wms-label.service';
import { CreateWmsLabelDto } from './dto/create-wms-label.dto';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('WMS Labels')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/wms/labels')
export class WmsLabelController {
  constructor(private labelService: WmsLabelService) {}

  @Get('latest')
  @RequirePermission('wms.labels.view')
  @ApiOperation({ summary: 'Get latest created shipping label' })
  async getLatest(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    return this.labelService.getLatestLabel(activeAgency.id);
  }

  @Get(':id/preview')
  @RequirePermission('wms.labels.view')
  @ApiOperation({ summary: 'Get shipping label preview details' })
  async getPreview(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    return this.labelService.getLabelPreview(activeAgency.id, id, user.userId, req.ip);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('wms.labels.create')
  @ApiOperation({ summary: 'Create a shipping label for an order' })
  @ApiResponse({ status: 400, description: 'orderId or shipmentId missing' })
  @ApiResponse({ status: 404, description: 'Order or shipment not in the active tenant' })
  async createLabel(@Body() body: CreateWmsLabelDto, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    return this.labelService.createShippingLabel(activeAgency.id, body, user.userId, req.ip);
  }
}
