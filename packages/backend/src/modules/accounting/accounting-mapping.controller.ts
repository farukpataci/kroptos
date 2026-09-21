import {
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorFromRequest } from '../rbac/rbac.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AccountingMappingService } from './accounting-mapping.service';
import { AccountingScope } from './accounting.service';
import { AccountingQueryDto } from './dto/accounting.dto';

@ApiTags('Accounting Mappings')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/accounting/mappings')
export class AccountingMappingController {
  constructor(private readonly mappingService: AccountingMappingService) {}

  private extractScope(req: Request): AccountingScope {
    // Bulgu 6: ham header tenant filtresi olamaz; yalnizca TenantMiddleware'in dogruladigi baglam.
    const actor = actorFromRequest(req);
    return { agencyId: actor.agencyId, clientId: actor.clientId ?? undefined, storeId: actor.storeId ?? undefined };
  }

  @Get('contacts/:companyId')
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'List contact/cari mappings for company' })
  async listContacts(
    @Param('companyId') companyId: string,
    @Query() query: AccountingQueryDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.mappingService.listContactMappings(companyId, query, scope);
  }

  @Get('products/:companyId')
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'List product SKU mappings for company' })
  async listProducts(
    @Param('companyId') companyId: string,
    @Query() query: AccountingQueryDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.mappingService.listProductMappings(companyId, query, scope);
  }
}
