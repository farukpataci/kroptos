import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { OrderAutomationController } from './order-automation.controller';
import { OrderAutomationService } from './order-automation.service';
import { OrderAutomationProcessor } from './order-automation.processor';
import { OrderAutomationScheduler } from './order-automation.scheduler';
import { SetOrderStatusHandler } from './actions/set-order-status.handler';
import { TagHandler } from './actions/tag.handler';
import { PriorityHandler } from './actions/priority.handler';
import { HoldHandler } from './actions/hold.handler';
import { CarrierHandler } from './actions/carrier.handler';
import { WarehouseHandler } from './actions/warehouse.handler';
import { NoteHandler } from './actions/note.handler';
import { NotificationHandler } from './actions/notification.handler';
import { WebhookHandler } from './actions/webhook.handler';
import { WaitHandler } from './actions/wait.handler';

@Module({
  imports: [PrismaModule, OrderModule],
  controllers: [OrderAutomationController],
  providers: [
    OrderAutomationService,
    OrderAutomationProcessor,
    OrderAutomationScheduler,
    SetOrderStatusHandler,
    TagHandler,
    PriorityHandler,
    HoldHandler,
    CarrierHandler,
    WarehouseHandler,
    NoteHandler,
    NotificationHandler,
    WebhookHandler,
    WaitHandler,
  ],
  exports: [OrderAutomationService, OrderAutomationProcessor],
})
export class OrderAutomationModule {}
