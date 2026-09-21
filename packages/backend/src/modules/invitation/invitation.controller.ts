import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';
import { actorFromRequest } from '../rbac/rbac.service';
import { InvitationService } from './invitation.service';
import { AcceptInvitationDto, CreateInvitationDto, ListInvitationsQueryDto } from './dto/invitation.dto';

/** Korumali: aktif ajans kapsaminda davet yonetimi. */
@ApiTags('Invitations')
@ApiBearerAuth()
@Controller('/api/system/invitations')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class InvitationController {
  constructor(private readonly service: InvitationService) {}

  @Post()
  @HttpCode(201)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Davet olustur (bekleyen varsa yeniden gonderir); StoreUser yazmaz' })
  create(@Body() dto: CreateInvitationDto, @Req() req: Request) {
    return this.service.create(dto, actorFromRequest(req));
  }

  @Get()
  @RequirePermission('users.view')
  list(@Query() query: ListInvitationsQueryDto, @Req() req: Request) {
    return this.service.list(query, actorFromRequest(req));
  }

  @Post(':id/resend')
  @HttpCode(200)
  @RequirePermission('users.manage')
  resend(@Param('id') id: string, @Req() req: Request) {
    return this.service.resend(id, actorFromRequest(req));
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @RequirePermission('users.manage')
  revoke(@Param('id') id: string, @Req() req: Request) {
    return this.service.revoke(id, actorFromRequest(req));
  }
}

/**
 * Public: guard YOK, tenant header'i gerekmez. Yetki tek kullanimlik token'in
 * kendisidir. Bu yol TenantMiddleware.publicRoutes'ta da listeli olmak ZORUNDA;
 * aksi halde middleware Bearer'siz istegi 401 ile keser (webhook'larin bugunku hali).
 */
@ApiTags('Invitations')
@Controller('/api/invitations')
export class PublicInvitationController {
  constructor(private readonly service: InvitationService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Davet onizleme (e-posta, ajans, rol, kullanici var mi)' })
  preview(@Param('token') token: string) {
    return this.service.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Daveti kabul et; oturum token cifti doner' })
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto, @Req() req: Request) {
    return this.service.accept(token, dto, req.ip || (req.headers['x-forwarded-for'] as string));
  }
}
