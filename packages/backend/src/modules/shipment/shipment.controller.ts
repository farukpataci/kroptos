import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { LabelFormat } from '../../integrations/carriers/core/CarrierTypes';
import { ShipmentService } from './shipment.service';
import {
  BulkCreateShipmentDto,
  CancelShipmentDto,
  CreateShipmentDto,
  LabelQueryDto,
  ListShipmentsQueryDto,
  QuoteShipmentDto,
  ShipmentResponseDto,
} from './dto/shipment.dto';
import { tenantScopeFrom } from './tenant-scope';

@ApiTags('Shipments')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/shipments')
export class ShipmentController {
  constructor(private readonly service: ShipmentService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('shipments.read')
  @ApiOperation({ summary: 'List shipments filtered by status, provider and date' })
  @ApiResponse({ status: 200, type: [ShipmentResponseDto] })
  async list(@Query() query: ListShipmentsQueryDto, @Req() req: Request) {
    return this.service.list(tenantScopeFrom(req), query);
  }

  // Declared before ':id' so the literal path is not swallowed by the param.
  @Get('problems')
  @HttpCode(200)
  @RequirePermission('shipments.read')
  @ApiOperation({
    summary: 'Counts for the shipments someone has to chase, by hand and by carrier panel',
  })
  async problems(@Req() req: Request) {
    return this.service.problemCounts(tenantScopeFrom(req));
  }

  @Post('quote')
  @HttpCode(200)
  @RequirePermission('shipments.read')
  @ApiOperation({ summary: 'Compare rates across the carriers that publish them' })
  async quote(@Body() dto: QuoteShipmentDto, @Req() req: Request) {
    return this.service.quote(dto, tenantScopeFrom(req));
  }

  @Post('bulk')
  @HttpCode(201)
  @RequirePermission('shipments.create')
  @ApiOperation({ summary: 'Create shipments in batch; failures are reported per item' })
  async createBulk(@Body() dto: BulkCreateShipmentDto, @Req() req: Request) {
    return this.service.createBulk(dto.shipments, tenantScopeFrom(req));
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('shipments.create')
  @ApiOperation({
    summary: 'Create a shipment and obtain a barcode. Idempotent per referenceCode.',
  })
  @ApiResponse({ status: 201, type: ShipmentResponseDto })
  async create(@Body() dto: CreateShipmentDto, @Req() req: Request) {
    return this.service.create(dto, tenantScopeFrom(req));
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('shipments.read')
  @ApiOperation({ summary: 'Shipment detail with packages and tracking events' })
  @ApiResponse({
    status: 200,
    description:
      'List fields plus senderAddress, recipientAddress (KVKK data), packages and events.',
  })
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.service.get(id, tenantScopeFrom(req));
  }

  @Get(':id/label')
  @HttpCode(200)
  @RequirePermission('shipments.label.print')
  @ApiOperation({ summary: 'Label content for the shipment (never the carrier URL)' })
  async label(
    @Param('id') id: string,
    @Query() query: LabelQueryDto,
    @Req() req: Request,
  ) {
    return this.service.getLabel(id, tenantScopeFrom(req), (query.format ?? 'PDF') as LabelFormat);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('shipments.cancel')
  @ApiOperation({ summary: 'Cancel the shipment at the carrier' })
  async cancel(@Param('id') id: string, @Body() dto: CancelShipmentDto, @Req() req: Request) {
    return this.service.cancel(id, tenantScopeFrom(req), dto);
  }

  @Post(':id/refresh')
  @HttpCode(200)
  @RequirePermission('shipments.read')
  @ApiOperation({ summary: 'Pull the current tracking status from the carrier' })
  @ApiResponse({ status: 200, type: ShipmentResponseDto })
  async refresh(@Param('id') id: string, @Req() req: Request) {
    return this.service.refresh(id, tenantScopeFrom(req));
  }
}
