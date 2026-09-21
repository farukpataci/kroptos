import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { OrderSettingsService } from './order-settings.service';
import {
  UpdateOrderSettingsDto,
  ResetOrderSettingsDto,
  LockOrderSettingsDto,
  CopyOrderSettingsDto,
  SettingChangeItemDto,
} from './dto/order-settings.dto';

interface RequestScope {
  agencyId: string;
  clientId?: string;
  storeId?: string;
  userId: string;
  permissions: string[];
}

@ApiTags('Order Settings')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller(['order-settings', 'api/order-settings'])
export class OrderSettingsController {
  constructor(private readonly orderSettingsService: OrderSettingsService) {}

  private extractScope(req: Request): RequestScope {
    const user = (req as any).user;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    const agencyId = activeAgency?.id || (req.headers['x-agency-id'] as string) || user?.agencyId;
    const clientId = activeClient?.id || (req.headers['x-client-id'] as string) || undefined;
    const storeId = activeStore?.id || (req.headers['x-store-id'] as string) || undefined;

    if (!agencyId && !user?.isSuperAdmin) {
      throw new BadRequestException('x-agency-id header or active agency context is required');
    }

    return {
      agencyId: agencyId || '',
      clientId,
      storeId,
      userId: user?.id || 'system',
      permissions: user?.permissions || [],
    };
  }

  @Get('schema')
  @ApiOperation({ summary: 'Get order settings schema and registry definitions' })
  @RequirePermission('order_settings.read')
  getSchema(@Req() req: Request) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.getSchema(scope.permissions);
  }

  @Get()
  @ApiOperation({ summary: 'Get effective order settings for active scope' })
  @RequirePermission('order_settings.read')
  getSettings(@Req() req: Request) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.getForScope(
      scope.agencyId,
      scope.clientId,
      scope.storeId,
      scope.permissions,
    );
  }

  @Patch()
  @ApiOperation({ summary: 'Update order settings in batch' })
  @RequirePermission('order_settings.update')
  updateSettings(@Req() req: Request, @Body() dto: UpdateOrderSettingsDto) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.update(
      scope.agencyId,
      scope.clientId,
      scope.storeId,
      dto.changes,
      dto.reason,
      scope.userId,
      scope.permissions,
    );
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset overrides for selected keys back to inherited values' })
  @RequirePermission('order_settings.update')
  resetSettings(@Req() req: Request, @Body() dto: ResetOrderSettingsDto) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.reset(
      scope.agencyId,
      scope.clientId,
      scope.storeId,
      dto.keys,
      scope.userId,
    );
  }

  @Patch('locks')
  @ApiOperation({ summary: 'Lock or unlock setting keys for lower hierarchy levels' })
  @RequirePermission('order_settings.lock')
  lockSettings(@Req() req: Request, @Body() dto: LockOrderSettingsDto) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.lock(
      scope.agencyId,
      scope.clientId,
      dto.keys,
      dto.locked,
      scope.userId,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get settings change log history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermission('order_settings.read')
  getHistory(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.getHistory(
      scope.agencyId,
      scope.storeId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('history/:changeSetId/revert')
  @ApiOperation({ summary: 'Revert a change set' })
  @RequirePermission('order_settings.update')
  revertChangeSet(@Req() req: Request, @Param('changeSetId') changeSetId: string) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.revertChangeSet(scope.agencyId, changeSetId, scope.userId);
  }

  @Post('impact')
  @HttpCode(200)
  @ApiOperation({ summary: 'Analyze the impact of proposed setting changes' })
  @RequirePermission('order_settings.read')
  getImpact(@Req() req: Request, @Body() body: { changes: SettingChangeItemDto[] }) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.getImpact(scope.agencyId, scope.storeId, body.changes || []);
  }

  @Get('preview/order-number')
  @ApiOperation({ summary: 'Preview next order number' })
  @RequirePermission('order_settings.read')
  previewOrderNumber(
    @Req() req: Request,
    @Query('pattern') pattern?: string,
    @Query('prefix') prefix?: string,
    @Query('padding') padding?: string,
    @Query('resetPeriod') resetPeriod?: string,
  ) {
    const scope = this.extractScope(req);
    if (!scope.storeId) {
      throw new BadRequestException('Store context (x-store-id) is required to preview order number');
    }

    const overrideConfig: any = {};
    if (pattern) overrideConfig.pattern = pattern;
    if (prefix !== undefined) overrideConfig.prefix = prefix;
    if (padding) overrideConfig.padding = parseInt(padding, 10);
    if (resetPeriod) overrideConfig.resetPeriod = resetPeriod;

    return this.orderSettingsService.previewOrderNumber(scope.storeId, overrideConfig);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export non-sensitive store settings as JSON' })
  @RequirePermission('order_settings.read')
  exportSettings(@Req() req: Request) {
    const scope = this.extractScope(req);
    if (!scope.storeId) {
      throw new BadRequestException('x-store-id is required for settings export');
    }
    return this.orderSettingsService.exportSettings(scope.storeId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import settings JSON into active store' })
  @RequirePermission('order_settings.update')
  importSettings(@Req() req: Request, @Body() body: Record<string, any>) {
    const scope = this.extractScope(req);
    if (!scope.storeId) {
      throw new BadRequestException('x-store-id is required for settings import');
    }
    return this.orderSettingsService.importSettings(scope.agencyId, scope.storeId, body, scope.userId);
  }

  @Post('copy')
  @ApiOperation({ summary: 'Copy settings from active store to other stores within agency' })
  @RequirePermission('order_settings.update')
  copySettings(@Req() req: Request, @Body() dto: CopyOrderSettingsDto) {
    const scope = this.extractScope(req);
    return this.orderSettingsService.copySettings(
      scope.agencyId,
      dto.sourceStoreId,
      dto.targetStoreIds,
      scope.userId,
    );
  }
}
