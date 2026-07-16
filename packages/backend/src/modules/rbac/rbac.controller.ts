import { Controller, Get, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { RbacService } from './rbac.service';
import { AssignRoleDto, RevokeRoleDto, RoleResponseDto, PermissionResponseDto } from './dto/rbac.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/rbac')
export class RbacController {
  constructor(private rbacService: RbacService) {}

  @Get('roles')
  @HttpCode(200)
  @RequirePermission('agencies.read')
  @ApiOperation({ summary: 'List all roles and their mapped permissions' })
  @ApiResponse({ status: 200, type: [RoleResponseDto] })
  async listRoles() {
    return this.rbacService.listRoles();
  }

  @Get('permissions')
  @HttpCode(200)
  @RequirePermission('agencies.read')
  @ApiOperation({ summary: 'List all system permissions' })
  @ApiResponse({ status: 200, type: [PermissionResponseDto] })
  async listPermissions() {
    return this.rbacService.listPermissions();
  }

  @Post('assign')
  @HttpCode(201)
  @RequirePermission('agencies.create')
  @ApiOperation({ summary: 'Assign a role to a user within a specific tenant context' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  async assignRole(@Body() dto: AssignRoleDto, @Req() req: Request) {
    const user = (req as any).user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.rbacService.assignRole(dto, user.userId, ipAddress);
  }

  @Post('revoke')
  @HttpCode(200)
  @RequirePermission('agencies.create')
  @ApiOperation({ summary: 'Revoke (soft-delete) user role mapping' })
  @ApiResponse({ status: 200, description: 'Role assignment revoked successfully' })
  async revokeRole(@Body() dto: RevokeRoleDto, @Req() req: Request) {
    const user = (req as any).user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    await this.rbacService.revokeRole(dto, user.userId, ipAddress);
    return { message: 'Role revoked successfully' };
  }
}
