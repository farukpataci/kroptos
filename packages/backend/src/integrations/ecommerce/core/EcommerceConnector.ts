import { BadRequestException } from '@nestjs/common';
import { EcommerceHttpClient } from './EcommerceHttpClient';
import { EcommerceRateLimiter } from './EcommerceRateLimiter';
import {
  EcommerceConnectionTestResult,
  EcommerceFulfillmentRequest,
  EcommerceFulfillmentResult,
  EcommerceInventoryUpdate,
  EcommerceInventoryUpdateResult,
  EcommerceOrder,
  EcommerceOrderQueryFilter,
  EcommerceProduct,
  EcommerceProvider,
  EcommerceWebhookPayload,
} from './EcommerceTypes';

/**
 * Base abstract class for all E-Commerce platform connectors.
 * Handles rate-limiting, credential resolution, settings access, and defines the unified platform contract.
 */
export abstract class EcommerceConnector {
  protected constructor(
    protected readonly provider: EcommerceProvider,
    protected readonly credentials: Record<string, any>,
    protected readonly httpClient: EcommerceHttpClient,
    protected readonly rateLimiter: EcommerceRateLimiter,
    protected readonly settings: Record<string, unknown> = {},
  ) {}

  /** Requests allowed per minute. Override per provider API specs. */
  protected readonly rateLimitPerMinute: number = 60;

  /** Sliding window throttling bucket key. Usually store domain or provider name. */
  protected get rateLimitKey(): string {
    return this.provider;
  }

  protected throttle(): Promise<void> {
    return this.rateLimiter.throttle(this.rateLimitKey, this.rateLimitPerMinute, 60000);
  }

  /** Human readable name used in user-facing status messages. */
  protected get displayName(): string {
    return this.provider.charAt(0) + this.provider.slice(1).toLowerCase();
  }

  /**
   * Helper to retrieve a typed setting value with fallback.
   */
  protected setting<T>(path: string, defaultValue: T): T {
    if (this.settings && Object.prototype.hasOwnProperty.call(this.settings, path)) {
      return (this.settings[path] as T) ?? defaultValue;
    }
    const segments = path.split('.');
    let current: any = this.settings;
    for (const segment of segments) {
      if (current == null || typeof current !== 'object') return defaultValue;
      current = current[segment];
    }
    return (current as T) ?? defaultValue;
  }

  /**
   * Validates and returns requested credentials or throws BadRequestException.
   */
  protected requireCredentials<K extends string>(...keys: K[]): Record<K, string> {
    const resolved = {} as Record<K, string>;
    const missing: string[] = [];

    for (const key of keys) {
      const value = String(this.credentials[key] ?? '').trim();
      if (!value) missing.push(key);
      resolved[key] = value;
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `${this.displayName} kimlik bilgileri eksik: ${missing.join(', ')}`,
      );
    }

    return resolved;
  }

  /**
   * Tests store connectivity and authentication credentials.
   */
  abstract testConnection(): Promise<EcommerceConnectionTestResult>;

  /**
   * Fetches orders based on filter parameters (e.g. status, dates, limits).
   */
  abstract fetchOrders(filter?: EcommerceOrderQueryFilter): Promise<EcommerceOrder[]>;

  /**
   * Fetches single order details by provider's order ID.
   */
  abstract getOrder(orderId: string): Promise<EcommerceOrder>;

  /**
   * Fulfills an order with tracking information.
   */
  abstract createFulfillment(request: EcommerceFulfillmentRequest): Promise<EcommerceFulfillmentResult>;

  /**
   * Updates inventory/stock level for a product variant.
   */
  abstract updateInventory(update: EcommerceInventoryUpdate): Promise<EcommerceInventoryUpdateResult>;

  /**
   * Fetches products catalogue from the store.
   */
  abstract fetchProducts(limit?: number, page?: number): Promise<EcommerceProduct[]>;

  /**
   * Optional webhook event handler for real-time order/product updates.
   */
  handleWebhook?(payload: EcommerceWebhookPayload): Promise<void>;
}
