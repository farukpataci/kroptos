import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OrderImportController, OrderImportMappingController } from './order-import.controller';
import { OrderImportService } from './order-import.service';
import { OrderImportProcessor } from './order-import.processor';
import { PermissionCacheService } from '../../common/services/permission-cache.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrderImportController, OrderImportMappingController],
  providers: [
    OrderImportService,
    OrderImportProcessor,
    PermissionCacheService,
  ],
  exports: [OrderImportService, OrderImportProcessor],
})
export class OrderImportModule {}
