import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ClientService } from './client.service';
import { CreateClientDto, UpdateClientDto, ClientResponseDto } from './dto/client.dto';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('/api/clients')
export class ClientController {
  constructor(private clientService: ClientService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all active clients within user authorized agency contexts' })
  @ApiResponse({ status: 200, type: [ClientResponseDto] })
  async list(@Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    return this.clientService.list(user.userId, isSuperAdmin);
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get active client details' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    return this.clientService.get(id, user.userId, isSuperAdmin);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('clients.create')
  @ApiOperation({ summary: 'Create new client under an agency' })
  @ApiResponse({ status: 201, type: ClientResponseDto })
  async create(@Body() dto: CreateClientDto, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.clientService.create(dto, user.userId, isSuperAdmin, ipAddress);
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
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.clientService.update(id, dto, user.userId, isSuperAdmin, ipAddress);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('clients.write')
  @ApiOperation({ summary: 'Soft delete client and cascade to its stores' })
  @ApiResponse({ status: 204, description: 'Client soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    await this.clientService.delete(id, user.userId, isSuperAdmin, ipAddress);
    return;
  }
}
