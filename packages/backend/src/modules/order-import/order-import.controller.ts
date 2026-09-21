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
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { OrderImportService, TenantScope, UploadedFileDto } from './order-import.service';
import {
  SaveMappingDto,
  SaveValueMapsDto,
  StartImportDto,
  CreateMappingTemplateDto,
  UpdateMappingTemplateDto,
} from './dto/order-import.dto';

@ApiTags('Order Import')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-store-id', required: true, description: 'Active Store ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller(['order-imports', 'api/order-imports'])
export class OrderImportController {
  constructor(private readonly importService: OrderImportService) {}

  private extractScope(req: Request): TenantScope {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    const agencyId = activeAgency?.id || (req.headers['x-agency-id'] as string);
    const storeId = activeStore?.id || (req.headers['x-store-id'] as string);

    if (!agencyId || !storeId) {
      throw new BadRequestException('Aktif mağaza ve ajans bağlamı gereklidir (x-agency-id ve x-store-id başlıkları).');
    }

    return {
      agencyId,
      storeId,
      clientId: activeClient?.id || (req.headers['x-client-id'] as string) || undefined,
    };
  }

  @Get('template')
  @RequirePermission('order_import.read')
  @ApiOperation({ summary: 'Örnek boş içe aktarma şablonu indir' })
  @ApiQuery({ name: 'format', required: false, enum: ['CSV', 'XLSX'] })
  @ApiQuery({ name: 'rowMode', required: false, enum: ['ORDER', 'LINE_ITEM'] })
  async getTemplate(
    @Query('format') format: 'CSV' | 'XLSX' = 'XLSX',
    @Query('rowMode') rowMode: 'ORDER' | 'LINE_ITEM' = 'LINE_ITEM',
    @Res() res: Response,
  ) {
    const result = await this.importService.getSampleTemplate(format, rowMode);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.buffer);
  }

  @Post('upload')
  @RequirePermission('order_import.create')
  @ApiOperation({ summary: 'İçe aktarılacak dosyayı yükle ve analiz et' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: UploadedFileDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.uploadFile(file, user?.userId || user?.id || 'system', scope);
  }

  @Patch(':id/mapping')
  @RequirePermission('order_import.create')
  @ApiOperation({ summary: 'Kolon eşleştirme ve mod ayarlarını kaydet' })
  async saveMapping(
    @Param('id') id: string,
    @Body() dto: SaveMappingDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.saveMapping(id, dto, user?.userId || user?.id || 'system', scope);
  }

  @Get(':id/unmapped-values')
  @RequirePermission('order_import.read')
  @ApiOperation({ summary: 'Eşleşmeyen durum/kargo/ödeme/ürün değerlerini listele' })
  async getUnmappedValues(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.importService.getUnmappedValues(id, scope);
  }

  @Patch(':id/value-maps')
  @RequirePermission('order_import.create')
  @ApiOperation({ summary: 'Değer eşlemelerini kaydet' })
  async saveValueMaps(
    @Param('id') id: string,
    @Body() dto: SaveValueMapsDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.saveValueMaps(id, dto, user?.userId || user?.id || 'system', scope);
  }

  @Post(':id/validate')
  @RequirePermission('order_import.create')
  @ApiOperation({ summary: 'Ön kontrolü (dry-run) çalıştır' })
  async validateJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.validateJob(id, user?.userId || user?.id || 'system', scope);
  }

  @Get(':id')
  @RequirePermission('order_import.read')
  @ApiOperation({ summary: 'İçe aktarma iş detayını ve ilerlemesini getir' })
  async getJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.importService.getJob(id, scope);
  }

  @Get(':id/rows')
  @RequirePermission('order_import.read')
  @ApiOperation({ summary: 'İş satır sonuçlarını sayfalı getir' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getJobRows(
    @Param('id') id: string,
    @Query('status') status: string | undefined,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.importService.getJobRows(id, status, Number(page), Number(limit), scope);
  }

  @Post(':id/start')
  @RequirePermission('order_import.create')
  @ApiOperation({ summary: 'Doğrulanmış içe aktarmayı başlat' })
  async startImport(
    @Param('id') id: string,
    @Body() dto: StartImportDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.startImport(id, dto, user?.userId || user?.id || 'system', scope);
  }

  @Post(':id/cancel')
  @RequirePermission('order_import.create')
  @ApiOperation({ summary: 'İçe aktarma işini iptal et' })
  async cancelJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.cancelJob(id, user?.userId || user?.id || 'system', scope);
  }

  @Get(':id/error-report')
  @RequirePermission('order_import.read')
  @ApiOperation({ summary: 'Hata raporu dosyasını indir' })
  async getErrorReport(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const scope = this.extractScope(req);
    const file = await this.importService.getErrorReportFile(id, scope);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.sendFile(file.filePath);
  }

  @Post(':id/rollback')
  @RequirePermission('order_import.rollback')
  @ApiOperation({ summary: 'Tamamlanan içe aktarmayı geri al' })
  async rollbackImport(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.rollbackImport(id, user?.userId || user?.id || 'system', scope);
  }

  @Get()
  @RequirePermission('order_import.read')
  @ApiOperation({ summary: 'Geçmiş içe aktarma işlerini listele' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listJobs(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.importService.listJobs(scope, Number(page), Number(limit));
  }

  @Delete(':id')
  @RequirePermission('order_import.create')
  @HttpCode(204)
  @ApiOperation({ summary: 'İçe aktarma işini sil' })
  async deleteJob(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    await this.importService.deleteJob(id, user?.userId || user?.id || 'system', scope);
  }
}

@ApiTags('Order Import Mappings')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true })
@ApiHeader({ name: 'x-store-id', required: true })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller(['order-import-mappings', 'api/order-import-mappings'])
export class OrderImportMappingController {
  constructor(private readonly importService: OrderImportService) {}

