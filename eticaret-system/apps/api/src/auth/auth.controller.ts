import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RegisterDto } from './dto/register.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import type { AuthenticatedRequestUser } from './types/jwt-payload';

function getRequestMeta(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.header('user-agent'),
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, getRequestMeta(request));
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, getRequestMeta(request));
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  logout(
    @Body() _dto: LogoutDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.authService.logout(
      {
        sessionId: user.sessionId,
        userId: user.userId,
      },
      getRequestMeta(request),
    );
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.me(user);
  }

  @Get('tenants')
  @UseGuards(SessionAuthGuard)
  tenants(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.tenants(user.userId);
  }

  @Post('select-tenant')
  @UseGuards(SessionAuthGuard)
  selectTenant(
    @Body() dto: SelectTenantDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.authService.selectTenant(
      {
        userId: user.userId,
        sessionId: user.sessionId,
        tenantId: dto.tenantId,
      },
      getRequestMeta(request),
    );
  }
}
