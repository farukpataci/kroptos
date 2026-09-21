import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

import { OrderSettingsModule } from '../order-settings/order-settings.module';

@Module({
  imports: [PrismaModule, OrderSettingsModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
