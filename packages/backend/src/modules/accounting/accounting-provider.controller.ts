import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AccountingProviderRegistry } from '../../integrations/accounting/core/AccountingProviderRegistry';

@ApiTags('Accounting Providers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/accounting/providers')
export class AccountingProviderController {
  @Get()
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Kayıtlı muhasebe sağlayıcılarını listele' })
  @ApiResponse({ status: 200, description: 'Muhasebe sağlayıcıları listesi' })
  getProviders() {
    return AccountingProviderRegistry.all().map((p) => ({
      id: p.id,
      displayName: p.displayName,
      country: p.country,
      protocol: p.protocol,
      readiness: p.readiness,
      documentationStatus: p.documentationStatus,
      credentialSchema: p.credentialSchema,
      capabilities: p.capabilities,
      supportsMock: p.supportsMock,
      supportsTest: p.supportsTest,
      supportsProduction: p.supportsProduction,
    }));
  }
}
