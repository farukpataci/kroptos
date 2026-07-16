import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Analytics')
@Controller('/api/analytics')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  private extractTenantAndFilters(req: Request, query: any) {
    const user = req.user as any;
    return {
      agencyId: user.agencyId,
      clientId: query.clientId || user.clientId,
      storeId: query.storeId || user.storeId,
      ...query,
    };
  }

  @Get('overview')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get general KPIs for overview cards' })
  async getOverview(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getOverview(filters);
  }

  @Get('sales')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get sales analytics and trends' })
  async getSales(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getSales(filters);
  }

  @Get('orders')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get order analytics and funnels' })
  async getOrders(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getOrders(filters);
  }

  @Get('products')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get product performance analytics' })
  async getProducts(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getProducts(filters);
  }

  @Get('marketplaces')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get marketplace comparison analytics' })
  async getMarketplaces(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getMarketplaces(filters);
  }

  @Get('inventory')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get inventory and stock analytics' })
  async getInventory(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getInventory(filters);
  }

  @Get('warehouse')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get warehouse operational analytics' })
  async getWarehouse(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getWarehouse(filters);
  }

  @Get('shipping')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get shipping performance analytics' })
  async getShipping(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getShipping(filters);
  }

  @Get('accounting/logo')
  @RequirePermission('analytics.integration.read')
  @ApiOperation({ summary: 'Get Logo accounting transfer analytics' })
  async getLogoAccounting(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getLogoAccounting(filters);
  }

  @Get('integrations/health')
  @RequirePermission('analytics.integration.read')
  @ApiOperation({ summary: 'Get integration health analytics' })
  async getIntegrationHealth(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getIntegrationHealth(filters);
  }

  @Get('profitability')
  @RequirePermission('analytics.financial.read') // Requires special financial read permission
  @ApiOperation({ summary: 'Get profitability and financial overview' })
  async getProfitability(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getProfitability(filters);
  }

  @Get('returns')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get returns and cancellation analytics' })
  async getReturns(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getReturns(filters);
  }

  @Get('alerts')
  @RequirePermission('analytics.read')
  @ApiOperation({ summary: 'Get automated system alerts and suggestions' })
  async getAlerts(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.getAlerts(filters);
  }

  @Get('export')
  @RequirePermission('analytics.export')
  @ApiOperation({ summary: 'Export reports to CSV/PDF' })
  async exportReport(@Req() req: Request, @Query() query: any) {
    const filters = this.extractTenantAndFilters(req, query);
    return this.analyticsService.exportReport(filters);
  }
}
