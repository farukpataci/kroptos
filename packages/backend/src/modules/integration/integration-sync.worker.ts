import { Injectable, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MarketplaceCredentialService } from '../../integrations/marketplaces/core/MarketplaceCredentialService';
import { MarketplaceConnectorFactory } from '../../integrations/marketplaces/core/MarketplaceConnectorFactory';
import type { MarketplaceConnector } from '../../integrations/marketplaces/core/MarketplaceConnector';
import { ErpConnectorFactory } from '../../integrations/erp/core/ErpConnectorFactory';
import { decrypt } from '../../common/utils/encryption.util';
import { syncEventEmitter } from './integration-queue.service';
import { IntegrationSettingsService } from '../integration-settings/integration-settings.service';
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
    private erpConnectorFactory: ErpConnectorFactory,
    @Inject(forwardRef(() => IntegrationSettingsService))
    private settingsService: IntegrationSettingsService,
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

  /**
   * Turns an on-hand quantity into the number actually pushed to the
   * marketplace, applying the buffer, cap and minimum-threshold settings.
   * Keeping it here rather than in each connector means one rule for all five.
   */
  private applyStockPolicy(quantity: number, settings: Record<string, unknown>): number {
    const num = (key: string, fallback: number) => {
      const value = Number(settings[key]);
      return Number.isFinite(value) ? value : fallback;
    };

    const buffer = num('stock.bufferQuantity', 0);
    const bufferPercent = num('stock.bufferPercent', 0);
    const minThreshold = num('stock.minThreshold', 0);
    const maxCap = settings['stock.maxCap'];

    let available = quantity - buffer - Math.floor((quantity * bufferPercent) / 100);
    if (available < 0) available = 0;
    if (available < minThreshold) available = 0;

    const cap = Number(maxCap);
    if (Number.isFinite(cap) && cap > 0 && available > cap) available = cap;

    return available;
  }

  private async processJob(data: {
    queueRecordId: string;
    integrationId: string;
    eventType: string;
    payload: any;
  }) {
    const { queueRecordId, integrationId, eventType, payload } = data;
    const startTime = Date.now();

    // Set once a marketplace connector is built, so the rotated-credential
    // check after the sync can reach it without widening the branch scopes.
    let rotatingConnector: MarketplaceConnector | undefined;

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

      // Resolve tenant context. The two ids are resolved independently: an
      // integration scoped to a store but not a client (`storeId` set,
      // `clientId` null) is the normal shape here, and resolving them as one
      // unit threw away the store the integration named, then demanded a store
      // under a client that has none — every sync job failed before a single
      // marketplace call.
      let storeId = integration.storeId;
      let clientId = integration.clientId;

      if (!storeId) {
        const store = await this.prisma.store.findFirst({
          where: {
            agencyId: integration.agencyId,
            deletedAt: null,
            // Narrow by client only when the integration actually names one:
            // stores may sit directly under the agency with a null clientId.
            ...(clientId ? { clientId } : {}),
          },
          // Which store receives imported products decides who can see them, so
          // it must not depend on row order.
          orderBy: { createdAt: 'asc' },
        });
        if (!store) {
          throw new Error(
            `No active store found for integration '${integration.id}' under agency ` +
              `'${integration.agencyId}'${clientId ? ` and client '${clientId}'` : ''}`,
          );
        }
        storeId = store.id;
      }

      if (!clientId) {
        // Product.clientId is required, so a client has to be resolved even for
        // an agency-wide integration. The store's own client is the truthful
        // answer; only when the store has none does the agency's oldest client
        // stand in.
        const store = await this.prisma.store.findUnique({
          where: { id: storeId },
          select: { clientId: true },
        });
        clientId = store?.clientId ?? null;

        if (!clientId) {
          const client = await this.prisma.client.findFirst({
            where: { agencyId: integration.agencyId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          });
          if (!client) {
            throw new Error(`No active client found under agency '${integration.agencyId}'`);
          }
          clientId = client.id;
        }
      }

      let logMessage = '';

      if (integration.providerType === 'erp') {
        const erpCredentials = JSON.parse(decrypt(integration.credentialsEncrypted));
        const erpConnector = this.erpConnectorFactory.create(integration.provider, erpCredentials);

        if (eventType === 'sync_stock') {
          const { sku, quantity } = payload;
          // Look up mapped ERP code
          const productMapping = await this.prisma.logoProductMapping.findUnique({
            where: {
              agencyId_productSku: {
                agencyId: integration.agencyId,
                productSku: sku,
              },
            },
          });
          const targetSku = productMapping ? productMapping.erpStockCode : sku;

          const res = await erpConnector.updateStock(targetSku, quantity);
          if (!res.success) {
            throw new Error(res.error || 'Stock update failed in ERP');
          }
          logMessage = `Successfully synced stock for SKU '${sku}' (ERP Code: '${targetSku}') to ${quantity} in ERP`;
        } else if (eventType === 'sync_products') {
          const erpProducts = await erpConnector.getProducts();

          for (const p of erpProducts) {
            // Check mapping
            let productMapping = await this.prisma.logoProductMapping.findFirst({
              where: {
                agencyId: integration.agencyId,
                erpStockCode: p.sku,
              },
            });

            // Auto-create mapping card if it doesn't exist
            if (!productMapping) {
              productMapping = await this.prisma.logoProductMapping.create({
                data: {
                  agencyId: integration.agencyId,
                  productSku: p.sku,
                  erpStockCode: p.sku,
                  productName: p.name,
                  erpStockName: p.name,
                  barcode: p.barcode || null,
                  status: 'matched',
                },
              });
            }

            const targetSku = productMapping.productSku;

            // Upsert product in database
            await this.prisma.product.upsert({
              where: {
                storeId_sku: {
                  storeId,
                  sku: targetSku,
                },
              },
              create: {
                agencyId: integration.agencyId,
                clientId,
                storeId,
                sku: targetSku,
                name: p.name,
                description: p.description || null,
                price: new Prisma.Decimal(p.price),
                basePrice: new Prisma.Decimal(p.price),
                stockQuantity: p.stockQuantity,
                barcode: p.barcode || null,
                erpCode: p.erpCode || null,
                status: 'active',
              },
              update: {
                name: p.name,
                description: p.description || undefined,
                price: new Prisma.Decimal(p.price),
                stockQuantity: p.stockQuantity,
                barcode: p.barcode || undefined,
                erpCode: p.erpCode || undefined,
              },
            });
          }
          logMessage = `Successfully synced ${erpProducts.length} products from ERP.`;
          // 1. Fetch pending orders that are marked for Logo ERP sync (excluding POOL orders)
          const pendingOrders = await this.prisma.order.findMany({
            where: {
              agencyId: integration.agencyId,
              status: { in: ['pending', 'processing'] },
              isPoolOrder: false,
              logoSyncStatus: { in: ['PENDING', 'FAILED'] },
            },
            include: { items: true },
          });

          // Resolve default warehouse mapping for this agency context if it exists
          const warehouseMapping = await this.prisma.logoWarehouseMapping.findFirst({
            where: {
              agencyId: integration.agencyId,
              isActive: true,
            },
          });
          const targetWarehouseNo = warehouseMapping ? warehouseMapping.erpDepotCode : undefined;

          let count = 0;
          for (const o of pendingOrders) {
            try {
              // 1. Idempotency Check: Prevent duplicate syncs if already processed
              const alreadySynced = await this.prisma.orderTimeline.findFirst({
                where: {
                  orderId: o.id,
                  eventType: 'erp_synced',
                },
              });
              if (alreadySynced) {
                await this.prisma.order.update({
                  where: { id: o.id },
                  data: { status: 'processing' },
                });
                continue;
              }

              // 2. Product SKU Code Mapping
              const mappedItems = [];
              for (const item of o.items) {
                const productMapping = await this.prisma.logoProductMapping.findUnique({
                  where: {
                    agencyId_productSku: {
                      agencyId: integration.agencyId,
                      productSku: item.sku,
                    },
                  },
                });
                mappedItems.push({
                  sku: productMapping ? productMapping.erpStockCode : item.sku,
                  quantity: item.quantity,
                  unitPrice: Number(item.unitPrice),
                });
              }

              const res = await erpConnector.createSalesOrder({
                orderNumber: o.orderNumber,
                customerName: o.customerName,
                customerEmail: o.customerEmail || undefined,
                customerPhone: o.customerPhone || undefined,
                shippingAddress: o.shippingAddress || undefined,
                totalAmount: Number(o.totalAmount),
                currency: o.currency,
                items: mappedItems,
                warehouseNo: targetWarehouseNo,
              });

              if (res.success) {
                count++;
                await this.prisma.order.update({
                  where: { id: o.id },
                  data: { status: 'processing', logoSyncStatus: 'SYNCED' },
                });

                await this.prisma.orderTimeline.create({
                  data: {
                    orderId: o.id,
                    eventType: 'erp_synced',
                    newValue: `Order exported to Logo ERP (LogicalRef: ${res.logicalRef || 'N/A'})`,
                  },
                });
              }
            } catch (err: any) {
              console.error(`Failed to sync order ${o.orderNumber} to ERP:`, err.message);
            }
          }
          logMessage = `Successfully synced ${count} orders to Logo ERP.`;
        }
      } else {
        // Marketplace integration sync logic
        const credentials = this.credentialService.decrypt(integration.credentialsEncrypted);
        this.credentialService.validate(integration.provider, credentials);
        // Behaviour settings (rate limit, buffers, dry run) come from the
        // integration's manifest-backed configuration rather than constants.
        const settings = await this.settingsService.resolveForRuntime(integration.id);
        const connector = this.connectorFactory.create(integration.provider, credentials, settings);
        rotatingConnector = connector;
        const dryRun = settings['advanced.dryRun'] === true;

        // A connector in simulation mode serves its own sample data because its
        // endpoints are not verified yet. Persisting that would put invented
        // orders and products in the seller's tables, where no query downstream
        // could tell them from real ones — and a filter that every list query
        // has to remember is a leak waiting for the one query that forgets. So
        // simulated rows are counted and logged here and never written.
        const { mode, source: modeSource } = connector.connectionMode;
        const simulated = mode === 'simulation';
        const modeTag = simulated ? `[simulation:${modeSource}] ` : '';

        if (eventType === 'sync_stock') {
          const { sku, quantity } = payload;
          const outbound = this.applyStockPolicy(quantity, settings);

          // Some marketplaces key inventory on the barcode rather than the
          // seller's stock code (Trendyol does), and a mismatched identifier is
          // accepted and then matches nothing. Resolved here rather than in the
          // enqueuing service so every caller of this event gets it, and read
          // from the store the integration resolved to so one tenant's SKU can
          // never pick up another tenant's barcode.
          const product = await this.prisma.product.findFirst({
            where: { storeId, sku, deletedAt: null },
            select: { barcode: true },
          });

          if (simulated) {
            logMessage =
              `${modeTag}SKU '${sku}' için stok ${outbound} olarak gönderilecekti; ` +
              `simülasyon modunda pazaryerine istek gönderilmedi.`;
          } else if (dryRun) {
            logMessage = `[dry-run] Would have pushed stock ${outbound} for SKU '${sku}'`;
          } else {
            const res = await connector.updateStock(sku, outbound, { barcode: product?.barcode });
            if (!res.success) {
              throw new Error(res.error || 'Stock update failed');
            }
            logMessage =
              `Successfully synced stock for SKU '${sku}'` +
              `${product?.barcode ? ` (barcode: '${product.barcode}')` : ''} to ${outbound}`;
          }
        } else if (eventType === 'sync_products') {
          const marketplaceProducts = await connector.getProducts();

          for (const p of simulated ? [] : marketplaceProducts) {
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
          logMessage = simulated
            ? `${modeTag}${marketplaceProducts.length} örnek ürün üretildi, veritabanına yazılmadı.`
            : `Successfully synced ${marketplaceProducts.length} products.`;
        } else if (eventType === 'sync_orders') {
          const marketplaceOrders = await connector.getOrders();

          for (const o of simulated ? [] : marketplaceOrders) {
            // Scoped to the store: an unscoped lookup found another tenant's
            // order with the same number and skipped the import, so this tenant
            // never got the order at all.
            const existing = await this.prisma.order.findUnique({
              where: { storeId_orderNumber: { storeId, orderNumber: o.orderNumber } },
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

              // Check store order processing mode (LOGO_SYNC vs POOL_ONLY / MANUAL_APPROVAL)
              const targetStore = await this.prisma.store.findUnique({
                where: { id: storeId },
                select: { orderProcessingMode: true },
              });
              const processingMode = targetStore?.orderProcessingMode || 'LOGO_SYNC';
              const isPool = processingMode === 'POOL_ONLY' || processingMode === 'MANUAL_APPROVAL';
              const initialLogoSyncStatus = processingMode === 'POOL_ONLY' ? 'BYPASSED_POOL' : 'PENDING';

              // Create Order
              await this.prisma.order.create({
                data: {
                  agencyId: integration.agencyId,
                  clientId,
                  storeId,
                  orderNumber: o.orderNumber,
                  // Set only by marketplaces that split an order across
                  // shipments; `orderNumber` is then composite and this keeps
                  // the number the seller and buyer actually quote.
                  marketplaceOrderNumber: o.marketplaceOrderNumber || null,
                  customerName: o.customerName,
                  customerEmail: o.customerEmail || null,
                  customerPhone: o.customerPhone || null,
                  shippingAddress: o.shippingAddress || null,
                  // The mapper already translated the marketplace's own status;
                  // hard-coding 'pending' threw that away, so an order that
                  // arrived already shipped showed up as awaiting action.
                  status: o.status || 'pending',
                  paymentStatus: o.paymentStatus || 'pending',
                  totalAmount: new Prisma.Decimal(o.totalAmount),
                  currency: o.currency || 'TRY',
                  source: o.source || 'marketplace',
                  isPoolOrder: isPool,
                  logoSyncStatus: initialLogoSyncStatus,
                  createdBy: 'system',
                  items: {
                    create: orderItemsData,
                  },
                },
              });
            } else if (o.status && existing.status !== o.status) {
              // The package moved on the marketplace side. Only the status is
              // touched: logoSyncStatus and isPoolOrder describe our own
              // pipeline, and overwriting them here would undo work the ERP or
              // an operator already did.
              await this.prisma.order.update({
                where: { id: existing.id },
                data: {
                  status: o.status,
                  timeline: {
                    create: {
                      eventType: 'status_changed',
                      oldValue: existing.status,
                      newValue: o.status,
                    },
                  },
                },
              });
            }
          }
          logMessage = simulated
            ? `${modeTag}${marketplaceOrders.length} örnek sipariş üretildi, veritabanına yazılmadı.`
            : `Successfully synced ${marketplaceOrders.length} orders.`;
        }
      }

      // A marketplace that rotates its refresh token does so during the calls
      // above; collecting it here means a long-running sync cannot leave the
      // stored credential a generation behind.
      if (rotatingConnector) {
        const rotated = rotatingConnector.consumeRotatedCredentials();
        if (rotated) {
          await this.credentialService.persistRotatedCredentials(integrationId, rotated);
        }
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
          // A successful run clears a previous error, but it must never re-enable
          // an integration the user paused: status is the user's switch, not ours.
          ...(integration.status === 'error' ? { status: 'active' } : {}),
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
