import { Module, forwardRef } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { MarketplaceHttpClient } from '../../integrations/marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../integrations/marketplaces/core/MarketplaceRateLimiter';
import { MarketplaceCredentialService } from '../../integrations/marketplaces/core/MarketplaceCredentialService';
import { MarketplaceConnectorFactory } from '../../integrations/marketplaces/core/MarketplaceConnectorFactory';
import { ErpConnectorFactory } from '../../integrations/erp/core/ErpConnectorFactory';
import { EcommerceHttpClient } from '../../integrations/ecommerce/core/EcommerceHttpClient';
import { EcommerceRateLimiter } from '../../integrations/ecommerce/core/EcommerceRateLimiter';
import { EcommerceCredentialService } from '../../integrations/ecommerce/core/EcommerceCredentialService';
import { EcommerceConnectorFactory } from '../../integrations/ecommerce/core/EcommerceConnectorFactory';
import { IntegrationQueueService } from './integration-queue.service';
import { IntegrationSyncWorker } from './integration-sync.worker';
import { IntegrationSettingsModule } from '../integration-settings/integration-settings.module';
import { MarketplaceSettingsRegistry } from '../../integrations/marketplaces/settings/manifest.registry';

import { WooCommerceWebhookController } from './woocommerce/woocommerce-webhook.controller';
import { IdeasoftController } from './ideasoft/ideasoft.controller';
import { IdeasoftOauthStateService } from './ideasoft/ideasoft-oauth-state.service';

@Module({
  imports: [PrismaModule, forwardRef(() => IntegrationSettingsModule)],
  controllers: [IntegrationController, WooCommerceWebhookController, IdeasoftController],
  providers: [
    IdeasoftOauthStateService,
    IntegrationService,
    MarketplaceHttpClient,
    MarketplaceRateLimiter,
    MarketplaceSettingsRegistry,
    MarketplaceCredentialService,
    MarketplaceConnectorFactory,
    ErpConnectorFactory,
    EcommerceHttpClient,
    EcommerceRateLimiter,
    EcommerceCredentialService,
    EcommerceConnectorFactory,
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
    EcommerceHttpClient,
    EcommerceRateLimiter,
    EcommerceCredentialService,
    EcommerceConnectorFactory,
    IntegrationQueueService,
    IntegrationSyncWorker,
  ],
})
export class IntegrationModule {}
