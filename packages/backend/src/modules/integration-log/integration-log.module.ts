import { Module } from '@nestjs/common';
import { IntegrationLogService } from './integration-log.service';
import { IntegrationLogController } from './integration-log.controller';
import { PrismaModule } from '@common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [IntegrationLogService],
  controllers: [IntegrationLogController],
  exports: [IntegrationLogService],
})
export class IntegrationLogModule {}
