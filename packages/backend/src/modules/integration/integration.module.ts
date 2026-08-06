import { Module, forwardRef } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { MarketplaceHttpClient } from '../../integrations/marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../integrations/marketplaces/core/MarketplaceRateLimiter';
import { MarketplaceCredentialService } from '../../integrations/marketplaces/core/MarketplaceCredentialService';
import { MarketplaceConnectorFactory } from '../../integrations/marketplaces/core/MarketplaceConnectorFactory';
import { ErpConnectorFactory } from '../../integrations/erp/core/ErpConnectorFactory';
import { IntegrationQueueService } from './integration-queue.service';
import { IntegrationSyncWorker } from './integration-sync.worker';
import { IntegrationSettingsModule } from '../integration-settings/integration-settings.module';
import { MarketplaceSettingsRegistry } from '../../integrations/marketplaces/settings/manifest.registry';

@Module({
  imports: [PrismaModule, forwardRef(() => IntegrationSettingsModule)],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    MarketplaceHttpClient,
    MarketplaceRateLimiter,
    MarketplaceSettingsRegistry,
    MarketplaceCredentialService,
    MarketplaceConnectorFactory,
    ErpConnectorFactory,
    IntegrationQueueService,
    IntegrationSyncWorker,
  ],
  exports: [
    IntegrationService,
    MarketplaceHttpClient,
    MarketplaceRateLimiter,
    MarketplaceSettingsRegistry,
    MarketplaceCredentialService,
    MarketplaceConnectorFactory,
    ErpConnectorFactory,
    IntegrationQueueService,
    IntegrationSyncWorker,
  ],
})
export class IntegrationModule {}
