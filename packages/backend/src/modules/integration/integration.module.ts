import { Module } from '@nestjs/common';
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

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    MarketplaceHttpClient,
    MarketplaceRateLimiter,
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
    MarketplaceCredentialService,
    MarketplaceConnectorFactory,
    ErpConnectorFactory,
    IntegrationQueueService,
    IntegrationSyncWorker,
  ],
})
export class IntegrationModule {}
