import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class SettingsCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(SettingsCacheService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) return null; // stop retrying after 3 attempts
          return Math.min(times * 200, 1000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        // Do not spam console with recurring errors
      });

      this.client.connect().catch(() => {
        this.isConnected = false;
      });
    } catch (e) {
      this.isConnected = false;
      this.logger.warn('Redis client initialization failed. Settings cache will operate in bypass mode.');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Ignored: Redis failure must never break requests
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // Ignored
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // Ignored
    }
  }

  async invalidateStoreSettings(storeId: string): Promise<void> {
    await this.del(`order-settings:store:${storeId}`);
  }

  async invalidateAgencySettings(agencyId: string): Promise<void> {
    await this.delByPattern(`order-settings:agency:${agencyId}*`);
    await this.delByPattern(`order-settings:store:*`);
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // Ignored
      }
    }
  }
}
