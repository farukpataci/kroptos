import { BadRequestException } from '@nestjs/common';
import { CarrierHttpClient, CarrierHttpError } from './CarrierHttpClient';
import { CarrierRateLimiter } from './CarrierRateLimiter';
import {
  CancelResult,
  CarrierLabel,
  CarrierShipmentResult,
  CarrierTrackingResult,
  ConnectionTestResult,
  CreateReturnRequest,
  CreateShipmentRequest,
  LabelFormat,
  RateQuote,
  RateQuoteRequest,
} from './CarrierTypes';

/**
 * Base class every carrier connector extends. Mirrors MarketplaceConnector:
 * the shared parts are throttling, credential checks, and turning a transport
 * failure into a sentence an operator can act on — everything else is the
 * carrier's own protocol.
 */
export abstract class CarrierConnector {
  protected constructor(
    protected readonly provider: string,
    protected readonly credentials: Record<string, any>,
    protected readonly httpClient: CarrierHttpClient,
    protected readonly rateLimiter: CarrierRateLimiter,
    /**
     * Whether this connector is bound to the carrier's test environment.
     * Carried here, not just on the integration row, so a connector that has no
     * live endpoint can refuse to run outside test mode instead of inventing a
     * tracking number an operator would hand to a customer.
     */
    protected readonly isTestMode: boolean = true,
  ) {}

  /** Requests per minute. Override per carrier from their published quota. */
  protected readonly rateLimitPerMinute: number = 60;

  /** Throttling bucket; a carrier whose quota is per account overrides it. */
  protected get rateLimitKey(): string {
    return this.provider;
  }

  protected throttle(): Promise<void> {
    return this.rateLimiter.throttle(this.rateLimitKey, this.rateLimitPerMinute, 60000);
  }

  /** Human-readable carrier name used in operator-facing messages. */
  protected get displayName(): string {
    return this.provider.charAt(0) + this.provider.slice(1).toLowerCase();
  }

  /**
   * Fails before any request when a required credential is blank. Naming the
   * empty field beats letting the carrier answer with a generic 401.
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
      // BadRequestException, not Error: the operator left a field blank, and a
      // bare Error surfaces to them as a 500 "sunucu hatası" for something they
      // can fix in the connection form in ten seconds.
      throw new BadRequestException(
        `${this.displayName} kimlik bilgileri eksik: ${missing.join(', ')}`,
      );
    }

    return resolved;
  }

  /** Runs testConnection bookkeeping so every carrier reports it the same way. */
  protected async probe(run: () => Promise<string>): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      return { success: true, message: await run(), durationMs: Date.now() - startTime };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${this.displayName} bağlantısı doğrulanamadı`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /** Turns a transport error into something an operator can act on. */
  protected describeError(error: any): Error {
    const status = error instanceof CarrierHttpError ? error.upstreamStatus : undefined;
    const body = error instanceof CarrierHttpError ? error.upstreamBody?.trim() : undefined;
    const detail = body ? ` Sunucu yanıtı: ${body.slice(0, 300)}` : '';
    const name = this.displayName;

    switch (status) {
      case 401:
      case 403:
        return new Error(
          `${name} kimlik doğrulaması reddedildi (${status}). Müşteri kodu veya şifre hatalı olabilir.${detail}`,
        );
      case 404:
        return new Error(`${name} uç noktası bulunamadı (404). Ortam seçimi hatalı olabilir.${detail}`);
      case 429:
        return new Error(`${name} istek limiti aşıldı (429). Daha sonra tekrar deneyin.${detail}`);
      default:
        if (status && status >= 500) {
          return new Error(`${name} tarafında geçici hata (${status}). Daha sonra tekrar deneyin.${detail}`);
        }
        return new Error(
          error?.message ? `${name} isteği başarısız: ${error.message}${detail}` : `${name} isteği başarısız${detail}`,
        );
    }
  }

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract createShipment(req: CreateShipmentRequest): Promise<CarrierShipmentResult>;
  abstract getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel>;
  /** Batched on purpose: one request per shipment burns the carrier's quota. */
  abstract track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]>;
  abstract cancelShipment(trackingNumber: string): Promise<CancelResult>;
  // Optional capabilities. Declared without `abstract` on purpose: an optional
  // abstract member still has to be implemented by every subclass, which would
  // force every carrier to stub a rating endpoint it does not have. Callers
  // test for the method (`if (!connector.getRates) ...`) before using it.

  /** Most Turkish carriers publish no rating endpoint; aggregators do. */
  getRates?(req: RateQuoteRequest): Promise<RateQuote[]>;
  /** Reverse logistics, where the carrier issues a return code. */
  createReturn?(req: CreateReturnRequest): Promise<CarrierShipmentResult>;
  /**
   * "Did this shipment actually get created?" asked with our own reference
   * code. The only safe way to settle a claim row whose createShipment call
   * timed out — the timeout may well have bought a barcode. Implement it
   * wherever the carrier allows lookup by the sender's reference.
   */
  findByReference?(referenceCode: string): Promise<CarrierShipmentResult | null>;
}
