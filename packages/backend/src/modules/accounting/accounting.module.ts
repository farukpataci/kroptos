import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

// Integrations Core
import { AccountingCredentialService } from '../../integrations/accounting/core/AccountingCredentialService';
import { AccountingConnectorFactory } from '../../integrations/accounting/core/AccountingConnectorFactory';
import { AccountingHttpClient } from '../../integrations/accounting/core/AccountingHttpClient';
import { AccountingRateLimiter } from '../../integrations/accounting/core/AccountingRateLimiter';
import { AccountingTokenStore } from '../../integrations/accounting/core/AccountingTokenStore';

// Services & Workers
import { AccountingService } from './accounting.service';
import { AccountingDocumentService } from './accounting-document.service';
import { AccountingMappingService } from './accounting-mapping.service';
import { AccountingQueueService } from './accounting-queue.service';
import { AccountingSyncWorker } from './accounting-sync.worker';

// Providers
import '../../integrations/accounting/parasut';
import '../../integrations/accounting/kolaybi';
import '../../integrations/accounting/bizimhesap';
import '../../integrations/accounting/sap-s4hana-cloud';
import '../../integrations/accounting/ms-dynamics-bc-online';
import '../../integrations/accounting/sage-accounting';
import '../../integrations/accounting/xero';

// Controllers
import { AccountingController } from './accounting.controller';
import { AccountingDocumentController } from './accounting-document.controller';
import { AccountingMappingController } from './accounting-mapping.controller';
import { AccountingProviderController } from './accounting-provider.controller';
import { AccountingOAuthController } from './accounting-oauth.controller';

@Module({
  imports: [PrismaModule, ConfigModule, AuditModule],
  controllers: [
    AccountingController,
    AccountingOAuthController,
    AccountingDocumentController,
    AccountingMappingController,
    AccountingProviderController,
  ],
  providers: [
    AccountingHttpClient,
    AccountingRateLimiter,
    AccountingTokenStore,
    AccountingCredentialService,
    AccountingConnectorFactory,
    AccountingService,
    AccountingDocumentService,
    AccountingMappingService,
    AccountingQueueService,
    AccountingSyncWorker,
  ],
  exports: [
    AccountingService,
    AccountingDocumentService,
    AccountingMappingService,
    AccountingConnectorFactory,
    AccountingCredentialService,
  ],
})
export class AccountingModule {}
