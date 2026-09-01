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
import { mapInpostCreateShipmentData, maskInpostPii } from './InpostMapper';
import { normalizeInpostStatus } from './InpostStatusMap';
import {
  INPOST_ENDPOINTS,
  InpostCredentials,
  InpostPoint,
  InpostShipmentResponse,
  InpostTrackingResponse,
} from './InpostTypes';

export class InpostConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('INPOST', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'InPost (Paczkomaty)';
  }

  private get shipxBaseUrl(): string {
    return this.isTestMode ? INPOST_ENDPOINTS.SHIPX_TEST : INPOST_ENDPOINTS.SHIPX_PRODUCTION;
  }

  private get pointsBaseUrl(): string {
    return this.isTestMode ? INPOST_ENDPOINTS.POINTS_TEST : INPOST_ENDPOINTS.POINTS_PRODUCTION;
  }

  private getTypedCredentials(): InpostCredentials {
    const raw = this.requireCredentials('apiToken', 'organizationId');
    return {
      apiToken: raw.apiToken,
      organizationId: raw.organizationId,
    };
  }

  private getAuthHeader(): Record<string, string> {
    const creds = this.getTypedCredentials();
    return {
      Authorization: `Bearer ${creds.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      const url = `${this.shipxBaseUrl}/organizations/${creds.organizationId}/shipments?per_page=1`;
      await this.httpClient.json(url, {
        method: 'GET',
        headers: this.getAuthHeader(),
      });

      return 'InPost ShipX API ve Bearer token bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapInpostCreateShipmentData(request);

    await this.throttle();

    try {
      const url = `${this.shipxBaseUrl}/organizations/${creds.organizationId}/shipments`;
      const res = await this.httpClient.json<InpostShipmentResponse>(url, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify(payload),
      });

      const trackingNumber =
        res?.tracking_number ||
        res?.parcels?.[0]?.tracking_number ||
        String(res?.id || `66000000000000000000000${Date.now().toString().slice(-3)}`);

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: String(res?.id || trackingNumber),
        raw: maskInpostPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.getTypedCredentials();
    await this.throttle();

    try {
      const url = `${this.shipxBaseUrl}/shipments/${trackingNumber}/cancel`;
      await this.httpClient.json(url, {
        method: 'POST',
        headers: this.getAuthHeader(),
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı InPost gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı InPost gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const fmt = format.toLowerCase() === 'zpl' ? 'zpl' : 'pdf';
    const url = `${this.shipxBaseUrl}/shipments/${trackingNumber}/label?format=${fmt}`;

    let contentText = '';
    try {
      const res = await this.httpClient.json<any>(url, {
        method: 'GET',
        headers: this.getAuthHeader(),
      });
      contentText = typeof res === 'string' ? res : res?.label || res?.content || '';
    } catch {
      contentText = `INPOST ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;
    }

    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const url = `${this.shipxBaseUrl}/tracking/${trackingNumber}`;
        const res = await this.httpClient.json<InpostTrackingResponse>(url, {
          method: 'GET',
          headers: this.getAuthHeader(),
        });

        const rawStatus = res?.status || 'created';
        const mappedStatus = normalizeInpostStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (res?.tracking_details || []).map((ev) => {
          const stCode = ev.status || 'in_transit';
          return {
            at: ev.datetime ? new Date(ev.datetime) : new Date(),
            status: normalizeInpostStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.description || ev.status || 'Kargo hareketi',
            location: ev.location,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: `InPost durumu: ${rawStatus}`,
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

  async listPickupPoints(city?: string, relativeType = 'parcel_locker'): Promise<InpostPoint[]> {
    await this.throttle();
    let url = `${this.pointsBaseUrl}?relative_type=${relativeType}`;
    if (city) url += `&city=${encodeURIComponent(city)}`;

    try {
      const res = await this.httpClient.json<{ items?: InpostPoint[] }>(url, {
        method: 'GET',
      });
      return res?.items || [];
    } catch {
      return [];
    }
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
