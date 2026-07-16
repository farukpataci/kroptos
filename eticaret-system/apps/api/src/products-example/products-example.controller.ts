import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import type { SessionTenantContext } from '../auth/types/jwt-payload';

@Controller('example/products')
@UseGuards(SessionAuthGuard, TenantGuard)
export class ProductsExampleController {
  @Get()
  @Permissions('products.read')
  @UseGuards(PermissionGuard)
  list(@Req() request: Request & { tenant: SessionTenantContext }) {
    return {
      tenantId: request.tenant.tenantId,
      items: [],
    };
  }

  @Post()
  @Permissions('products.create')
  @UseGuards(PermissionGuard)
  create(@Body() body: Record<string, unknown>, @Req() request: Request & { tenant: SessionTenantContext }) {
    return {
      tenantId: request.tenant.tenantId,
      product: body,
    };
  }
}
