import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { IntegrationModule } from '../integration/integration.module';
import { MarketplaceSettingsRegistry } from '../../integrations/marketplaces/settings/manifest.registry';
import { SettingsValidator } from '../../integrations/marketplaces/settings/settings.validator';
import { IntegrationSettingsController } from './integration-settings.controller';
import { IntegrationSettingsService } from './integration-settings.service';

/**
 * `forwardRef` both ways on purpose: this module reads tenant scope through
 * IntegrationService.get(), while IntegrationService needs this module to seed
 * a settings row on create and to guard triggerSync.
 */
@Module({
  imports: [PrismaModule, forwardRef(() => IntegrationModule)],
  controllers: [IntegrationSettingsController],
  providers: [IntegrationSettingsService, MarketplaceSettingsRegistry, SettingsValidator],
  exports: [IntegrationSettingsService, MarketplaceSettingsRegistry, SettingsValidator],
})
export class IntegrationSettingsModule {}
