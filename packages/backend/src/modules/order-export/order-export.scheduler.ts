import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderExportProcessor } from './order-export.processor';

export function computeRelativeDateRange(range: string): { startDate: string; endDate: string } {
  const now = new Date();

  switch (range) {
    case 'TODAY': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case 'YESTERDAY': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case 'THIS_WEEK': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case 'LAST_WEEK': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case 'THIS_MONTH': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case 'LAST_MONTH': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    case 'LAST_7_DAYS': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    case 'LAST_30_DAYS': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    default:
      return {
        startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      };
  }
}

@Injectable()
export class OrderExportScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExportScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: OrderExportProcessor,
  ) {}

  onModuleInit() {
    // Check every 60 seconds for due schedules
    this.timer = setInterval(() => {
      this.checkDueSchedules().catch((err) => {
        this.logger.error(`Zamanlanmış dışa aktarma kontrol hatası: ${err.message}`);
      });
    }, 60000);

    this.logger.log('OrderExportScheduler başlatıldı (60s aralıklarla kontrol edilecek).');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runScheduleNow(scheduleId: string, agencyId: string) {
    const schedule = await this.prisma.orderExportSchedule.findFirst({
      where: { id: scheduleId, agencyId, deletedAt: null },
      include: { preset: true },
    });

    if (!schedule) {
      throw new Error('Zamanlama kaydı bulunamadı.');
    }

    return this.triggerSchedule(schedule);
  }

  private async checkDueSchedules() {
    const now = new Date();
    const dueSchedules = await this.prisma.orderExportSchedule.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { nextRunAt: { lte: now } },
          { nextRunAt: null },
        ],
      },
      include: { preset: true },
    });

    for (const schedule of dueSchedules) {
      try {
        await this.triggerSchedule(schedule);
      } catch (err: any) {
        this.logger.error(`Zamanlama tetikleme hatası (${schedule.id}): ${err.message}`);
        await this.prisma.orderExportSchedule.update({
          where: { id: schedule.id },
          data: {
            consecutiveFailures: { increment: 1 },
          },
        }).catch(() => undefined);
      }
    }
  }

  private async triggerSchedule(schedule: any) {
    const { preset } = schedule;
    if (!preset) {
      this.logger.warn(`Zamanlama için şablon bulunamadı: ${schedule.id}`);
      return;
    }

    const relativeDates = computeRelativeDateRange(schedule.relativeRange);
    const filters = {
      ...(preset.filters || {}),
      startDate: relativeDates.startDate,
      endDate: relativeDates.endDate,
      dateField: preset.filters?.dateField || 'createdAt',
    };

    // Create job
    const job = await this.prisma.orderExportJob.create({
      data: {
        agencyId: schedule.agencyId,
        clientId: schedule.clientId,
        storeId: schedule.storeId,
        presetId: schedule.presetId,
        scheduleId: schedule.id,
        filters: filters as any,
        columns: preset.columns as any,
        rowMode: preset.rowMode,
        format: preset.format,
        formatOptions: preset.formatOptions as any,
        status: 'QUEUED',
        progress: 0,
      },
    });

    // Enqueue
    await this.processor.enqueueJob({
      jobId: job.id,
      agencyId: job.agencyId,
      storeId: job.storeId,
      clientId: job.clientId || undefined,
    });

    // Update schedule nextRunAt (approximate for next interval: +24h for daily, +7d for weekly, or next hour)
    const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day default
    await this.prisma.orderExportSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        consecutiveFailures: 0,
        nextRunAt: nextRun,
      },
    });

    this.logger.log(`Zamanlanmış iş başlatıldı: ${job.id} (Zamanlama: ${schedule.name})`);
    return job;
  }
}
