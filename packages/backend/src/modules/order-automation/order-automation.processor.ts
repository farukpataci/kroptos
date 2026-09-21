import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderAutomationService } from './order-automation.service';

export const ORDER_AUTOMATION_QUEUE = 'order-automation';

export interface AutomationJobPayload {
  eventId: string;
  orderId: string;
  storeId: string;
  agencyId: string;
  clientId?: string | null;
  triggerType: string;
  depth?: number;
  causedByRunId?: string;
  payload?: any;
}

@Injectable()
export class OrderAutomationProcessor implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue<AutomationJobPayload>;
  private worker?: Worker<AutomationJobPayload>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly automationService: OrderAutomationService,
  ) {}

  private connection() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      const parsed = new URL(redisUrl);
      return { host: parsed.hostname, port: parseInt(parsed.port, 10) || 6379 };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }

  onModuleInit() {
    const connection = this.connection();

    this.queue = new Queue(ORDER_AUTOMATION_QUEUE, { connection });
    this.worker = new Worker(
      ORDER_AUTOMATION_QUEUE,
      async (job: Job<AutomationJobPayload>) => {
        await this.processJob(job.data);
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.queue.on('error', () => undefined);
    this.worker.on('error', () => undefined);
    this.worker.on('failed', (job, err) => {
      console.error(`[order-automation] İş başarısız (${job?.id}):`, err?.message);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async dispatchEvent(event: AutomationJobPayload) {
    if (!this.queue) return;
    try {
      await this.queue.add('process_order_event', event, {
        removeOnComplete: 1000,
        removeOnFail: 500,
      });
    } catch (e) {
      console.error('[order-automation] Event kuyruğa eklenemedi:', e);
    }
  }

  private async processJob(data: AutomationJobPayload) {
    const depth = data.depth || 0;
    if (depth > 3) {
      console.warn(`[order-automation] Döngü koruması: depth ${depth} aşıldı, sipariş: ${data.orderId}`);
      return;
    }

    if (!data?.orderId) return;

    // 1. Fetch order with items
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order || order.deletedAt) return;

    // 2. Fetch active rules matching the trigger for this store
    const rules = await this.prisma.automationRule.findMany({
      where: {
        storeId: data.storeId,
        triggerType: data.triggerType,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      const eventId = `${data.eventId}:${rule.id}`;
      const run = await this.automationService.executeRuleOnOrder(
        rule,
        order,
        data.triggerType,
        eventId,
        depth,
      );

      // If matched and stopProcessing is enabled, halt subsequent rules
      if (run.matched && rule.stopProcessing) {
        break;
      }
    }
  }
}
