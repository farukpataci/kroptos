import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ClientService } from './client.service';
import { CreateClientDto, UpdateClientDto, ClientResponseDto } from './dto/client.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { isSuperAdminRole } from '../../common/constants/platform-admin';
import { actorFromRequest } from '../rbac/rbac.service';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/clients')
export class ClientController {
  constructor(private clientService: ClientService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return isSuperAdminRole(user);
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('clients.read')
  @ApiOperation({ summary: 'List all active clients within user authorized agency contexts' })
  @ApiResponse({ status: 200, type: [ClientResponseDto] })
  async list(@Req() req: Request) {
    return this.clientService.list(actorFromRequest(req), this.checkSuperAdmin(req));
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('clients.read')
  @ApiOperation({ summary: 'Get active client details' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.clientService.get(id, actorFromRequest(req), this.checkSuperAdmin(req));
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('clients.create')
  @ApiOperation({ summary: 'Create new client under an agency' })
  @ApiResponse({ status: 201, type: ClientResponseDto })
  async create(@Body() dto: CreateClientDto, @Req() req: Request) {
    return this.clientService.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('clients.write')
  @ApiOperation({ summary: 'Update client details' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Req() req: Request,
  ) {
    return this.clientService.update(id, dto, actorFromRequest(req), this.checkSuperAdmin(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('clients.write')
  @ApiOperation({ summary: 'Soft delete client and cascade to its stores' })
  @ApiResponse({ status: 204, description: 'Client soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.clientService.delete(id, actorFromRequest(req), this.checkSuperAdmin(req));
    return;
  }
}