  private extractScope(req: Request): TenantScope {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    const agencyId = activeAgency?.id || (req.headers['x-agency-id'] as string);
    const storeId = activeStore?.id || (req.headers['x-store-id'] as string);

    if (!agencyId || !storeId) {
      throw new BadRequestException('Aktif mağaza ve ajans bağlamı gereklidir.');
    }

    return {
      agencyId,
      storeId,
      clientId: activeClient?.id || (req.headers['x-client-id'] as string) || undefined,
    };
  }

  @Get()
  @RequirePermission('order_import_mapping.manage')
  @ApiOperation({ summary: 'Kayıtlı eşleştirme şablonlarını listele' })
  async listTemplates(@Req() req: Request) {
    const scope = this.extractScope(req);
    return this.importService.listTemplates(scope);
  }

  @Get(':id')
  @RequirePermission('order_import_mapping.manage')
  @ApiOperation({ summary: 'Şablon detayını getir' })
  async getTemplate(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.importService.getTemplate(id, scope);
  }

  @Post()
  @RequirePermission('order_import_mapping.manage')
  @ApiOperation({ summary: 'Yeni eşleştirme şablonu oluştur' })
  async createTemplate(@Body() dto: CreateMappingTemplateDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.createTemplate(dto, user?.userId || user?.id || 'system', scope);
  }

  @Patch(':id')
  @RequirePermission('order_import_mapping.manage')
  @ApiOperation({ summary: 'Şablonu güncelle' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateMappingTemplateDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.importService.updateTemplate(id, dto, user?.userId || user?.id || 'system', scope);
  }

  @Delete(':id')
  @RequirePermission('order_import_mapping.manage')
  @HttpCode(204)
  @ApiOperation({ summary: 'Şablonu sil' })
  async deleteTemplate(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    await this.importService.deleteTemplate(id, user?.userId || user?.id || 'system', scope);
  }
}
