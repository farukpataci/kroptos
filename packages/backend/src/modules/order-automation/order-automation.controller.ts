import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
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
import { OrderAutomationService } from './order-automation.service';
import {
  BacktestRuleDto,
  CreateAutomationRuleDto,
  ReorderRulesDto,
  RunRuleDto,
  TestRuleDto,
  UpdateAutomationRuleDto,
} from './dto/order-automation.dto';
import { tenantScopeFrom } from './tenant-scope';

@ApiTags('Order Automation')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: true, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('api')
export class OrderAutomationController {
  constructor(private readonly service: OrderAutomationService) {}

  private actor(req: Request) {
    const user = req.user as any;
    return {
      userId: (user?.userId || user?.id) as string | undefined,
      ipAddress: (req.ip || (req.headers['x-forwarded-for'] as string)) ?? undefined,
    };
  }

  // ==================== Catalog ====================

  @Get('automation-rules/catalog')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Kural oluşturucu için katalog verilerini getirir' })
  getCatalog() {
    return this.service.getCatalog();
  }

  // ==================== Rules Endpoints ====================

  @Get('automation-rules')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Mağazaya ait otomasyon kurallarını listeler' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'triggerType', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  listRules(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('triggerType') triggerType?: string,
    @Query('isActive') isActiveStr?: string,
  ) {
    const scope = tenantScopeFrom(req);
    const isActive = isActiveStr !== undefined ? isActiveStr === 'true' : undefined;
    return this.service.findAll(scope, { search, triggerType, isActive });
  }

  @Post('automation-rules')
  @HttpCode(201)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Yeni otomasyon kuralı oluşturur (varsayılan pasif)' })
  createRule(@Req() req: Request, @Body() dto: CreateAutomationRuleDto) {
    const scope = tenantScopeFrom(req);
    return this.service.create(dto, scope, this.actor(req));
  }

  @Patch('automation-rules/reorder')
  @HttpCode(200)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Kuralların öncelik sırasını topluca günceller' })
  reorderRules(@Req() req: Request, @Body() dto: ReorderRulesDto) {
    const scope = tenantScopeFrom(req);
    return this.service.reorder(dto.ruleIds, scope, this.actor(req));
  }

  @Post('automation-rules/test')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Kuralı seçili sipariş üzerinde dry-run test eder (yazma yapmaz)' })
  testRule(@Req() req: Request, @Body() dto: TestRuleDto) {
    const scope = tenantScopeFrom(req);
    return this.service.dryRunTest(dto, scope);
  }

  @Get('automation-rules/runs')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Otomasyon çalışma günlüğünü listeler' })
  @ApiQuery({ name: 'ruleId', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'includeSkipped', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listRuleRuns(
    @Req() req: Request,
    @Query('ruleId') ruleId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
    @Query('includeSkipped') includeSkipped?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = tenantScopeFrom(req);
    return this.service.findAllRuns(scope, {
      ruleId,
      orderId,
      status,
      includeSkipped: includeSkipped === 'true',
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('automation-rules/:id')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Kural detayını getirir' })
  getRule(@Req() req: Request, @Param('id') id: string) {
    const scope = tenantScopeFrom(req);
    return this.service.findOne(id, scope);
  }

  @Patch('automation-rules/:id')
  @HttpCode(200)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Kuralı günceller ve versiyon kaydı oluşturur' })
  updateRule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    const scope = tenantScopeFrom(req);
    return this.service.update(id, dto, scope, this.actor(req));
  }

  @Patch('automation-rules/:id/toggle')
  @HttpCode(200)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Kuralın aktiflik durumunu tersine çevirir' })
  toggleRule(@Req() req: Request, @Param('id') id: string) {
    const scope = tenantScopeFrom(req);
    return this.service.toggle(id, scope, this.actor(req));
  }

  @Post('automation-rules/:id/duplicate')
  @HttpCode(201)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Kuralın bir kopyasını oluşturur' })
  duplicateRule(@Req() req: Request, @Param('id') id: string) {
    const scope = tenantScopeFrom(req);
    return this.service.duplicate(id, scope, this.actor(req));
  }

  @Delete('automation-rules/:id')
  @HttpCode(204)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Kuralı siler (soft delete)' })
  deleteRule(@Req() req: Request, @Param('id') id: string) {
    const scope = tenantScopeFrom(req);
    return this.service.remove(id, scope, this.actor(req));
  }

  @Get('automation-rules/:id/versions')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Kuralın versiyon geçmişini getirir' })
  getVersions(@Req() req: Request, @Param('id') id: string) {
    const scope = tenantScopeFrom(req);
    return this.service.getVersions(id, scope);
  }

  @Post('automation-rules/:id/versions/:vid/restore')
  @HttpCode(200)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Kuralı eski bir versiyona geri yükler' })
  restoreVersion(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('vid') vid: string,
  ) {
    const scope = tenantScopeFrom(req);
    return this.service.restoreVersion(id, vid, scope, this.actor(req));
  }

  @Post('automation-rules/:id/backtest')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Son N gün siparişlerinde kuralın kaç siparişe uyduğunu simüle eder' })
  backtest(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: BacktestRuleDto,
  ) {
    const scope = tenantScopeFrom(req);
    return this.service.backtest(id, dto?.days || 30, scope);
  }

  @Post('automation-rules/:id/run')
  @HttpCode(200)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Kuralı seçili siparişlerde elle çalıştırır' })
  runRule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RunRuleDto,
  ) {
    const scope = tenantScopeFrom(req);
    return this.service.runRuleManually(id, dto?.orderIds, scope, this.actor(req));
  }

  // ==================== Runs Endpoints ====================

  @Get('automation-runs')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Otomasyon çalışma günlüğünü listeler' })
  @ApiQuery({ name: 'ruleId', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listRuns(
    @Req() req: Request,
    @Query('ruleId') ruleId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = tenantScopeFrom(req);
    return this.service.findAllRuns(scope, {
      ruleId,
      orderId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('automation-runs/:id')
  @HttpCode(200)
  @RequirePermission('orders.automation.read')
  @ApiOperation({ summary: 'Çalışma günlüğü detayını getirir (koşul izi ve adımlar dahil)' })
  getRun(@Req() req: Request, @Param('id') id: string) {
    const scope = tenantScopeFrom(req);
    return this.service.findRun(id, scope);
  }

  @Post('automation-runs/:id/retry')
  @HttpCode(200)
  @RequirePermission('orders.automation.manage')
  @ApiOperation({ summary: 'Başarısız aksiyonları tekrar dener' })
  retryRun(@Req() req: Request, @Param('id') id: string) {
    const scope = tenantScopeFrom(req);
    return this.service.retryRun(id, scope, this.actor(req));
  }
}
