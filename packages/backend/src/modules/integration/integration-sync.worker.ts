import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MarketplaceCredentialService } from '../../integrations/marketplaces/core/MarketplaceCredentialService';
import { MarketplaceConnectorFactory } from '../../integrations/marketplaces/core/MarketplaceConnectorFactory';
import { syncEventEmitter } from './integration-queue.service';
import { Worker, Job } from 'bullmq';
import { Prisma } from '@prisma/client';

@Injectable()
export class IntegrationSyncWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private credentialService: MarketplaceCredentialService,
    private connectorFactory: MarketplaceConnectorFactory,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    let connectionConfig: any;
    try {
      const parsedUrl = new URL(redisUrl);
      connectionConfig = {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port, 10) || 6379,
      };
    } catch (e) {
      connectionConfig = {
        host: 'localhost',
        port: 6379,
      };
    }

    this.worker = new Worker(
      'integration-sync',
      async (job: Job) => {
        await this.processJob(job.data);
      },
      {
        connection: connectionConfig,
        concurrency: 2,
      },
    );

    // Suppress noisy connection refused stack traces
    this.worker.on('error', (err) => {
      // Quietly consume connection errors when redis is down
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed with error: ${err.message}`);
    });

    // Register In-Memory fallback listener
    syncEventEmitter.on('job', async (data) => {
      try {
        await this.processJob(data);
      } catch (err) {
        console.error('[InMemoryQueue] Job processing failed:', err);
      }
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close().catch(() => {});
    }
  }

  private async processJob(data: {
    queueRecordId: string;
    integrationId: string;
    eventType: string;
    payload: any;
  }) {
    const { queueRecordId, integrationId, eventType, payload } = data;
    const startTime = Date.now();

    // 1. Update status to processing
    await this.prisma.integrationQueue.update({
      where: { id: queueRecordId },
      data: { status: 'processing' },
    });

    try {
      // 2. Fetch integration config
      const integration = await this.prisma.integration.findUnique({
        where: { id: integrationId },
      });

      if (!integration) {
        throw new Error(`Integration with ID '${integrationId}' not found`);
      }

      // Resolve tenant context (clientId and storeId) if not explicitly set
      let storeId = integration.storeId;
      let clientId = integration.clientId;

      if (!clientId || !storeId) {
        // Find the first client under this agency
        const client = await this.prisma.client.findFirst({
          where: { agencyId: integration.agencyId, deletedAt: null },
        });
        if (!client) {
          throw new Error(`No active client found under agency '${integration.agencyId}'`);
        }
        clientId = client.id;

        // Find the first store under this client or agency
        const store = await this.prisma.store.findFirst({
          where: { agencyId: integration.agencyId, clientId, deletedAt: null },
        });
        if (!store) {
          throw new Error(`No active store found under client '${clientId}'`);
        }
        storeId = store.id;
      }

      // 3. Decrypt credentials & build connector
      const credentials = this.credentialService.decrypt(integration.credentialsEncrypted);
      this.credentialService.validate(integration.provider, credentials);
      const connector = this.connectorFactory.create(integration.provider, credentials);

      let logMessage = '';

      if (eventType === 'sync_stock') {
        const { sku, quantity } = payload;
        const res = await connector.updateStock(sku, quantity);
        if (!res.success) {
          throw new Error(res.error || 'Stock update failed');
        }
        logMessage = `Successfully synced stock for SKU '${sku}' to ${quantity}`;
      } else if (eventType === 'sync_products') {
        const marketplaceProducts = await connector.getProducts();

        for (const p of marketplaceProducts) {
          // Upsert product in database
          await this.prisma.product.upsert({
            where: {
              storeId_sku: {
                storeId,
                sku: p.sku,
              },
            },
            create: {
              agencyId: integration.agencyId,
              clientId,
              storeId,
              sku: p.sku,
              name: p.name,
              description: p.description || null,
              price: new Prisma.Decimal(p.price),
              basePrice: new Prisma.Decimal(p.price),
              stockQuantity: p.stockQuantity,
              image: p.image || null,
              barcode: p.barcode || null,
              status: 'active',
            },
            update: {
              name: p.name,
              description: p.description || undefined,
              price: new Prisma.Decimal(p.price),
              stockQuantity: p.stockQuantity,
              image: p.image || undefined,
              barcode: p.barcode || undefined,
            },
          });
        }
        logMessage = `Successfully synced ${marketplaceProducts.length} products.`;
      } else if (eventType === 'sync_orders') {
        const marketplaceOrders = await connector.getOrders();

        for (const o of marketplaceOrders) {
          // Check if order already exists
          const existing = await this.prisma.order.findUnique({
            where: { orderNumber: o.orderNumber },
          });

          if (!existing) {
            // Find or create product references for OrderItems
            const orderItemsData: any[] = [];
            for (const item of o.items) {
              let product = await this.prisma.product.findFirst({
                where: {
                  storeId,
                  sku: item.sku,
                },
              });

              // Create placeholder product if it does not exist
              if (!product) {
                product = await this.prisma.product.create({
                  data: {
                    agencyId: integration.agencyId,
                    clientId,
                    storeId,
                    sku: item.sku,
                    name: item.name,
                    price: new Prisma.Decimal(item.unitPrice),
                    basePrice: new Prisma.Decimal(item.unitPrice),
                    stockQuantity: 0,
                    status: 'active',
                  },
                });
              }

              orderItemsData.push({
                productId: product.id,
                sku: item.sku,
                name: item.name,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice),
                totalPrice: new Prisma.Decimal(item.totalPrice),
              });
            }

            // Create Order
            await this.prisma.order.create({
              data: {
                agencyId: integration.agencyId,
                clientId,
                storeId,
                orderNumber: o.orderNumber,
                customerName: o.customerName,
                customerEmail: o.customerEmail || null,
                customerPhone: o.customerPhone || null,
                shippingAddress: o.shippingAddress || null,
                status: o.status,
                paymentStatus: o.paymentStatus,
                source: o.source,
                totalAmount: new Prisma.Decimal(o.totalAmount),
                currency: o.currency,
                createdBy: 'system',
                items: {
                  create: orderItemsData,
                },
                timeline: {
                  create: {
                    eventType: 'order_created',
                    newValue: 'Order created via sync',
                  },
                },
              },
            });
          }
        }
        logMessage = `Successfully synced ${marketplaceOrders.length} orders.`;
      }

      // 4. Update queue status and integration sync time
      const endTime = Date.now();
      await this.prisma.integrationQueue.update({
        where: { id: queueRecordId },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });

      await this.prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'active',
          lastSyncAt: new Date(),
        },
      });

      // Write API log
      await this.prisma.apiLog.create({
        data: {
          agencyId: integration.agencyId,
          storeId: integration.storeId,
          integrationId,
          endpoint: `bullmq:integration-sync:${eventType}`,
          method: 'QUEUE',
          responseBody: JSON.stringify({ success: true, message: logMessage }),
          statusCode: 200,
          durationMs: endTime - startTime,
        },
      });
    } catch (err: any) {
      console.error('Failed to process job:', err);
      const endTime = Date.now();

      // Update queue to failed
      await this.prisma.integrationQueue.update({
        where: { id: queueRecordId },
        data: {
          status: 'failed',
          error: err.message || JSON.stringify(err),
        },
      });

      // Update integration status to error
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { status: 'error' },
      });

      // Log the API exception
      await this.prisma.apiLog.create({
        data: {
          agencyId: 'system',
          integrationId,
          endpoint: `bullmq:integration-sync:${eventType}`,
          method: 'QUEUE',
          errorMessage: err.message || 'Unknown queue processing error',
          statusCode: 500,
          durationMs: endTime - startTime,
        },
      });
    }
  }
}
