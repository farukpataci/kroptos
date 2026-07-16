import { Controller, Post, Get, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, SwitchTenantDto, RefreshDto, AuthResponseDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('/api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register new user and create their initial agency tenant' })
  @ApiResponse({
    status: 201,
    description: 'User and agency registered successfully',
    type: AuthResponseDto,
  })
  async register(@Req() req: Request, @Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.authService.register(dto, ipAddress);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password, starting a new session' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  async login(@Req() req: Request, @Body() dto: LoginDto): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const deviceInfo = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, deviceInfo);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke active session' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Req() req: Request, @Body() dto: RefreshDto) {
    const userId = (req.user as any).userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    await this.authService.logout(dto.refreshToken, userId, ipAddress);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token and rotate refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
  })
  async refresh(@Req() req: Request, @Body() dto: RefreshDto) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.authService.refreshTokens(dto.refreshToken, ipAddress);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('switch-tenant')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch active tenant context (agency, client, store)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant context switched successfully',
  })
  async switchTenant(@Req() req: Request, @Body() dto: SwitchTenantDto) {
    const userId = (req.user as any).userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.authService.switchTenant(userId, dto, ipAddress);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile, active session context, and accessible tenants' })
  @ApiResponse({ status: 200, description: 'Success' })
  async me(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.authService.getMe(userId);
  }
}
