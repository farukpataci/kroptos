import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderAutomationService } from './order-automation.service';

const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes as per docs/otomation.md

@Injectable()
export class OrderAutomationScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly automationService: OrderAutomationService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.sweepIdleAndScheduled().catch((e) => {
        console.error('[order-automation-scheduler] Sweep hatası:', e?.message);
      });
    }, SCHEDULER_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async sweepIdleAndScheduled() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Fetch active ORDER_IDLE rules
      const idleRules = await this.prisma.automationRule.findMany({
        where: {
          triggerType: 'ORDER_IDLE',
          isActive: true,
          deletedAt: null,
        },
      });

      for (const rule of idleRules) {
        const config = (rule.triggerConfig as any) || {};
        const idleHours = Number(config.idleHours || config.hours || 24);
        const targetStatus = config.status || config.fromStatus;

        const cutoff = new Date(Date.now() - idleHours * 60 * 60 * 1000);

        // Find candidate orders in the store older than idleHours
        const whereOrder: any = {
          storeId: rule.storeId,
          updatedAt: { lte: cutoff },
          deletedAt: null,
        };
        if (targetStatus) {
          whereOrder.status = targetStatus;
        }

        const candidateOrders = await this.prisma.order.findMany({
          where: whereOrder,
          include: {
            items: { include: { product: true } },
          },
          take: 100, // Safe batch limit
        });

        for (const order of candidateOrders) {
          // Idempotency: verify this rule hasn't already run on this order for this idle occurrence
          const alreadyRun = await this.prisma.automationRun.findFirst({
            where: {
              ruleId: rule.id,
              orderId: order.id,
              status: 'MATCHED_SUCCESS',
            },
          });

          if (!alreadyRun) {
            const eventId = `idle:${rule.id}:${order.id}:${order.updatedAt.getTime()}`;
            await this.automationService.executeRuleOnOrder(
              rule,
              order,
              'ORDER_IDLE',
              eventId,
              0,
            );
          }
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
