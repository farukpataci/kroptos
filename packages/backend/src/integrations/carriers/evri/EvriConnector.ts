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
import { mapEvriCreateShipmentData, maskEvriPii } from './EvriMapper';
import { normalizeEvriStatus } from './EvriStatusMap';
import {
  EVRI_ENDPOINTS,
  EvriCredentials,
  EvriShipmentResponse,
  EvriTrackingResponse,
} from './EvriTypes';

export class EvriConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('EVRI', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Evri (Hermes UK)';
  }

  private get baseUrl(): string {
    return this.isTestMode ? EVRI_ENDPOINTS.TEST : EVRI_ENDPOINTS.PRODUCTION;
  }

  private getTypedCredentials(): EvriCredentials {
    const raw = this.requireCredentials('apiKey', 'apiSecret', 'clientId', 'clientSecret');
    return {
      apiKey: raw.apiKey,
      apiSecret: raw.apiSecret,
      clientId: raw.clientId,
      clientSecret: raw.clientSecret,
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const creds = this.getTypedCredentials();
    return {
      'X-API-Key': creds.apiKey,
      'X-API-Secret': creds.apiSecret,
      'X-Client-Id': creds.clientId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.getTypedCredentials();
      await this.throttle();

      const url = `${this.baseUrl}/v1/shipments?limit=1`;
      await this.httpClient.json(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      return 'Evri (Hermes UK) API Gateway ve X-API-Key bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapEvriCreateShipmentData(request, creds);

    await this.throttle();

    try {
      const url = `${this.baseUrl}/v1/shipments`;
      const res = await this.httpClient.json<EvriShipmentResponse>(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res?.errors?.length) {
        throw new Error(res.errors[0].message || 'Evri gönderi oluşturma reddedildi');
      }

      const trackingNumber =
        res?.trackingNumber ||
        res?.barcode ||
        `HRM${Date.now()}GB`;

      const shipmentId = res?.shipmentId || trackingNumber;
      const rawLabel = res?.labelData || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: String(shipmentId),
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskEvriPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.getTypedCredentials();
    await this.throttle();

    try {
      const url = `${this.baseUrl}/v1/shipments/${encodeURIComponent(trackingNumber)}/cancel`;
      await this.httpClient.json(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı Evri kargo gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Evri kargo gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const url = `${this.baseUrl}/v1/shipments/${encodeURIComponent(trackingNumber)}/label`;
    let contentText = '';

    try {
      const res = await this.httpClient.json<EvriShipmentResponse>(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      contentText = res?.labelData || '';
    } catch {
      contentText = `EVRI ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;
    }

    const finalContent = contentText || `EVRI ETİKETİ\nTakip No: ${trackingNumber}`;

    return format === 'ZPL' || format === 'HTML'
      ? { format, content: finalContent }
      : { format, content: Buffer.from(finalContent).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const url = `${this.baseUrl}/v1/tracking/${encodeURIComponent(trackingNumber)}`;
        const res = await this.httpClient.json<EvriTrackingResponse>(url, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

        if (!res || (res as any)?.status === 404 || (res as any)?.error) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = res.status || 'CREATED';
        const mappedStatus = normalizeEvriStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (res.events || []).map((ev) => {
          const stCode = ev.statusCode || 'IN_TRANSIT';
          return {
            at: ev.timestamp ? new Date(ev.timestamp) : new Date(),
            status: normalizeEvriStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.statusDescription || `Evri Durum ${stCode}`,
            location: ev.location,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: res.statusDescription || `Evri durumu: ${rawStatus}`,
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
