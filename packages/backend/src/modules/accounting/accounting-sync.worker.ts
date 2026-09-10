import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { AccountingDocumentService } from './accounting-document.service';
import { AccountingService } from './accounting.service';
import {
  AccountingJobData,
  accountingSyncEventEmitter,
} from './accounting-queue.service';

@Injectable()
export class AccountingSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountingSyncWorker.name);
  private worker?: Worker;
  private keepAliveInterval?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentService: AccountingDocumentService,
    private readonly accountingService: AccountingService,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      const parsedUrl = new URL(redisUrl);
      this.worker = new Worker(
        'accounting-sync',
        async (job: Job<AccountingJobData>) => {
          await this.processJob(job.data);
        },
        {
          connection: {
            host: parsedUrl.hostname,
            port: parseInt(parsedUrl.port, 10) || 6379,
          },
          concurrency: 5,
        },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Accounting sync job failed: ${job?.id} - ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`BullMQ worker init skipped: ${err.message}`);
    }

    // Also listen to in-memory fallback
    accountingSyncEventEmitter.on('sync_job', async (data: AccountingJobData) => {
      try {
        await this.processJob(data);
      } catch (err: any) {
        this.logger.error(`In-memory sync job failed: ${err.message}`);
      }
    });

    // §4.2 Weekly keep-alive token refresh for Sage integrations (every 7 days)
    this.keepAliveInterval = setInterval(
      async () => {
        try {
          await this.accountingService.runKeepAliveJob();
        } catch (err: any) {
          this.logger.error(`Sage keep-alive job failed: ${err.message}`);
        }
      },
      7 * 24 * 60 * 60 * 1000,
    );
  }

  async processJob(data: AccountingJobData): Promise<void> {
    this.logger.log(`Processing accounting job: ${data.jobType}`);
    if (data.jobType === 'create_invoice') {
      await this.documentService.createInvoiceDocument(data.payload, data.scope);
    } else if (data.jobType === 'record_payment') {
      await this.documentService.createPaymentDocument(data.payload, data.scope);
    } else if (data.jobType === 'keep_alive_tokens') {
      await this.accountingService.runKeepAliveJob();
    }
  }

  async onModuleDestroy() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    if (this.worker) {
      await this.worker.close();
    }
  }
}
