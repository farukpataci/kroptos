import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OrderExportController, OrderExportDownloadController } from './order-export.controller';
import { OrderExportService } from './order-export.service';
import { OrderExportProcessor } from './order-export.processor';
import { OrderExportScheduler } from './order-export.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [OrderExportController, OrderExportDownloadController],
  providers: [
    OrderExportService,
    OrderExportProcessor,
    OrderExportScheduler,
  ],
  exports: [OrderExportService, OrderExportProcessor, OrderExportScheduler],
})
export class OrderExportModule {}
