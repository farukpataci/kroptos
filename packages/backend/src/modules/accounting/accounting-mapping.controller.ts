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
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    const agencyId = activeAgency?.id || (req.headers['x-agency-id'] as string);
    const clientId = activeClient?.id || (req.headers['x-client-id'] as string);
    const storeId = activeStore?.id || (req.headers['x-store-id'] as string);

    return { agencyId, clientId, storeId };
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
