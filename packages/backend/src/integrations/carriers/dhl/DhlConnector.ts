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
import { mapDhlCreateShipmentData, maskDhlPii } from './DhlMapper';
import { normalizeDhlStatus } from './DhlStatusMap';
import {
  DHL_GATEWAY,
  DhlCredentials,
  DhlCreateShipmentResponse,
  DhlTrackingResponse,
} from './DhlTypes';

export class DhlConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('DHL', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'DHL Express';
  }

  private get baseUrl(): string {
    return this.isTestMode ? DHL_GATEWAY.TEST : DHL_GATEWAY.PRODUCTION;
  }

  private getTypedCredentials(): DhlCredentials {
    const raw = this.requireCredentials('apiKey', 'apiSecret', 'accountNumber');
    return {
      apiKey: raw.apiKey,
      apiSecret: raw.apiSecret,
      accountNumber: raw.accountNumber,
    };
  }

  private getAuthHeader(creds: DhlCredentials): Record<string, string> {
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
    return {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      await this.httpClient.json<DhlTrackingResponse>(
        `${this.baseUrl}/shipments/TEST-PING-000/tracking`,
        {
          method: 'GET',
          headers: this.getAuthHeader(creds),
        },
      );

      return 'DHL Express API bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapDhlCreateShipmentData(request, creds);

    await this.throttle();

    try {
      const res = await this.httpClient.json<DhlCreateShipmentResponse>(
        `${this.baseUrl}/shipments`,
        {
          method: 'POST',
          headers: this.getAuthHeader(creds),
          body: JSON.stringify(payload),
        },
      );

      const trackingNumber = res?.shipmentTrackingNumber || request.referenceCode || `DHL-${Date.now()}`;
      const barcode = res?.packages?.[0]?.trackingNumber || trackingNumber;

      return {
        trackingNumber,
        barcode,
        carrierShipmentId: trackingNumber,
        raw: maskDhlPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const res = await this.httpClient.json<any>(
        `${this.baseUrl}/shipments/${encodeURIComponent(trackingNumber)}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeader(creds),
        },
      );

      return {
        success: true,
        message: res?.message || `${trackingNumber} numaralı DHL gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı DHL gönderisi iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `DHL EXPRESS ETIKETI\nTakip No: ${trackingNumber}`;
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
        const res = await this.httpClient.json<DhlTrackingResponse>(
          `${this.baseUrl}/shipments/${encodeURIComponent(trackingNumber)}/tracking`,
          {
            method: 'GET',
            headers: this.getAuthHeader(creds),
          },
        );

        const shipment = res?.shipments?.[0];
        if (!shipment) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = shipment?.status || 'TRANSIT';
        const mappedStatus = normalizeDhlStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (shipment?.events || []).map((ev: any) => ({
          at: new Date(ev.date ? `${ev.date}T${ev.time || '00:00:00'}Z` : Date.now()),
          carrierStatusCode: ev.typeCode || 'TRANSIT',
          status: normalizeDhlStatus(ev.typeCode || 'TRANSIT'),
          description: ev.description || 'Kargo hareketi',
          location: ev.serviceArea?.[0]?.description,
        }));

        if (events.length === 0) {
          events.push({
            at: new Date(),
            carrierStatusCode: rawStatus,
            status: mappedStatus,
            description: 'Kargo yolda',
          });
        }

        results.push({
          trackingNumber,
          status: mappedStatus,
          carrierStatusCode: rawStatus,
          events,
        });
      } catch (_) {
        results.push({
          trackingNumber,
          status: 'in_transit',
          carrierStatusCode: 'UNKNOWN',
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
        res.carrierStatusCode === 'NOT_FOUND'
      ) {
        return null;
      }
      return res;
    } catch (_) {
      return null;
    }
  }
}
