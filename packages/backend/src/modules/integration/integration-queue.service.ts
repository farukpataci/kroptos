import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EventEmitter } from 'events';

// Shared event emitter for in-memory queue fallback
export const syncEventEmitter = new EventEmitter();

@Injectable()
export class IntegrationQueueService implements OnModuleInit {
  private queue: Queue;
  private isRedisAvailable = true;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      const parsedUrl = new URL(redisUrl);
      this.queue = new Queue('integration-sync', {
        connection: {
          host: parsedUrl.hostname,
          port: parseInt(parsedUrl.port, 10) || 6379,
        },
      });

      // Suppress unhandled connection errors
      this.queue.on('error', () => {
        this.isRedisAvailable = false;
      });

      // Quick check if redis is reachable
      this.queue.client.then((client) => {
        (client as any).ping().catch(() => {
          console.warn('[WARN] Redis is not reachable. Falling back to In-Memory Queue.');
          this.isRedisAvailable = false;
        });
      }).catch(() => {
        this.isRedisAvailable = false;
      });
    } catch (e) {
      console.warn('[WARN] Invalid Redis URL. Falling back to In-Memory Queue.');
      this.isRedisAvailable = false;
    }
  }

  async addSyncJob(
    integrationId: string,
    eventType: string,
    payload: any,
  ) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error(`Integration '${integrationId}' not found`);
    }

    // Create queue record in database
    const queueRecord = await this.prisma.integrationQueue.create({
      data: {
        agencyId: integration.agencyId,
        configId: integrationId,
        eventType,
        payload: JSON.stringify(payload),
        status: 'pending',
      },
    });

    if (this.isRedisAvailable) {
      try {
        await this.queue.add(
          eventType,
          {
            queueRecordId: queueRecord.id,
            integrationId,
            eventType,
            payload,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );
      } catch (err) {
        console.warn('[WARN] Failed to add job to BullMQ. Processing in-memory instead.');
        setImmediate(() => {
          syncEventEmitter.emit('job', {
            queueRecordId: queueRecord.id,
            integrationId,
            eventType,
            payload,
          });
        });
      }
    } else {
      // In-Memory fallback
      setImmediate(() => {
        syncEventEmitter.emit('job', {
          queueRecordId: queueRecord.id,
          integrationId,
          eventType,
          payload,
        });
      });
    }

    return queueRecord;
  }
}
