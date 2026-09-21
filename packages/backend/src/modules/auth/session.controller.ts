import { Controller, Delete, Get, HttpCode, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { SessionService } from './session.service';

/** Kullanici yalniz KENDI oturumlarini gorur/kapatir. Baskasinin id'si -> 404. */
@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('/api/system/sessions')
@UseGuards(AuthGuard('jwt'))
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  @ApiOperation({ summary: 'Kendi aktif oturumlarim (cihaz, IP, son kullanim); mevcut isaretli' })
  list(@Req() req: Request) {
    const u = req.user as any;
    return this.sessions.listForUser(u.userId, u.sessionId);
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: 'Mevcut haric diger tum oturumlari kapat' })
  async revokeOthers(@Req() req: Request) {
    const u = req.user as any;
    // RLS (P12): audit satırı kiracı bağlamında yazılır; tenantId boş kalırsa WITH CHECK reddeder.
    const revoked = await this.sessions.revokeAllForUser(u.userId, 'user.logout_others', { exceptSessionId: u.sessionId, tenantId: u.agencyId });
    return { revoked };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Tek oturumu kapat (mevcut olan kapatilamaz; UI zaten gostermez)' })
  async revokeOne(@Param('id') id: string, @Req() req: Request) {
    const u = req.user as any;
    await this.sessions.revokeOne(u.userId, id, 'user.logout_session', u.agencyId);
  }
}
