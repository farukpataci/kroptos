import { Module } from '@nestjs/common';
import { PrismaModule } from '@common/prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';
import { OrderSettingsController } from './order-settings.controller';
import { OrderSettingsService } from './order-settings.service';
import { OrderNumberService } from './services/order-number.service';
import { OrderSettingsScheduler } from './order-settings.scheduler';

@Module({
  imports: [PrismaModule, SettingsModule, AuditModule],
  controllers: [OrderSettingsController],
  providers: [OrderSettingsService, OrderNumberService, OrderSettingsScheduler],
  exports: [OrderSettingsService, OrderNumberService],
})
export class OrderSettingsModule {}
