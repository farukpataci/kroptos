import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EventEmitter } from 'events';

export const accountingSyncEventEmitter = new EventEmitter();

export interface AccountingJobData {
  jobType: 'create_invoice' | 'record_payment' | 'keep_alive_tokens';
  payload: any;
  provider?: string;
  attempts?: number;
  scope: {
    agencyId: string;
    clientId?: string;
    storeId?: string;
  };
}

@Injectable()
export class AccountingQueueService implements OnModuleInit {
  private readonly logger = new Logger(AccountingQueueService.name);
  private queue?: Queue;
  private isRedisAvailable = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      const parsedUrl = new URL(redisUrl);
      this.queue = new Queue('accounting-sync', {
        connection: {
          host: parsedUrl.hostname,
          port: parseInt(parsedUrl.port, 10) || 6379,
        },
      });

      this.queue.on('error', () => {
        this.isRedisAvailable = false;
      });

      this.queue.client
        .then((client) => {
          (client as any)
            .ping()
            .then(() => {
              this.isRedisAvailable = true;
            })
            .catch(() => {
              this.logger.warn('Redis unreachable for accounting queue. Falling back to in-memory event bus.');
              this.isRedisAvailable = false;
            });
        })
        .catch(() => {
          this.isRedisAvailable = false;
        });
    } catch {
      this.isRedisAvailable = false;
    }
  }

  async addJob(data: AccountingJobData): Promise<void> {
    const maxAttempts =
      data.attempts !== undefined
        ? data.attempts
        : data.provider?.toUpperCase() === 'BIZIMHESAP'
          ? 1
          : 3;

    if (this.isRedisAvailable && this.queue) {
      try {
        await this.queue.add(data.jobType, data, {
          attempts: maxAttempts,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
        });
        return;
      } catch (err: any) {
        this.logger.warn(`Redis addJob failed, fallback to in-memory: ${err.message}`);
      }
    }

    // In-memory fallback
    setImmediate(() => {
      accountingSyncEventEmitter.emit('sync_job', data);
    });
  }
}
