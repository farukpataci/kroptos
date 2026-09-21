import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { NotificationEvent } from '@prisma/client';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { actorFromRequest } from '../rbac/rbac.service';
import { CreateTemplateDto, ListTemplatesQueryDto, PreviewDto, TestSendDto, UpdateTemplateDto } from './dto/notification-template.dto';
import { NotificationTemplateService } from './notification-template.service';

@ApiTags('Notification Templates')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context (boşsa ajans seviyesi)' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context (boşsa marka/ajans seviyesi)' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/notification-templates')
export class NotificationTemplateController {
  constructor(private readonly service: NotificationTemplateService) {}

  @Get()
  @RequirePermission('notification_template.read')
  @ApiOperation({ summary: 'Event × kanal matrisi; her satırda efektif kaynak seviyesi (resolvedFrom)' })
  list(@Query() query: ListTemplatesQueryDto, @Req() req: Request) {
    return this.service.list(actorFromRequest(req), query);
  }

  // Literal rotalar ':id'den ÖNCE (product.controller'daki not).
  @Get('variables')
  @RequirePermission('notification_template.read')
  @ApiQuery({ name: 'event', enum: NotificationEvent })
  @ApiOperation({ summary: 'O event için kullanılabilir değişkenler + örnek değerler' })
  variables(@Query('event') event: NotificationEvent) {
    return this.service.variables(event);
  }

  @Post('preview')
  @HttpCode(200)
  @RequirePermission('notification_template.read')
  @ApiOperation({ summary: 'Gövde + orderId? → render (orderId yoksa örnek veri); doğrulama hataları issues[]' })
  preview(@Body() dto: PreviewDto, @Req() req: Request) {
    return this.service.preview(actorFromRequest(req), dto);
  }

  @Get(':id')
  @RequirePermission('notification_template.read')
  @ApiOperation({ summary: 'Detay (sys:* kimlikleri sistem varsayılanıdır)' })
  get(@Param('id') id: string, @Req() req: Request) {
    return this.service.get(actorFromRequest(req), id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('notification_template.create')
  @ApiOperation({ summary: 'Aktif kapsamda oluştur (422: sözdizimi/bilinmeyen değişken)' })
  create(@Body() dto: CreateTemplateDto, @Req() req: Request) {
    return this.service.create(actorFromRequest(req), dto);
  }

  @Post(':id/customize')
  @HttpCode(201)
  @RequirePermission('notification_template.create')
  @ApiOperation({ summary: 'Üst seviyedeki/sistem şablonunu aktif kapsama kopyala' })
  customize(@Param('id') id: string, @Req() req: Request) {
    return this.service.customize(actorFromRequest(req), id);
  }

  @Patch(':id')
  @RequirePermission('notification_template.update')
  @ApiOperation({ summary: 'Güncelle; önceki içerik versiyon olarak saklanır' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @Req() req: Request) {
    return this.service.update(actorFromRequest(req), id, dto);
  }

  @Patch(':id/toggle')
  @RequirePermission('notification_template.update')
  @ApiOperation({ summary: 'Aktif/pasif' })
  toggle(@Param('id') id: string, @Req() req: Request) {
    return this.service.toggle(actorFromRequest(req), id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('notification_template.delete')
  @ApiOperation({ summary: 'Soft delete; sistem varsayılanı 403' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    await this.service.remove(actorFromRequest(req), id);
  }

  @Get(':id/versions')
  @RequirePermission('notification_template.read')
  @ApiOperation({ summary: 'Versiyon geçmişi (kaydetme öncesi içerikler)' })
  versions(@Param('id') id: string, @Req() req: Request) {
    return this.service.versions(actorFromRequest(req), id);
  }

  @Post(':id/versions/:versionId/restore')
  @HttpCode(200)
  @RequirePermission('notification_template.update')
  @ApiOperation({ summary: 'Versiyonu geri yükle (mevcut içerik de versiyonlanır)' })
  restore(@Param('id') id: string, @Param('versionId') versionId: string, @Req() req: Request) {
    return this.service.restore(actorFromRequest(req), id, versionId);
  }

  @Post(':id/test-send')
  @HttpCode(200)
  @RequirePermission('notification_template.test_send')
  @ApiOperation({ summary: 'Belirtilen e-posta/telefona test gönderimi (isTest log)' })
  testSend(@Param('id') id: string, @Body() dto: TestSendDto, @Req() req: Request) {
    return this.service.testSend(actorFromRequest(req), id, dto);
  }
}
