import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { Request } from 'express';

@ApiTags('Profile')
@Controller('/api/profile')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update profile information' })
  async updateProfile(
    @Body() body: any,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    return this.profileService.updateProfile(req.user.userId, body, agencyId, ipAddress, userAgent);
  }

  @Put('/address')
  @ApiOperation({ summary: 'Update address information' })
  async updateAddress(
    @Body() body: any,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    return this.profileService.updateAddress(req.user.userId, body, agencyId, ipAddress, userAgent);
  }

  @Post('/change-password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Body() body: any,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    return this.profileService.changePassword(req.user.userId, body, agencyId, ipAddress, userAgent);
  }

  @Post('/2fa/setup')
  @ApiOperation({ summary: 'Setup 2FA secret and QR code' })
  async setup2fa(@Req() req: any) {
    return this.profileService.setup2fa(req.user.userId);
  }

  @Post('/2fa/enable')
  @ApiOperation({ summary: 'Enable 2FA' })
  async enable2fa(
    @Body() body: any,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const { secret, code } = body;
    if (!secret || !code) {
      throw new BadRequestException('Secret and verification code are required');
    }
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    return this.profileService.enable2fa(req.user.userId, secret, code, agencyId, ipAddress, userAgent);
  }

  @Post('/2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable2fa(
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    return this.profileService.disable2fa(req.user.userId, agencyId, ipAddress, userAgent);
  }

  @Post('/logout-all-devices')
  @ApiOperation({ summary: 'Logout all other active sessions' })
  async logoutAllDevices(
    @Body() body: any,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    const currentTokenHash = body.currentTokenHash || '';
    return this.profileService.logoutAllDevices(req.user.userId, currentTokenHash, agencyId, ipAddress, userAgent);
  }

  @Delete('/delete-account')
  @ApiOperation({ summary: 'Soft delete account' })
  async deleteAccount(
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    return this.profileService.deleteAccount(req.user.userId, agencyId, ipAddress, userAgent);
  }

  @Post('/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload avatar image' })
  async uploadAvatar(
    @UploadedFile() file: any,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the limit of 5MB.');
    }

    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const userAgent = req.headers['user-agent'] || '';
    const agencyId = req.user.agencyId || '';
    return this.profileService.updateAvatar(req.user.userId, base64Image, agencyId, ipAddress, userAgent);
  }
}
