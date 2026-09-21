import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '@common/prisma/prisma.service';
import { COLUMNS_MAP } from './columns/column-registry';
import { CsvExportWriter } from './writers/csv.writer';
import { XlsxExportWriter } from './writers/xlsx.writer';
import { OrderExportFiltersDto } from './dto/order-export.dto';
import * as path from 'path';
import * as fs from 'fs';

export const ORDER_EXPORT_QUEUE = 'order-export';

export interface ExportJobPayload {
  jobId: string;
  agencyId: string;
  storeId?: string;
  clientId?: string;
}

@Injectable()
export class OrderExportProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExportProcessor.name);
  private queue?: Queue<ExportJobPayload>;
  private worker?: Worker<ExportJobPayload>;

  constructor(private readonly prisma: PrismaService) {}

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

    this.queue = new Queue(ORDER_EXPORT_QUEUE, { connection });
    this.worker = new Worker(
      ORDER_EXPORT_QUEUE,
      async (job: Job<ExportJobPayload>) => {
        await this.processJob(job.data);
      },
      {
        connection,
        concurrency: 2, // Max 2 concurrent export streams
      },
    );

    this.queue.on('error', (err) => {
      this.logger.error(`Kuyruk hatası: ${err.message}`);
    });
    this.worker.on('error', (err) => {
      this.logger.error(`Worker hatası: ${err.message}`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`[order-export] İş başarısız (${job?.id}): ${err?.message}`);
    });

    this.logger.log('OrderExportProcessor başlatıldı.');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueJob(payload: ExportJobPayload) {
    if (!this.queue) return;
    try {
      await this.queue.add('process_export', payload, {
        removeOnComplete: 500,
        removeOnFail: 500,
      });
      this.logger.log(`Export işi kuyruğa eklendi: ${payload.jobId}`);
    } catch (e: any) {
      this.logger.error(`Export işi kuyruğa eklenemedi: ${e?.message}`);
    }
  }

  private getExportStorageDir(): string {
    const dir = path.join(process.cwd(), 'storage', 'exports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private buildWhereClause(filters: any, scope: { agencyId: string; storeId?: string; clientId?: string }): any {
    const where: any = { deletedAt: null };

    if (scope.storeId) {
      where.storeId = scope.storeId;
    } else if (scope.clientId) {
      where.clientId = scope.clientId;
    } else if (scope.agencyId) {
      where.agencyId = scope.agencyId;
    }

    if (!filters) return where;

    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.clientId) where.clientId = filters.clientId;

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }
    if (filters.paymentStatuses && filters.paymentStatuses.length > 0) {
      where.paymentStatus = { in: filters.paymentStatuses };
    }
    if (filters.fulfillmentStatuses && filters.fulfillmentStatuses.length > 0) {
      where.fulfillmentStatus = { in: filters.fulfillmentStatuses };
    }
    if (filters.source) {
      where.source = filters.source;
    }

    const dateField = filters.dateField || 'createdAt';
    if (filters.startDate || filters.endDate) {
      where[dateField] = {};
      if (filters.startDate) where[dateField].gte = new Date(filters.startDate);
      if (filters.endDate) where[dateField].lte = new Date(filters.endDate);
    }

    if (filters.orderNumbers && filters.orderNumbers.length > 0) {
      where.orderNumber = { in: filters.orderNumbers };
    } else if (filters.search) {
      const q = String(filters.search).trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async processJob(payload: ExportJobPayload) {
    const { jobId } = payload;

    const job = await this.prisma.orderExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      this.logger.warn(`İş bulunamadı: ${jobId}`);
      return;
    }

    if (job.status === 'CANCELLED') {
      this.logger.log(`İş zaten iptal edilmiş: ${jobId}`);
      return;
    }

    // Update status to PROCESSING
    await this.prisma.orderExportJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        progress: 0,
      },
    });

    const ext = job.format.toLowerCase();
    const fileKey = `${job.id}.${ext}`;
    const storageDir = this.getExportStorageDir();
    const filePath = path.join(storageDir, fileKey);

    let writer: CsvExportWriter | XlsxExportWriter | null = null;
    let writeStream: fs.WriteStream | null = null;

    try {
      const columnKeys = (job.columns as string[]) || [];
      const activeColumns = columnKeys
        .map((k) => COLUMNS_MAP.get(k))
        .filter((c): c is NonNullable<typeof c> => !!c);

      const formatOptions = (job.formatOptions as any) || {};
      writeStream = fs.createWriteStream(filePath);

      if (job.format === 'CSV') {
        writer = new CsvExportWriter(writeStream, activeColumns, {
          delimiter: formatOptions.delimiter,
          useBOM: formatOptions.includeBom !== false,
          timezone: formatOptions.timezone,
        });
      } else {
        writer = new XlsxExportWriter(writeStream, activeColumns, {
          timezone: formatOptions.timezone,
          metadata: {
            storeName: job.storeId,
            createdAt: job.createdAt,
          },
        });
      }

      writer.writeHeader();

      // Where clause
      const where = this.buildWhereClause(job.filters, {
        agencyId: job.agencyId,
        storeId: job.storeId,
        clientId: job.clientId || undefined,
      });

      const totalOrders = await this.prisma.order.count({ where });
      let processedOrders = 0;
      let totalRows = 0;
      let cursor: string | undefined = undefined;
      const CHUNK_SIZE = 1000;

      while (true) {
        // Check for cancellation
        const current = await this.prisma.orderExportJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });

        if (current?.status === 'CANCELLED') {
          this.logger.log(`Dışa aktarma işlemi kullanıcı tarafından iptal edildi: ${jobId}`);
          try {
            writeStream?.destroy();
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch {}
          return;
        }

        const orders: any[] = await this.prisma.order.findMany({
          where,
          take: CHUNK_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          include: {
            items: true,
            store: { select: { name: true } },
          },
        });

        if (orders.length === 0) {
          break;
        }

        for (const order of orders) {
          if (job.rowMode === 'LINE_ITEM') {
            if (!order.items || order.items.length === 0) {
              writer.writeRow(order);
              totalRows++;
            } else {
              for (const item of order.items) {
                writer.writeRow(order, item);
                totalRows++;
              }
            }
          } else {
            writer.writeRow(order);
            totalRows++;
          }
          processedOrders++;
        }

        cursor = orders[orders.length - 1].id;

        // Update progress in database
        const progress = totalOrders > 0 ? Math.min(99, Math.round((processedOrders / totalOrders) * 100)) : 100;
        await this.prisma.orderExportJob.update({
          where: { id: jobId },
          data: {
            progress,
            totalRows,
          },
        });

        if (orders.length < CHUNK_SIZE) {
          break;
        }
      }

      await writer.end();

      const stats = fs.statSync(filePath);
      const fileName = `siparis_export_${new Date().toISOString().slice(0, 10)}_${job.id.slice(0, 8)}.${ext}`;

      // Mark COMPLETED
      await this.prisma.orderExportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          totalRows,
          fileKey,
          fileName,
          fileSize: stats.size,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Dışa aktarma tamamlandı: ${jobId} (${totalRows} satır, ${stats.size} bayt)`);
    } catch (err: any) {
      this.logger.error(`Dışa aktarma hatası (${jobId}): ${err.message}`, err.stack);
      try {
        writeStream?.destroy();
      } catch {}

      await this.prisma.orderExportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: err.message || 'Bilinmeyen bir hata oluştu',
          completedAt: new Date(),
        },
      });
    }
  }
}
