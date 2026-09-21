import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { actorFromRequest } from '../rbac/rbac.service';
import { ListLogsQueryDto, TestProviderDto, UpsertProviderDto } from './dto/notification.dto';
import { NotificationProviderService } from './notification-provider.service';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/notification-logs')
export class NotificationLogController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @RequirePermission('notification_log.read')
  @ApiOperation({ summary: 'Gönderim günlüğü (sayfalı; kanal, durum, event, tarih, orderId filtreleri)' })
  list(@Query() query: ListLogsQueryDto, @Req() req: Request) {
    return this.notifications.listLogs(actorFromRequest(req), query);
  }

  @Get('order/:orderId')
  @RequirePermission('notification_log.read')
  @ApiOperation({ summary: 'Bir siparişin bildirimleri (sipariş detayı için)' })
  forOrder(@Param('orderId') orderId: string, @Req() req: Request) {
    return this.notifications.logsForOrder(actorFromRequest(req), orderId);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @RequirePermission('notification_log.read')
  @ApiOperation({ summary: 'FAILED/SKIPPED gönderimi yeniden kuyruğa al' })
  retry(@Param('id') id: string, @Req() req: Request) {
    return this.notifications.retry(actorFromRequest(req), id);
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/notification-providers')
export class NotificationProviderController {
  constructor(private readonly providers: NotificationProviderService) {}

  @Get()
  @RequirePermission('notification_provider.manage')
  @ApiOperation({ summary: 'Kanal başına sağlayıcı ayarı (secret değerleri dönmez, yalnız hangi alanların dolu olduğu)' })
  list(@Req() req: Request) {
    return this.providers.list(actorFromRequest(req).agencyId);
  }

  @Patch()
  @RequirePermission('notification_provider.manage')
  @ApiOperation({ summary: 'Sağlayıcı ayarını kaydet (kanal başına tek kayıt; secret şifreli)' })
  upsert(@Body() dto: UpsertProviderDto, @Req() req: Request) {
    const actor = actorFromRequest(req);
    return this.providers.upsert(actor.agencyId, dto.channel, dto, actor.userId);
  }

  @Post('test')
  @HttpCode(200)
  @RequirePermission('notification_provider.manage')
  @ApiOperation({ summary: 'Bağlantı testi (SMTP verify / Netgsm bakiye)' })
  test(@Body() dto: TestProviderDto, @Req() req: Request) {
    return this.providers.test(actorFromRequest(req).agencyId, dto.channel);
  }
}
