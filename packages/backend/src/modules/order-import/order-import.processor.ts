import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '@common/prisma/prisma.service';
import { generatePublicId } from '../../common/utils/id-generator';
import { emitOrderChanged } from '../order/order.events';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { escapeFormula } from '../order-export/columns/column-registry';

export const ORDER_IMPORT_QUEUE = 'order-import';

export interface ImportJobPayload {
  jobId: string;
  agencyId: string;
  storeId?: string;
  clientId?: string;
  action?: 'PROCESS' | 'ROLLBACK';
}

@Injectable()
export class OrderImportProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderImportProcessor.name);
  private queue?: Queue<ImportJobPayload>;
  private worker?: Worker<ImportJobPayload>;

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

    this.queue = new Queue(ORDER_IMPORT_QUEUE, { connection });
    this.worker = new Worker(
      ORDER_IMPORT_QUEUE,
      async (job: Job<ImportJobPayload>) => {
        if (job.data.action === 'ROLLBACK') {
          await this.processRollback(job.data);
        } else {
          await this.processImport(job.data);
        }
      },
      {
        connection,
        concurrency: 1, // Process 1 import job at a time per worker to avoid concurrency race conditions
      },
    );

    this.queue.on('error', (err) => {
      this.logger.error(`Import kuyruk hatası: ${err.message}`);
    });
    this.worker.on('error', (err) => {
      this.logger.error(`Import worker hatası: ${err.message}`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`[order-import] İş başarısız (${job?.id}): ${err?.message}`);
    });

    this.logger.log('OrderImportProcessor başlatıldı.');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueJob(payload: ImportJobPayload) {
    if (!this.queue) return;
    try {
      await this.queue.add('process_import', payload, {
        removeOnComplete: 500,
        removeOnFail: 500,
      });
      this.logger.log(`Import işi kuyruğa eklendi: ${payload.jobId} (action: ${payload.action || 'PROCESS'})`);
    } catch (e: any) {
      this.logger.error(`Import işi kuyruğa eklenemedi: ${e?.message}`);
    }
  }

  private getStorageDir(): string {
    const dir = path.join(process.cwd(), 'storage', 'imports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Process an import job
   */
  async processImport(payload: ImportJobPayload): Promise<void> {
    const { jobId } = payload;
    this.logger.log(`Import işi işleniyor: ${jobId}`);

    const job = await this.prisma.orderImportJob.findUnique({
      where: { id: jobId },
    });

    if (!job || (job.status !== 'QUEUED' && job.status !== 'VALIDATED')) {
      this.logger.warn(`İş geçersiz durumda veya bulunamadı: ${jobId} (status: ${job?.status})`);
      return;
    }

    // Set to PROCESSING
    await this.prisma.orderImportJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        progress: 0,
      },
    });

    try {
      const options = (job.options as any) || {};
      const allOrNothing = !!options.allOrNothing;
      const suppressStock = options.suppressStock !== false;
      const suppressNotifications = options.suppressNotifications !== false;
      const suppressAutomation = options.suppressAutomation !== false;

      const suppressList: string[] = [];
      if (suppressStock) suppressList.push('stock');
      if (suppressNotifications) suppressList.push('notifications');
      if (suppressAutomation) suppressList.push('automation');

      // Check if allOrNothing is violated by existing invalid rows
      if (allOrNothing && job.invalidOrders > 0) {
        await this.prisma.orderImportJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
          },
        });
        this.logger.warn(`İş 'all-or-nothing' modu nedeniyle iptal edildi (hatalı siparişler var): ${jobId}`);
        return;
      }

      // Fetch all VALID row results for this job
      const validRows = await this.prisma.orderImportRowResult.findMany({
        where: { jobId, status: 'VALID' },
      });

      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      let skippedCount = job.skippedCount || 0;

      const totalValid = validRows.length;

      for (let i = 0; i < totalValid; i++) {
        const rowResult = validRows[i];
        const parsed = (rowResult.warnings as any)?._parsedOrder || (rowResult.errors as any)?._parsedOrder;

        if (!parsed) {
          // If no cached parsed order data was saved, skip
          continue;
        }

        try {
          await this.prisma.$transaction(async (tx) => {
            if (rowResult.action === 'CREATE') {
              // Create Order
              const orderNumber = parsed.orderNumber || `ORD-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
              const shippingAddressStr = [
                parsed.shippingLine1,
                parsed.shippingDistrict,
                parsed.shippingCity,
                parsed.shippingPostalCode,
                parsed.shippingCountryCode,
              ].filter(Boolean).join(', ') || null;

              // Ensure products exist or fallback for non-catalog items
              const orderItemsData: any[] = [];
              for (const item of (parsed.items || [])) {
                let productId = item.productId;
                if (!productId) {
                  let fallback = await tx.product.findFirst({
                    where: { storeId: job.storeId, sku: 'IMPORT-NON-CATALOG', deletedAt: null },
                  });
                  if (!fallback) {
                    const store = await tx.store.findUnique({
                      where: { id: job.storeId },
                      select: { clientId: true },
                    });
                    const effectiveClientId = job.clientId || store?.clientId || '';

                    fallback = await tx.product.create({
                      data: {
                        agencyId: job.agencyId,
                        clientId: effectiveClientId,
                        storeId: job.storeId,
                        name: 'Katalog Dışı Ürün',
                        sku: 'IMPORT-NON-CATALOG',
                        price: 0,
                        basePrice: 0,
                        stockQuantity: 999999,
                        publicId: generatePublicId('prd', 12),
                      },
                    });
                  }
                  productId = fallback.id;
                }

                orderItemsData.push({
                  productId,
                  name: item.name,
                  sku: item.sku || 'NON-CATALOG',
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice || item.unitPrice * item.quantity,
                });
              }

              const trackingInfo = [parsed.carrierName, parsed.trackingNumber].filter(Boolean).join(' - ');
              const initialNotes = [
                parsed.notes,
                trackingInfo ? `[Kargo: ${trackingInfo}]` : null,
                parsed.invoiceNumber ? `[Fatura No: ${parsed.invoiceNumber}]` : null,
              ].filter(Boolean).join('\n') || null;

              const order = await tx.order.create({
                data: {
                  agencyId: job.agencyId,
                  clientId: job.clientId,
                  storeId: job.storeId,
                  orderNumber,
                  marketplaceOrderNumber: parsed.marketplaceOrderNumber || null,
                  publicId: generatePublicId('ord', 12),
                  importJobId: job.id,
                  customerName: parsed.customerName || 'Müşteri',
                  customerEmail: parsed.customerEmail || null,
                  customerPhone: parsed.customerPhone || null,
                  shippingAddress: shippingAddressStr,
                  shippingFullName: parsed.customerName || null,
                  shippingPhone: parsed.customerPhone || null,
                  shippingLine1: parsed.shippingLine1 || null,
                  shippingDistrict: parsed.shippingDistrict || null,
                  shippingCity: parsed.shippingCity || null,
                  shippingPostalCode: parsed.shippingPostalCode || null,
                  shippingCountryCode: parsed.shippingCountryCode || 'TR',
                  status: parsed.status || 'pending',
                  paymentStatus: parsed.paymentStatus || 'pending',
                  fulfillmentStatus: parsed.fulfillmentStatus || 'unfulfilled',
                  source: parsed.source || 'import',
                  currency: parsed.currency || 'TRY',
                  totalAmount: parsed.totalAmount || 0,
                  notes: initialNotes,
                  tags: parsed.tags || [],
                  priority: parsed.priority || 'normal',
                  isHold: !!parsed.isHold,
                  createdBy: job.requestedById || 'system',
                  items: {
                    create: orderItemsData,
                  },
                  timeline: {
                    create: {
                      eventType: 'order_imported',
                      newValue: parsed.status || 'pending',
                      userId: job.requestedById,
                    },
                  },
                },
              });

              // Update row result
              await tx.orderImportRowResult.update({
                where: { id: rowResult.id },
                data: {
                  status: 'SUCCESS',
                  orderId: order.id,
                },
              });

              createdCount++;

              // Emit event with suppression
              emitOrderChanged({
                orderId: order.id,
                agencyId: job.agencyId,
                clientId: job.clientId,
                storeId: job.storeId,
                kind: 'created',
                newValue: order.status,
                source: 'IMPORT',
                suppress: suppressList,
              });
            } else if (rowResult.action === 'UPDATE') {
              // Find existing order
              const existing = await tx.order.findFirst({
                where: {
                  storeId: job.storeId,
                  deletedAt: null,
                  OR: [
                    { orderNumber: rowResult.groupKey },
                    { marketplaceOrderNumber: rowResult.groupKey },
                    { publicId: rowResult.groupKey },
                    ...(rowResult.orderId ? [{ id: rowResult.orderId }] : []),
                  ],
                },
              });

              if (!existing) {
                throw new Error(`Güncellenecek sipariş bulunamadı: ${rowResult.groupKey}`);
              }

              // Snapshot before updating
              const beforeSnapshot: Record<string, any> = {
                status: existing.status,
                paymentStatus: existing.paymentStatus,
                fulfillmentStatus: existing.fulfillmentStatus,
                notes: existing.notes,
                tags: existing.tags,
                priority: existing.priority,
                isHold: existing.isHold,
              };

              const updateData: any = {};
              if (parsed.status && parsed.status !== existing.status) updateData.status = parsed.status;
              if (parsed.paymentStatus && parsed.paymentStatus !== existing.paymentStatus) updateData.paymentStatus = parsed.paymentStatus;
              if (parsed.fulfillmentStatus && parsed.fulfillmentStatus !== existing.fulfillmentStatus) updateData.fulfillmentStatus = parsed.fulfillmentStatus;
              if (parsed.tags) updateData.tags = parsed.tags;
              if (parsed.priority) updateData.priority = parsed.priority;
              if (parsed.isHold !== undefined) updateData.isHold = parsed.isHold;

              const additionalNotes: string[] = [];
              if (parsed.carrierName || parsed.trackingNumber) {
                additionalNotes.push(`[Kargo: ${[parsed.carrierName, parsed.trackingNumber].filter(Boolean).join(' - ')}]`);
              }
              if (parsed.invoiceNumber) {
                additionalNotes.push(`[Fatura No: ${parsed.invoiceNumber}]`);
              }
              if (parsed.notes) {
                additionalNotes.push(parsed.notes);
              }

              if (additionalNotes.length > 0) {
                updateData.notes = existing.notes
                  ? `${existing.notes}\n${additionalNotes.join('\n')}`
                  : additionalNotes.join('\n');
              }

              await tx.order.update({
                where: { id: existing.id },
                data: {
                  ...updateData,
                  importJobId: job.id,
                  timeline: {
                    create: {
                      eventType: 'order_updated_by_import',
                      newValue: parsed.status || existing.status,
                      userId: job.requestedById,
                    },
                  },
                },
              });

              await tx.orderImportRowResult.update({
                where: { id: rowResult.id },
                data: {
                  status: 'SUCCESS',
                  orderId: existing.id,
                  beforeSnapshot,
                },
              });

              updatedCount++;

              if (updateData.status) {
                emitOrderChanged({
                  orderId: existing.id,
                  agencyId: job.agencyId,
                  clientId: job.clientId,
                  storeId: job.storeId,
                  kind: 'status',
                  oldValue: existing.status,
                  newValue: updateData.status,
                  source: 'IMPORT',
                  suppress: suppressList,
                });
              }
            }
          });
        } catch (err: any) {
          this.logger.error(`Sipariş işleme hatası (${rowResult.groupKey}): ${err.message}`);
          failedCount++;

          await this.prisma.orderImportRowResult.update({
            where: { id: rowResult.id },
            data: {
              status: 'FAILED',
              errors: [
                ...((rowResult.errors as any[]) || []),
                {
                  row: rowResult.rowNumbers[0] || 0,
                  code: 'PROCESS_ERROR',
                  message: err.message || 'İşleme sırasında hata oluştu',
                },
              ],
            },
          });
        }

        // Update progress every 50 rows or at the end
        if ((i + 1) % 50 === 0 || i === totalValid - 1) {
          const progressPct = Math.round(((i + 1) / Math.max(1, totalValid)) * 100);
          await this.prisma.orderImportJob.update({
            where: { id: jobId },
            data: {
              progress: progressPct,
              createdCount,
              updatedCount,
              failedCount,
            },
          });
        }
      }

      // Generate error report if there are any failed or invalid rows
      let errorReportKey: string | undefined;
      const allProblemRows = await this.prisma.orderImportRowResult.findMany({
        where: {
          jobId,
          status: { in: ['INVALID', 'FAILED'] },
        },
      });

      if (allProblemRows.length > 0) {
        errorReportKey = await this.generateErrorReport(job, allProblemRows);
      }

      const hasFailures = failedCount > 0 || job.invalidOrders > 0;
      const finalStatus = hasFailures ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';

      await this.prisma.orderImportJob.update({
        where: { id: jobId },
        data: {
          status: finalStatus,
          progress: 100,
          createdCount,
          updatedCount,
          failedCount,
          skippedCount,
          errorReportKey,
          completedAt: new Date(),
          rollbackDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours deadline
        },
      });

      this.logger.log(`Import işi tamamlandı: ${jobId} (Sonuç: ${finalStatus}, Created: ${createdCount}, Updated: ${updatedCount}, Failed: ${failedCount})`);
    } catch (e: any) {
      this.logger.error(`Import işi beklenmeyen bir hatayla çöktü: ${e.message}`, e.stack);
      await this.prisma.orderImportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Process rollback for an import job
   */
  async processRollback(payload: ImportJobPayload): Promise<void> {
    const { jobId } = payload;
    this.logger.log(`Geri alma işlemi başlatıldı: ${jobId}`);

    const job = await this.prisma.orderImportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return;

    if (job.rollbackDeadline && new Date() > job.rollbackDeadline) {
      this.logger.warn(`Geri alma süresi dolmuş: ${jobId}`);
      return;
    }

    await this.prisma.orderImportJob.update({
      where: { id: jobId },
      data: { status: 'ROLLING_BACK' },
    });

    const successRows = await this.prisma.orderImportRowResult.findMany({
      where: { jobId, status: 'SUCCESS' },
    });

    for (const row of successRows) {
      const orderId = row.orderId;
      if (!orderId) continue;

      try {
        await this.prisma.$transaction(async (tx) => {
          if (row.action === 'CREATE') {
            // Soft delete created order if not processed further
            const order = await tx.order.findUnique({
              where: { id: orderId },
            });

            if (order && !order.deletedAt) {
              await tx.order.update({
                where: { id: orderId },
                data: {
                  deletedAt: new Date(),
                  timeline: {
                    create: {
                      eventType: 'order_rolled_back',
                      newValue: 'deleted',
                      userId: job.requestedById || 'system',
                    },
                  },
                },
              });
            }
          } else if (row.action === 'UPDATE' && row.beforeSnapshot) {
            // Revert fields from beforeSnapshot
            const snapshot = row.beforeSnapshot as Record<string, any>;
            await tx.order.update({
              where: { id: orderId },
              data: {
                status: snapshot.status,
                paymentStatus: snapshot.paymentStatus,
                fulfillmentStatus: snapshot.fulfillmentStatus,
                notes: snapshot.notes,
                tags: snapshot.tags,
                priority: snapshot.priority,
                isHold: snapshot.isHold,
                timeline: {
                  create: {
                    eventType: 'order_update_rolled_back',
                    newValue: snapshot.status,
                    userId: job.requestedById || 'system',
                  },
                },
              },
            });
          }

          await tx.orderImportRowResult.update({
            where: { id: row.id },
            data: { status: 'ROLLED_BACK' },
          });
        });
      } catch (err: any) {
        this.logger.error(`Rollback satır hatası (${row.id}): ${err.message}`);
      }
    }

    await this.prisma.orderImportJob.update({
      where: { id: jobId },
      data: { status: 'ROLLED_BACK' },
    });

    this.logger.log(`Geri alma işlemi tamamlandı: ${jobId}`);
  }

  /**
   * Generate an Excel error report with error reasons
   */
  private async generateErrorReport(job: any, problemRows: any[]): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KroptOS';
    const sheet = workbook.addWorksheet('Hatalı Satırlar');

    sheet.columns = [
      { header: 'Satır No', key: 'rowNumbers', width: 14 },
      { header: 'Sipariş / Grup Anahtarı', key: 'groupKey', width: 25 },
      { header: 'İşlem', key: 'action', width: 12 },
      { header: 'Durum', key: 'status', width: 14 },
      { header: 'Hata Detayları', key: 'errors', width: 50 },
      { header: 'Uyarılar', key: 'warnings', width: 40 },
    ];

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC2626' }, // Red 600
    };
    header.height = 24;

    for (const r of problemRows) {
      const errList = Array.isArray(r.errors)
        ? r.errors.map((e: any) => `[${e.code || 'Hata'}] ${e.column ? e.column + ': ' : ''}${e.message}`).join('; ')
        : '';
      const warnList = Array.isArray(r.warnings)
        ? r.warnings.map((w: any) => `[${w.code || 'Uyarı'}] ${w.column ? w.column + ': ' : ''}${w.message}`).join('; ')
        : '';

      sheet.addRow({
        rowNumbers: Array.isArray(r.rowNumbers) ? r.rowNumbers.join(', ') : String(r.rowNumbers || ''),
        groupKey: escapeFormula(r.groupKey),
        action: r.action,
        status: r.status,
        errors: escapeFormula(errList),
        warnings: escapeFormula(warnList),
      });
    }

    const storageDir = this.getStorageDir();
    const fileName = `error-report-${job.id}.xlsx`;
    const fullPath = path.join(storageDir, fileName);

    await workbook.xlsx.writeFile(fullPath);
    return fileName;
  }
}
