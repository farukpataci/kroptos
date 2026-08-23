import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CarrierConnector } from '../core/CarrierConnector';
import { CarrierHttpClient } from '../core/CarrierHttpClient';
import { CarrierRateLimiter } from '../core/CarrierRateLimiter';
import {
  CancelResult,
  CarrierLabel,
  CarrierShipmentResult,
  CarrierTrackingResult,
  ConnectionTestResult,
  CreateShipmentRequest,
  LabelFormat,
} from '../core/CarrierTypes';

/**
 * Sample carrier with no upstream API, so the shipment module, the WMS packaging
 * flow and the UI can be built before a single carrier contract is signed.
 *
 * Refuses to run outside test mode. A mock that silently answers a live request
 * hands the operator a tracking number no carrier has ever heard of — the
 * failure only surfaces when a customer asks where their parcel is.
 */
export class MockCarrierConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('MOCK', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected get displayName(): string {
    return 'Örnek Kargo (test)';
  }

  private assertTestMode(): void {
    if (!this.isTestMode) {
      throw new ServiceUnavailableException(
        'Örnek Kargo yalnızca test modunda çalışır. Canlı gönderi için gerçek bir taşıyıcı bağlantısı tanımlayın.',
      );
    }
  }

  /** Stable per reference: calling twice must not mint a second barcode. */
  private syntheticNumber(prefix: string, seed: string): string {
    const digest = createHash('sha256').update(seed).digest('hex').slice(0, 10).toUpperCase();
    return `${prefix}${digest}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.assertTestMode();
      await this.throttle();
      return 'Örnek Kargo test bağlantısı hazır (gerçek bir taşıyıcıya bağlanmaz).';
    });
  }

  async createShipment(req: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    this.assertTestMode();
    await this.throttle();

    // Reads the desi it was handed; a connector never recomputes it.
    const totalDesi = req.parcels.reduce((sum, p) => sum + p.desi, 0);
    const seed = req.referenceCode || req.orderId || req.orderNumber;
    const trackingNumber = this.syntheticNumber('MOCK', seed);

    return {
      trackingNumber,
      barcode: this.syntheticNumber('BC', seed),
      carrierShipmentId: this.syntheticNumber('SHP', seed),
      raw: { simulated: true, orderNumber: req.orderNumber, totalDesi, desiDivisor: req.desiDivisor },
    };
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.assertTestMode();

    const text = `ORNEK KARGO ETIKETI\nTakip No: ${trackingNumber}\nBu etiket gerçek değildir.`;
    return format === 'ZPL' || format === 'HTML'
      ? { format, content: text }
      : { format, content: Buffer.from(text, 'utf8').toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    this.assertTestMode();
    await this.throttle();

    return trackingNumbers.map((trackingNumber) => ({
      trackingNumber,
      status: 'in_transit',
      carrierStatusCode: 'MOCK_IN_TRANSIT',
      events: [
        {
          at: new Date(),
          status: 'in_transit',
          carrierStatusCode: 'MOCK_IN_TRANSIT',
          description: 'Gönderi transfer merkezinde (örnek veri)',
          location: 'İstanbul',
        },
      ],
    }));
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.assertTestMode();
    return { success: true, message: `${trackingNumber} iptal edildi (örnek veri)` };
  }

  /**
   * Always null: this mock keeps no state between requests, so it genuinely
   * cannot know whether a reference was ever minted. Answering with a synthetic
   * barcode would be worse than useless — it would claim a shipment exists at a
   * carrier that has never heard of it.
   */
  async findByReference(_referenceCode: string): Promise<CarrierShipmentResult | null> {
    this.assertTestMode();
    return null;
  }
}
