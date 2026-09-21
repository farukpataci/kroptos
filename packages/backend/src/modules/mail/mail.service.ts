import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Gercek saglayici sonra takilir; tek metot, tek sozlesme. */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}
export const MAIL_PROVIDER = 'MAIL_PROVIDER';

/**
 * Gelistirme stub'u: mesaji konsola basar. Davet linki burada gorunur ki akis
 * mail sunucusu olmadan uctan uca denenebilsin.
 */
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger('Mail');
  async send(message: MailMessage) {
    this.logger.log(`\n--- MAIL -> ${message.to}\n${message.subject}\n${message.text}\n---`);
  }
}

/**
 * Gonderim BullMQ 'mail' kuyrugundan; Redis yoksa (IntegrationQueueService'in
 * fallback'i gibi) dogrudan provider cagrilir. Istek yolu hicbir durumda mail
 * saglayicisini beklemez.
 */
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private queue?: Queue;
  private worker?: Worker;
  private redisAvailable = false;

  constructor(
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      const url = new URL(redisUrl);
      const connection = { host: url.hostname, port: parseInt(url.port, 10) || 6379 };
      this.queue = new Queue('mail', { connection });
      this.queue.on('error', () => (this.redisAvailable = false));
      this.worker = new Worker('mail', (job) => this.provider.send(job.data as MailMessage), { connection });
      this.worker.on('error', () => (this.redisAvailable = false));
      this.queue.client.then((c) => (c as any).ping().then(() => (this.redisAvailable = true)).catch(() => (this.redisAvailable = false))).catch(() => (this.redisAvailable = false));
    } catch {
      this.redisAvailable = false;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }

  async enqueue(message: MailMessage): Promise<void> {
    if (this.redisAvailable && this.queue) {
      try {
        await this.queue.add('send', message, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true });
        return;
      } catch (e) {
        this.logger.warn(`mail queue unavailable, sending inline: ${(e as Error).message}`);
      }
    }
    await this.provider.send(message);
  }
}
