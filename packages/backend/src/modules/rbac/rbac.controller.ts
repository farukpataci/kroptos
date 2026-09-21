import { Controller, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { RbacService, actorFromRequest } from './rbac.service';
import { AssignRoleDto, RevokeRoleDto } from './dto/rbac.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/rbac')
export class RbacController {
  constructor(private rbacService: RbacService) {}

  @Post('assign')
  @HttpCode(201)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Assign a role to a user within the ACTIVE tenant context' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  async assignRole(@Body() dto: AssignRoleDto, @Req() req: Request) {
    return this.rbacService.assignRole(dto, actorFromRequest(req));
  }

  @Post('revoke')
  @HttpCode(200)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Revoke (soft-delete) a user role mapping in the ACTIVE tenant' })
  @ApiResponse({ status: 200, description: 'Role assignment revoked successfully' })
  async revokeRole(@Body() dto: RevokeRoleDto, @Req() req: Request) {
    await this.rbacService.revokeRole(dto, actorFromRequest(req));
    return { message: 'Role revoked successfully' };
  }
}
