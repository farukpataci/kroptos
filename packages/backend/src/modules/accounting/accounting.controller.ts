import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AccountingService, AccountingScope } from './accounting.service';
import {
  CreateAccountingCompanyDto,
  CreateAccountingIntegrationDto,
  UpdateAccountingCompanyDto,
  UpdateAccountingIntegrationDto,
} from './dto/accounting.dto';

@ApiTags('Accounting')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/accounting/integrations')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  private extractScope(req: Request): AccountingScope {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    const agencyId = activeAgency?.id || (req.headers['x-agency-id'] as string);
    const clientId = activeClient?.id || (req.headers['x-client-id'] as string);
    const storeId = activeStore?.id || (req.headers['x-store-id'] as string);

    return { agencyId, clientId, storeId };
  }

  private extractUser(req: Request) {
    const user = (req as any).user;
    return {
      id: user?.id,
      email: user?.email,
      name: user?.name || user?.username,
      ip: req.ip || (req.headers['x-forwarded-for'] as string),
    };
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'List accounting integrations in tenant scope' })
  async list(@Req() req: Request) {
    const scope = this.extractScope(req);
    return this.accountingService.findIntegrations(scope);
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Get accounting integration by ID' })
  async getById(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.accountingService.findIntegrationById(id, scope);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Create new accounting integration' })
  async create(@Body() dto: CreateAccountingIntegrationDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    dto.agencyId = scope.agencyId;
    if (!dto.storeId && scope.storeId) dto.storeId = scope.storeId;
    if (!dto.clientId && scope.clientId) dto.clientId = scope.clientId;

    return this.accountingService.createIntegration(dto, this.extractUser(req));
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Update accounting integration' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountingIntegrationDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.accountingService.updateIntegration(id, dto, scope, this.extractUser(req));
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Soft-delete accounting integration' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.accountingService.deleteIntegration(id, scope, this.extractUser(req));
  }

  @Post(':id/test-connection')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Test connection to accounting provider' })
  async testConnection(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.accountingService.testConnection(id, scope);
  }

  // --- Company endpoints ---

  @Get(':id/companies')
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'List companies under integration' })
  async listCompanies(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.accountingService.listCompanies(id, scope);
  }

  @Post(':id/companies')
  @HttpCode(201)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Add company branch to integration' })
  async createCompany(
    @Param('id') id: string,
    @Body() dto: CreateAccountingCompanyDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    dto.integrationId = id;
    return this.accountingService.createCompany(dto, scope);
  }

  @Patch(':id/companies/:companyId')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Update company branch' })
  async updateCompany(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateAccountingCompanyDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.accountingService.updateCompany(companyId, dto, scope);
  }

  @Delete(':id/companies/:companyId')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Delete company branch' })
  async deleteCompany(
    @Param('companyId') companyId: string,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    return this.accountingService.deleteCompany(companyId, scope);
  }
}
