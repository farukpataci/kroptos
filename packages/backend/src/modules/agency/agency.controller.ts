import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AgencyService } from './agency.service';
import { CreateAgencyDto, UpdateAgencyDto, AgencyResponseDto } from './dto/agency.dto';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Agencies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller()
export class AgencyController {
  constructor(private agencyService: AgencyService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get('/api/agencies')
  @HttpCode(200)
  @ApiOperation({ summary: 'List all active agencies accessible to current user context' })
  @ApiResponse({ status: 200, type: [AgencyResponseDto] })
  async list(@Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    return this.agencyService.list(user.userId, isSuperAdmin);
  }

  @Get('/api/agencies/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get active agency details' })
  @ApiResponse({ status: 200, type: AgencyResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    return this.agencyService.get(id, user.userId, isSuperAdmin);
  }

  @Get('/api/tenants/:tenantPublicId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get active agency details by public tenant ID' })
  @ApiResponse({ status: 200, type: AgencyResponseDto })
  async getByTenantPublicId(@Param('tenantPublicId') tenantPublicId: string, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    return this.agencyService.get(tenantPublicId, user.userId, isSuperAdmin);
  }

  @Post('/api/agencies')
  @HttpCode(201)
  @UseGuards(PlatformAdminGuard)
  @RequirePermission('agencies.create')
  @ApiOperation({ summary: 'Create new agency and assign creator as Agency Owner' })
  @ApiResponse({ status: 201, type: AgencyResponseDto })
  async create(@Body() dto: CreateAgencyDto, @Req() req: Request) {
    const user = req.user as any;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.agencyService.create(dto, user.userId, ipAddress);
  }

  @Patch('/api/agencies/:id')
  @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  @RequirePermission('agencies.write')
  @ApiOperation({ summary: 'Update agency details' })
  @ApiResponse({ status: 200, type: AgencyResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgencyDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.agencyService.update(id, dto, user.userId, isSuperAdmin, ipAddress);
  }

  @Delete('/api/agencies/:id')
  @HttpCode(204)
  @UseGuards(PlatformAdminGuard)
  @RequirePermission('agencies.write')
  @ApiOperation({ summary: 'Soft delete agency and its nested relations' })
  @ApiResponse({ status: 204, description: 'Agency soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    await this.agencyService.delete(id, user.userId, isSuperAdmin, ipAddress);
    return;
  }
}
