import { Module } from '@nestjs/common';
import { AuditLogService } from './audit.service';
import { AuditLogController } from './audit.controller';
import { PrismaModule } from '@common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditModule {}
