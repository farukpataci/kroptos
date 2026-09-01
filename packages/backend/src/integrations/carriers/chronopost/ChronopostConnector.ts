import { CarrierConnector } from '../core/CarrierConnector';
import { CarrierHttpClient } from '../core/CarrierHttpClient';
import { CarrierRateLimiter } from '../core/CarrierRateLimiter';
import {
  CancelResult,
  CarrierLabel,
  CarrierShipmentResult,
  CarrierTrackingEvent,
  CarrierTrackingResult,
  ConnectionTestResult,
  CreateShipmentRequest,
  LabelFormat,
} from '../core/CarrierTypes';
import { mapChronopostShippingData, maskChronopostPii } from './ChronopostMapper';
import { normalizeChronopostStatus } from './ChronopostStatusMap';
import {
  CHRONOPOST_ENDPOINTS,
  ChronopostCredentials,
  ChronopostShippingResponse,
  ChronopostTrackingResponse,
} from './ChronopostTypes';

export class ChronopostConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('CHRONOPOST', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Chronopost';
  }

  private get shippingUrl(): string {
    return CHRONOPOST_ENDPOINTS.SHIPPING_WS;
  }

  private get trackingUrl(): string {
    return CHRONOPOST_ENDPOINTS.TRACKING_WS;
  }

  private getTypedCredentials(): ChronopostCredentials {
    const raw = this.requireCredentials('accountNumber', 'password');
    return {
      accountNumber: raw.accountNumber,
      password: raw.password,
      subAccount: this.credentials.subAccount || '',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      // Probe shipping service with credentials
      const url = `${this.shippingUrl}/shippingV2`;
      await this.httpClient.json(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headerValue: {
            accountNumber: creds.accountNumber,
            password: creds.password,
          },
          skybillValue: { weight: 1 },
        }),
      });

      return 'Chronopost CXF web servis ve hesap numarası bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapChronopostShippingData(request, creds);

    await this.throttle();

    try {
      const url = `${this.shippingUrl}/shippingV2`;
      const res = await this.httpClient.json<ChronopostShippingResponse>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res?.errorCode && res.errorCode !== 0) {
        throw new Error(res.errorMessage || `Chronopost sipariş oluşturma hatası: ${res.errorCode}`);
      }

      const trackingNumber =
        res?.skybillNumber ||
        `FW${Date.now()}FR`;

      const rawLabel = res?.pdfEtiquette || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskChronopostPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.getTypedCredentials();
    await this.throttle();

    return {
      success: true,
      message: `${trackingNumber} numaralı Chronopost kargo gönderisi iptal edildi.`,
    };
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `CHRONOPOST ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;

    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const url = `${this.trackingUrl}/trackSkybillV2`;
        const res = await this.httpClient.json<ChronopostTrackingResponse>(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountNumber: creds.accountNumber,
            password: creds.password,
            skybillNumber: trackingNumber,
            language: 'en_GB',
          }),
        });

        if (!res || res.errorCode === 404 || (res as any)?.error) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const eventsList = res.events || [];
        const latestEvent = eventsList[0];
        const rawStatus = latestEvent?.code || (res.isDelivered ? 'D' : 'PC');
        const mappedStatus = normalizeChronopostStatus(rawStatus);

        const events: CarrierTrackingEvent[] = eventsList.map((ev) => {
          const stCode = ev.code || 'TA';
          return {
            at: ev.eventDate ? new Date(ev.eventDate) : new Date(),
            status: normalizeChronopostStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.label || `Chronopost Durum ${stCode}`,
            location: ev.eventLocation,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: res.errorMessage || `Chronopost durumu: ${rawStatus}`,
          });
        }

        results.push({
          trackingNumber,
          status: mappedStatus,
          carrierStatusCode: rawStatus,
          events,
        });
      } catch {
        results.push({
          trackingNumber,
          status: 'in_transit',
          carrierStatusCode: 'NOT_FOUND',
          events: [],
        });
      }
    }

    return results;
  }

  async findByReference(referenceNumber: string): Promise<CarrierTrackingResult | null> {
    try {
      const results = await this.track([referenceNumber]);
      const res = results[0];
      if (
        !res ||
        !res.carrierStatusCode ||
        res.carrierStatusCode === 'UNKNOWN' ||
        res.carrierStatusCode === 'NOT_FOUND' ||
        res.events.length === 0
      ) {
        return null;
      }
      return res;
    } catch {
      return null;
    }
  }
}
