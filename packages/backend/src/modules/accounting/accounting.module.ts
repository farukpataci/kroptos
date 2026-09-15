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
import '../../integrations/accounting/quickbooks';
import '../../integrations/accounting/odoo';
import '../../integrations/accounting/datev';
import '../../integrations/accounting/lexware-office';
import '../../integrations/accounting/sevdesk';
import '../../integrations/accounting/freeagent';
import '../../integrations/accounting/exact-online';
import '../../integrations/accounting/visma-net-erp';
import '../../integrations/accounting/fortnox';
import '../../integrations/accounting/netsuite';
import '../../integrations/accounting/fatture-in-cloud';
import '../../integrations/accounting/cegid-xrp-flex';
import '../../integrations/accounting/pennylane';
import '../../integrations/accounting/logo-rest';
import '../../integrations/accounting/logo-objects';
import '../../integrations/accounting/netsis';
import '../../integrations/accounting/mikro';
import '../../integrations/accounting/nebim-v3';

import { AgentModule } from '../agent/agent.module';
import { AccountingProblemController } from './accounting-problem.controller';
import { AccountingProblemService } from './accounting-problem.service';

// Controllers
import { AccountingController } from './accounting.controller';
import { AccountingDocumentController } from './accounting-document.controller';
import { AccountingMappingController } from './accounting-mapping.controller';
import { AccountingProviderController } from './accounting-provider.controller';
import { AccountingOAuthController } from './accounting-oauth.controller';
import { DatevExportController } from './datev-export.controller';
import { DatevExportService } from '../../integrations/accounting/datev/datev.export-service';

@Module({
  imports: [PrismaModule, ConfigModule, AuditModule, AgentModule],
  controllers: [
    AccountingController,
    AccountingOAuthController,
    AccountingDocumentController,
    AccountingMappingController,
    AccountingProviderController,
    AccountingProblemController,
    DatevExportController,
  ],
  providers: [
    AccountingHttpClient,
    AccountingRateLimiter,
    AccountingTokenStore,
    AccountingCredentialService,
    AccountingConnectorFactory,
    AccountingService,
    AccountingDocumentService,
    AccountingProblemService,
    AccountingMappingService,
    AccountingQueueService,
    AccountingSyncWorker,
    DatevExportService,
  ],
  exports: [
    AccountingService,
    AccountingDocumentService,
    AccountingMappingService,
    AccountingConnectorFactory,
    AccountingCredentialService,
    DatevExportService,
  ],
})
export class AccountingModule {}
