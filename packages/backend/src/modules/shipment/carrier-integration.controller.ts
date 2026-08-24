import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CarrierIntegrationService } from './carrier-integration.service';
import {
  CarrierIntegrationResponseDto,
  ConnectionTestResponseDto,
  CreateCarrierIntegrationDto,
  UpdateCarrierIntegrationDto,
} from './dto/carrier-integration.dto';
import { tenantScopeFrom } from './tenant-scope';

@ApiTags('Carriers')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/carriers')
export class CarrierIntegrationController {
  constructor(private readonly service: CarrierIntegrationService) {}

  private actor(req: Request) {
    const user = req.user as any;
    return {
      userId: user?.userId as string,
      ipAddress: (req.ip || (req.headers['x-forwarded-for'] as string)) ?? undefined,
    };
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('carriers.read')
  @ApiOperation({ summary: 'List carrier connections in the active tenant context' })
  @ApiResponse({ status: 200, type: [CarrierIntegrationResponseDto] })
  async list(@Req() req: Request) {
    return this.service.list(tenantScopeFrom(req));
  }

  // Declared before ':id' so the literal path is not swallowed by the param.
  @Get('providers')
  @HttpCode(200)
  @RequirePermission('carriers.read')
  @ApiOperation({
    summary: 'Selectable carriers and the credential fields each one needs',
    description:
      'The form asks for exactly these fields. Hard-coding them in the client is how a ' +
      'connector gains a credential and the setup screen keeps collecting the old set.',
  })
  async providers() {
    return this.service.providers();
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('carriers.read')
  @ApiOperation({ summary: 'Get one carrier connection (credentials masked)' })
  @ApiResponse({ status: 200, type: CarrierIntegrationResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.service.get(id, tenantScopeFrom(req));
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('carriers.create')
  @ApiOperation({ summary: 'Add a carrier connection; credentials are encrypted at rest' })
  @ApiResponse({ status: 201, type: CarrierIntegrationResponseDto })
  async create(@Body() dto: CreateCarrierIntegrationDto, @Req() req: Request) {
    const { userId, ipAddress } = this.actor(req);
    return this.service.create(dto, tenantScopeFrom(req), userId, ipAddress);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('carriers.update')
  @ApiOperation({ summary: 'Update a carrier connection; blank secrets keep stored values' })
  @ApiResponse({ status: 200, type: CarrierIntegrationResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCarrierIntegrationDto,
    @Req() req: Request,
  ) {
    const { userId, ipAddress } = this.actor(req);
    return this.service.update(id, dto, tenantScopeFrom(req), userId, ipAddress);
  }

  @Post(':id/test')
  @HttpCode(200)
  @RequirePermission('carriers.update')
  @ApiOperation({ summary: 'Run the connector connection test' })
  @ApiResponse({ status: 200, type: ConnectionTestResponseDto })
  async test(@Param('id') id: string, @Req() req: Request) {
    return this.service.testConnection(id, tenantScopeFrom(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('carriers.delete')
  @ApiOperation({ summary: 'Soft-delete a carrier connection' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    const { userId, ipAddress } = this.actor(req);
    await this.service.remove(id, tenantScopeFrom(req), userId, ipAddress);
  }
}
