import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CarrierConnectorFactory } from '../../integrations/carriers/core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../../integrations/carriers/core/CarrierCredentialService';
import { CarrierHttpClient } from '../../integrations/carriers/core/CarrierHttpClient';
import { CarrierRateLimiter } from '../../integrations/carriers/core/CarrierRateLimiter';
import { CarrierIntegrationController } from './carrier-integration.controller';
import { CarrierIntegrationService } from './carrier-integration.service';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';

@Module({
  imports: [PrismaModule],
  controllers: [ShipmentController, CarrierIntegrationController],
  providers: [
    ShipmentService,
    CarrierIntegrationService,
    CarrierHttpClient,
    CarrierRateLimiter,
    CarrierCredentialService,
    CarrierConnectorFactory,
  ],
  // Exported for the WMS packaging flow, which will replace its hard-coded
  // carrier name and random tracking number with a real shipment.
  exports: [ShipmentService, CarrierIntegrationService],
})
export class ShipmentModule {}
