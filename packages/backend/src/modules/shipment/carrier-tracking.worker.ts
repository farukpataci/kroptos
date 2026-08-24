import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Queue, Worker } from 'bullmq';
import { Shipment } from '@prisma/client';
import { POLLABLE_SHIPMENT_STATUSES } from '../../integrations/carriers/core/CarrierTypes';
import { CarrierIntegrationService } from './carrier-integration.service';
import { ShipmentService } from './shipment.service';
import { TenantScope } from './tenant-scope';

export const CARRIER_TRACKING_QUEUE = 'carrier-tracking';

/** Half-hourly. Carriers scan a parcel a handful of times a day. */
const SWEEP_INTERVAL_MS = 30 * 60_000;

/** One carrier's rate limit is the ceiling here, not our own patience. */
const MAX_TRACKING_NUMBERS_PER_CALL = 100;

/** A single sweep will not walk the whole table; the rest waits 30 minutes. */
const MAX_SHIPMENTS_PER_SWEEP = 2000;

type Pollable = Pick<
  Shipment,
  'id' | 'agencyId' | 'clientId' | 'storeId' | 'carrierIntegrationId' | 'trackingNumber'
>;

/**
 * The scheduled half of tracking.
 *
 * The manual button on a shipment asks the carrier about one parcel. This asks
 * about all of them, and the difference that matters is the batching: parcels
 * are grouped per carrier connection and handed over in one `track([...])`
 * call. A loop of single lookups would burn a tenant's rate limit for the day
 * before the second carrier was reached.
 *
 * Terminal shipments are not selected at all — a delivered parcel is not going
 * to change, and polling it forever is how the quota goes to answers nobody
 * reads.
 */
@Injectable()
export class CarrierTrackingWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private queue?: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly carriers: CarrierIntegrationService,
    private readonly shipments: ShipmentService,
  ) {}

  private connection() {
    // Read straight from the environment rather than through ConfigService:
    // this module is mounted on its own in the integration suite, where no
    // ConfigModule is registered, and one env var does not need a provider.
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

    this.queue = new Queue(CARRIER_TRACKING_QUEUE, { connection });
    this.worker = new Worker(CARRIER_TRACKING_QUEUE, () => this.sweep(), {
      connection,
      // One at a time on purpose: two concurrent sweeps would ask the same
      // carrier about the same parcels twice.
      concurrency: 1,
    });

    // Redis down is not a startup failure; it is a sweep that does not run.
    // Same posture as the marketplace sync worker, which this sits beside.
    this.queue.on('error', () => undefined);
    this.worker.on('error', () => undefined);
    this.worker.on('failed', (job, error) => {
      console.error(`[carrier-tracking] job ${job?.id} failed: ${error.message}`);
    });

    // Not awaited: with Redis down this call retries in the background, and
    // awaiting it would hold up application startup for a schedule that is not
    // going to register anyway. A fixed jobId keeps a restart from stacking a
    // second schedule on top of the first.
    void this.queue
      .add(
        'sweep',
        {},
        {
          repeat: { every: SWEEP_INTERVAL_MS },
          jobId: 'carrier-tracking-sweep',
          removeOnComplete: true,
          removeOnFail: 100,
        },
      )
      .catch(() => {
        console.warn('[carrier-tracking] Redis unreachable; scheduled tracking is not running.');
      });
  }

  async onModuleDestroy() {
    // Forced: with Redis unreachable the connection is still in its retry loop,
    // and a graceful close waits for a socket that is never coming.
    await this.worker?.close(true).catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }

  /**
   * One pass over everything still in motion, grouped by tenant and carrier
   * connection. Exported for the test — and for an operator who wants a pass
   * now rather than at the next half hour.
   */
  async sweep(): Promise<{ groups: number; shipments: number }> {
    const pollable = await this.prisma.shipment.findMany({
      where: {
        deletedAt: null,
        status: { in: [...POLLABLE_SHIPMENT_STATUSES] },
        trackingNumber: { not: null },
        carrierIntegrationId: { not: null },
      },
      select: {
        id: true,
        agencyId: true,
        clientId: true,
        storeId: true,
        carrierIntegrationId: true,
        trackingNumber: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: MAX_SHIPMENTS_PER_SWEEP,
    });

    // Keyed by tenant AND connection: the same carrier belonging to two
    // agencies is two sets of credentials and must never share a batch.
    const groups = new Map<string, Pollable[]>();
    for (const row of pollable) {
      const key = `${row.agencyId}|${row.clientId ?? ''}|${row.storeId}|${row.carrierIntegrationId}`;
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }

    for (const group of groups.values()) {
      await this.pollGroup(group).catch((error: any) => {
        // One carrier being down does not stop the other carriers' parcels.
        console.error(`[carrier-tracking] group failed: ${error?.message ?? error}`);
      });
    }

    return { groups: groups.size, shipments: pollable.length };
  }

  private async pollGroup(group: Pollable[]) {
    const [first] = group;
    const scope: TenantScope = {
      agencyId: first.agencyId,
      clientId: first.clientId,
      storeId: first.storeId,
    };

    const integration = await this.carriers.findOneOrFail(
      first.carrierIntegrationId ?? '',
      scope,
      { includeDeleted: true },
    );
    const connector = this.carriers.connectorFor(integration);

    for (let i = 0; i < group.length; i += MAX_TRACKING_NUMBERS_PER_CALL) {
      const batch = group.slice(i, i + MAX_TRACKING_NUMBERS_PER_CALL);
      const results = await connector.track(batch.map((row) => row.trackingNumber as string));
      const byTrackingNumber = new Map(results.map((result) => [result.trackingNumber, result]));

      for (const row of batch) {
        const tracking = byTrackingNumber.get(row.trackingNumber as string);
        if (!tracking) continue;

        // Re-read: applyTracking needs the row's own deliveredAt and orderId to
        // decide whether this poll is the delivery transition.
        const shipment = await this.prisma.shipment.findUnique({ where: { id: row.id } });
        if (!shipment) continue;

        try {
          await this.shipments.applyTracking(shipment, tracking, scope, integration.provider);
        } catch (error: any) {
          // An unnormalised status throws before anything is written for this
          // shipment. It stays exactly as it was and the next sweep tries
          // again; the parcels beside it are unaffected.
          console.error(
            `[carrier-tracking] ${integration.provider} ${row.trackingNumber}: ${error?.message ?? error}`,
          );
        }
      }
    }
  }
}
