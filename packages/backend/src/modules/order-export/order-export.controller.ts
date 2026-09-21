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
  Res,
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
import { Request, Response } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionCacheService } from '../../common/services/permission-cache.service';
import { isSuperAdminRole } from '../../common/constants/platform-admin';
import { OrderExportService, TenantScope } from './order-export.service';
import {
  CreateExportJobDto,
  OrderExportFiltersDto,
  PreviewExportDto,
  CreatePresetDto,
  UpdatePresetDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto/order-export.dto';

@ApiTags('Order Export')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('api/v1/orders/export')
export class OrderExportController {
  constructor(
    private readonly exportService: OrderExportService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  private extractScope(req: Request): TenantScope {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    const agencyId = activeAgency?.id || (req.headers['x-agency-id'] as string);
    if (!agencyId) {
      throw new BadRequestException('Aktif ajans bağlamı gereklidir.');
    }

    return {
      agencyId,
      clientId: activeClient?.id || (req.headers['x-client-id'] as string) || null,
      storeId: activeStore?.id || (req.headers['x-store-id'] as string) || null,
    };
  }

  private async checkPermissions(req: Request, scope: TenantScope) {
    const user = (req as any).user;
    const isSuperAdmin = isSuperAdminRole(user);

    const permissions = await this.permissionCache.getPermissions({
      userId: user.userId || user.id,
      agencyId: scope.agencyId,
      clientId: scope.clientId ?? null,
      storeId: scope.storeId ?? null,
    });

    const canPii = isSuperAdmin || permissions?.includes('order_export.pii') || permissions?.includes('*:*') || false;
    const canReadAll = isSuperAdmin || permissions?.includes('order_export.read_all') || permissions?.includes('*:*') || false;

    return { canPii, canReadAll, userId: (user.userId || user.id) as string };
  }

  // ==================== COLUMNS ====================

  @Get('columns')
  @HttpCode(200)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'Dışa aktarılabilir kolon listesi ve meta verileri' })
  @ApiQuery({ name: 'rowMode', required: false, enum: ['ORDER', 'LINE_ITEM'] })
  async getColumns(
    @Query('rowMode') rowMode: 'ORDER' | 'LINE_ITEM' | undefined,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const { canPii } = await this.checkPermissions(req, scope);
    const columns = this.exportService.getColumns(canPii, rowMode);
    return { columns };
  }

  // ==================== COUNT ====================

  @Post('count')
  @HttpCode(200)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'Filtrelere uyan sipariş ve satır sayısı' })
  async count(@Body() filters: OrderExportFiltersDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.count(filters, scope);
  }

  // ==================== PREVIEW ====================

  @Post('preview')
  @HttpCode(200)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'İlk 20 satırlık canlı önizleme verisi' })
  async preview(@Body() dto: PreviewExportDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    const { canPii } = await this.checkPermissions(req, scope);
    return this.exportService.preview(dto, scope, canPii);
  }

  // ==================== JOBS ====================

  @Get('jobs')
  @HttpCode(200)
  @RequirePermission('order_export.read')
  @ApiOperation({ summary: 'Geçmiş dışa aktarma işleri' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async listJobs(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const scope = this.extractScope(req!);
    const { canReadAll, userId } = await this.checkPermissions(req!, scope);
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    return this.exportService.listJobs(scope, userId, canReadAll, page, limit, status);
  }

  @Post('jobs')
  @HttpCode(201)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'Yeni dışa aktarma işi başlat' })
  async createJob(@Body() dto: CreateExportJobDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    const { canPii, userId } = await this.checkPermissions(req, scope);
    return this.exportService.createJob(dto, scope, userId, canPii);
  }

  @Get('jobs/:id')
  @HttpCode(200)
  @RequirePermission('order_export.read')
  @ApiOperation({ summary: 'Dışa aktarma işi detay ve ilerleme durumu' })
  async getJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.getJob(id, scope);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'Çalışan veya sıradaki işi iptal et' })
  async cancelJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.cancelJob(id, scope);
  }

  @Post('jobs/:id/rerun')
  @HttpCode(201)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'Tamamlanmış veya başarısız işi aynı ayarlarla tekrar başlat' })
  async rerunJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const { canPii, userId } = await this.checkPermissions(req, scope);
    return this.exportService.rerunJob(id, scope, userId, canPii);
  }

  @Delete('jobs/:id')
  @HttpCode(200)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'Dışa aktarma işi ve dosyasını sil' })
  async deleteJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.deleteJob(id, scope);
  }

  @Post('jobs/:id/download-token')
  @HttpCode(200)
  @RequirePermission('order_export.read')
  @ApiOperation({ summary: '5 dakikalık tek kullanımlık indirme URL tokenı üret' })
  async generateDownloadToken(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.exportService.generateDownloadToken(id, scope, user);
  }

  // ==================== PRESETS ====================

  @Get('presets')
  @HttpCode(200)
  @RequirePermission('order_export.create')
  @ApiOperation({ summary: 'Dışa aktarma şablonları listesi' })
  async listPresets(@Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.listPresets(scope);
  }

  @Post('presets')
  @HttpCode(201)
  @RequirePermission('order_export_preset.manage')
  @ApiOperation({ summary: 'Yeni dışa aktarma şablonu oluştur' })
  async createPreset(@Body() dto: CreatePresetDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.exportService.createPreset(dto, scope, user?.userId || user?.id);
  }

  @Patch('presets/:id')
  @HttpCode(200)
  @RequirePermission('order_export_preset.manage')
  @ApiOperation({ summary: 'Şablon güncelle' })
  async updatePreset(
    @Param('id') id: string,
    @Body() dto: UpdatePresetDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.exportService.updatePreset(id, dto, scope);
  }

  @Delete('presets/:id')
  @HttpCode(200)
  @RequirePermission('order_export_preset.manage')
  @ApiOperation({ summary: 'Şablon sil' })
  async deletePreset(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.deletePreset(id, scope);
  }

  // ==================== SCHEDULES ====================

  @Get('schedules')
  @HttpCode(200)
  @RequirePermission('order_export_schedule.manage')
  @ApiOperation({ summary: 'Zamanlanmış dışa aktarma kuralları' })
  async listSchedules(@Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.listSchedules(scope);
  }

  @Post('schedules')
  @HttpCode(201)
  @RequirePermission('order_export_schedule.manage')
  @ApiOperation({ summary: 'Yeni zamanlanmış dışa aktarma oluştur' })
  async createSchedule(@Body() dto: CreateScheduleDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.exportService.createSchedule(dto, scope, user?.userId || user?.id);
  }

  @Patch('schedules/:id')
  @HttpCode(200)
  @RequirePermission('order_export_schedule.manage')
  @ApiOperation({ summary: 'Zamanlanmış kural güncelle' })
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.exportService.updateSchedule(id, dto, scope);
  }

  @Delete('schedules/:id')
  @HttpCode(200)
  @RequirePermission('order_export_schedule.manage')
  @ApiOperation({ summary: 'Zamanlanmış kural sil' })
  async deleteSchedule(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.deleteSchedule(id, scope);
  }

  @Post('schedules/:id/run-now')
  @HttpCode(200)
  @RequirePermission('order_export_schedule.manage')
  @ApiOperation({ summary: 'Zamanlanmış kuralı beklemeden hemen çalıştır' })
  async runScheduleNow(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.exportService.runScheduleNow(id, scope);
  }
}

/**
 * Public streaming download controller verified by cryptographic token
 */
@ApiTags('Order Export Download')
@Controller('api/v1/orders/export/download')
export class OrderExportDownloadController {
  constructor(private readonly exportService: OrderExportService) {}

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Token doğrulamalı dosya indirme stream ucu' })
  async downloadFile(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('İndirme tokenı zorunludur.');
    }

    const { stream, fileName, fileSize, format } =
      await this.exportService.verifyAndGetFileStream(id, token);

    const contentType =
      format === 'CSV'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    if (fileSize) {
      res.setHeader('Content-Length', fileSize.toString());
    }

    stream.pipe(res);
  }
}
