import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { MarketplaceSettingsRegistry } from '../../integrations/marketplaces/settings/manifest.registry';
import { IntegrationSettingsService, TenantCtx } from './integration-settings.service';
import {
  CompleteWizardStepDto,
  ResetIntegrationSettingsDto,
  SaveIntegrationSettingsDto,
  ValidateIntegrationSettingsDto,
} from './dto/integration-settings.dto';

@ApiTags('Integration Settings')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/integrations')
export class IntegrationSettingsController {
  constructor(
    private settingsService: IntegrationSettingsService,
    private registry: MarketplaceSettingsRegistry,
  ) {}

  private ctx(req: Request): TenantCtx {
    const user = (req as any).user;
    return {
      agencyId: (req as any).activeAgency?.id,
      clientId: (req as any).activeClient?.id,
      storeId: (req as any).activeStore?.id,
      isSuperAdmin: user?.role === 'super_admin' || user?.role === 'Super Admin',
      userId: user?.userId,
      userName: user?.email,
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
    };
  }

  // Static routes are declared before ':id/...' so 'settings' is never parsed
  // as an integration id.

  @Get('settings/providers')
  @HttpCode(200)
  @RequirePermission('integrations.read')
  @ApiOperation({ summary: 'List supported marketplaces with their capabilities' })
  listProviders() {
    return this.registry.listProviders();
  }

  @Get('settings/providers/:provider/schema')
  @HttpCode(200)
  @RequirePermission('integrations.read')
  @ApiOperation({ summary: 'Provider manifest before an integration exists (credentials form)' })
  getProviderSchema(@Param('provider') provider: string) {
    return this.settingsService.getSchema(provider);
  }

  @Get(':id/settings/schema')
  @HttpCode(200)
  @RequirePermission('integrations.read')
  @ApiOperation({ summary: 'Resolved settings manifest for an integration' })
  getSchema(@Param('id') id: string, @Req() req: Request) {
    return this.settingsService.getSchemaForIntegration(id, this.ctx(req));
  }

  @Get(':id/settings')
  @HttpCode(200)
  @RequirePermission('integrations.read')
  @ApiOperation({ summary: 'Stored values, defaults and configuration state' })
  @ApiResponse({ status: 200, description: 'Effective settings with secrets masked' })
  getSettings(@Param('id') id: string, @Req() req: Request) {
    return this.settingsService.getEffective(id, this.ctx(req));
  }

  @Put(':id/settings')
  @HttpCode(200)
  @RequirePermission('integrations.settings.update')
  @ApiOperation({ summary: 'Replace the stored settings (validate + revision + audit)' })
  save(@Param('id') id: string, @Body() dto: SaveIntegrationSettingsDto, @Req() req: Request) {
    return this.settingsService.save(id, dto.values, this.ctx(req), {
      partial: false,
      note: dto.note,
    });
  }

  @Patch(':id/settings')
  @HttpCode(200)
  @RequirePermission('integrations.settings.update')
  @ApiOperation({ summary: 'Merge a partial settings payload into the stored values' })
  patch(@Param('id') id: string, @Body() dto: SaveIntegrationSettingsDto, @Req() req: Request) {
    return this.settingsService.save(id, dto.values, this.ctx(req), {
      partial: true,
      note: dto.note,
    });
  }

  @Post(':id/settings/validate')
  @HttpCode(200)
  @RequirePermission('integrations.read')
  @ApiOperation({ summary: 'Validate values without saving them' })
  validate(
    @Param('id') id: string,
    @Body() dto: ValidateIntegrationSettingsDto,
    @Req() req: Request,
  ) {
    return this.settingsService.validateOnly(id, dto.values, this.ctx(req), dto.stepId);
  }

  @Post(':id/settings/reset')
  @HttpCode(200)
  @RequirePermission('integrations.settings.update')
  @ApiOperation({ summary: 'Reset a section (or everything) back to manifest defaults' })
  reset(
    @Param('id') id: string,
    @Body() dto: ResetIntegrationSettingsDto,
    @Req() req: Request,
  ) {
    return this.settingsService.reset(id, dto.sectionId, this.ctx(req));
  }

  @Get(':id/settings/revisions')
  @HttpCode(200)
  @RequirePermission('integrations.read')
  @ApiOperation({ summary: 'Recent settings revisions, newest first' })
  revisions(@Param('id') id: string, @Query('take') take: string, @Req() req: Request) {
    const parsed = Number(take);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
    return this.settingsService.listRevisions(id, this.ctx(req), limit);
  }

  @Post(':id/settings/revisions/:version/restore')
  @HttpCode(200)
  @RequirePermission('integrations.settings.update')
  @ApiOperation({ summary: 'Restore a previous settings revision' })
  restore(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: Request,
  ) {
    return this.settingsService.restoreRevision(id, version, this.ctx(req));
  }

  @Post(':id/settings/wizard/complete')
  @HttpCode(200)
  @RequirePermission('integrations.settings.update')
  @ApiOperation({ summary: 'Mark a wizard step complete, activating once all required steps pass' })
  completeStep(
    @Param('id') id: string,
    @Body() dto: CompleteWizardStepDto,
    @Req() req: Request,
  ) {
    return this.settingsService.completeWizardStep(id, dto.stepId, dto.values, this.ctx(req));
  }
}
