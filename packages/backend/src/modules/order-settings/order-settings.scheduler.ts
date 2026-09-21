import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { runAsSystem } from '@common/prisma/tenant-context';
import { OrderSettingsService } from './order-settings.service';

@Injectable()
export class OrderSettingsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderSettingsScheduler.name);
  private sweepTimer: NodeJS.Timeout | null = null;
  private isSweeping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderSettingsService: OrderSettingsService,
  ) {}

  onModuleInit() {
    this.logger.log('OrderSettingsScheduler başlatıldı (60s aralıklarla kontrol edilecek).');
    // Start periodic sweep every 60 seconds
    this.sweepTimer = setInterval(() => {
      this.runSweeps().catch((err) => {
        this.logger.error(`OrderSettingsScheduler hata: ${err.message}`, err.stack);
      });
    }, 60000);
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /**
   * Main sweep runner. Idempotent and concurrency-safe.
   */
  async runSweeps() {
    if (this.isSweeping) return;
    this.isSweeping = true;

    try {
      await runAsSystem('order-settings:scheduler-sweep', async () => {
        // Find active stores
        const stores = await this.prisma.store.findMany({
          where: { isActive: true, deletedAt: null },
          select: { id: true, agencyId: true, name: true },
        });

        for (const store of stores) {
          await this.sweepStore(store.id, store.agencyId);
        }
      });
    } finally {
      this.isSweeping = false;
    }
  }

  private async sweepStore(storeId: string, agencyId: string) {
    try {
      const settings = await this.orderSettingsService.get(storeId);

      // 1. Auto-cancel unpaid orders past threshold
      if (settings.flow.unpaidCancelAfterHours > 0) {
        const cancelThreshold = new Date(
          Date.now() - settings.flow.unpaidCancelAfterHours * 3600 * 1000,
        );

        const expiredOrders = await this.prisma.order.findMany({
          where: {
            storeId,
            status: 'pending',
            paymentStatus: 'pending',
            createdAt: { lt: cancelThreshold },
            deletedAt: null,
          },
          take: 50,
          select: { id: true, orderNumber: true },
        });

        for (const order of expiredOrders) {
          await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: 'cancelled',
                holdReason: 'Ödeme zaman aşımı nedeniyle sistem tarafından otomatik iptal edildi.',
              },
            });

            await tx.auditLog.create({
              data: {
                tenantId: agencyId,
                action: 'AUTO_CANCEL_UNPAID',
                entityType: 'Order',
                entityId: order.id,
                userName: 'Sistem (Zaman Aşımı Otomasyonu)',
                newValue: {
                  reason: `unpaidCancelAfterHours (${settings.flow.unpaidCancelAfterHours} saat) aşıldı.`,
                  orderNumber: order.orderNumber,
                },
              },
            });
          });
          this.logger.log(`Sipariş #${order.orderNumber} ödeme süresi dolduğu için otomatik iptal edildi.`);
        }
      }

      // 2. Auto-complete delivered orders
      if (settings.flow.autoCompleteAfterDeliveredDays > 0) {
        const completeThreshold = new Date(
          Date.now() - settings.flow.autoCompleteAfterDeliveredDays * 24 * 3600 * 1000,
        );

        const deliverableOrders = await this.prisma.order.findMany({
          where: {
            storeId,
            status: 'delivered',
            updatedAt: { lt: completeThreshold },
            deletedAt: null,
          },
          take: 50,
          select: { id: true, orderNumber: true },
        });

        for (const order of deliverableOrders) {
          await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'completed' },
            });

            await tx.auditLog.create({
              data: {
                tenantId: agencyId,
                action: 'AUTO_COMPLETE_DELIVERED',
                entityType: 'Order',
                entityId: order.id,
                userName: 'Sistem (Otomatik Tamamlama)',
                newValue: {
                  reason: `autoCompleteAfterDeliveredDays (${settings.flow.autoCompleteAfterDeliveredDays} gün) tamamlandı.`,
                  orderNumber: order.orderNumber,
                },
              },
            });
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Store ${storeId} sweep sırasında hata: ${err.message}`);
    }
  }
}
