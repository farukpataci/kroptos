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
import { mapDpdCreateShipmentData, maskDpdPii } from './DpdMapper';
import { normalizeDpdStatus } from './DpdStatusMap';
import {
  DPD_GATEWAY,
  DpdCancelResponse,
  DpdCredentials,
  DpdShipmentResponse,
  DpdTrackingResponse,
} from './DpdTypes';

export class DpdConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('DPD', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'DPD Logistics';
  }

  private get baseUrl(): string {
    return this.isTestMode ? DPD_GATEWAY.TEST : DPD_GATEWAY.PRODUCTION;
  }

  private getTypedCredentials(): DpdCredentials {
    const raw = this.requireCredentials('apiKey', 'accountNumber');
    return {
      apiKey: raw.apiKey,
      accountNumber: raw.accountNumber,
    };
  }

  private getAuthHeaders(creds: DpdCredentials): Record<string, string> {
    return {
      Authorization: `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
      'X-DPD-Account': creds.accountNumber,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();
      const headers = this.getAuthHeaders(creds);

      await this.httpClient.json<any>(
        `${this.baseUrl}/shipments/TEST_PING_PROBE/tracking`,
        {
          method: 'GET',
          headers,
        },
      );

      return 'DPD Group REST API bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapDpdCreateShipmentData(request, creds);

    await this.throttle();
    const headers = this.getAuthHeaders(creds);

    try {
      const res = await this.httpClient.json<DpdShipmentResponse>(
        `${this.baseUrl}/shipments`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      const data = res?.shipmentResponse || res;
      if (data?.status && data.status !== 'CREATED' && data.status !== '200' && data.status !== 'OK') {
        throw new Error(data.message || `DPD gönderi oluşturma reddedildi (${data.status})`);
      }

      const trackingNumber = data?.shipmentNumber || data?.parcelNumber || payload.orderData.customerReference;
      const barcode = trackingNumber;

      return {
        trackingNumber,
        barcode,
        carrierShipmentId: trackingNumber,
        raw: maskDpdPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    try {
      const creds = this.getTypedCredentials();
      await this.throttle();
      const headers = this.getAuthHeaders(creds);

      const res = await this.httpClient.json<DpdCancelResponse>(
        `${this.baseUrl}/shipments/cancellation`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ trackingNumber }),
        },
      );

      return {
        success: true,
        message: res?.message || `${trackingNumber} numaralı DPD gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı DPD gönderisi iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `DPD LOGISTICS ETIKETI\nTracking No: ${trackingNumber}`;
    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    const creds = this.getTypedCredentials();
    await this.throttle();
    const headers = this.getAuthHeaders(creds);

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const res = await this.httpClient.json<DpdTrackingResponse>(
          `${this.baseUrl}/shipments/${encodeURIComponent(trackingNumber)}/tracking`,
          {
            method: 'GET',
            headers,
          },
        );

        const data = res?.trackingData || res;
        if (!data || !data.statusCode || data.statusCode === 'NOT_FOUND' || data.statusCode === '404') {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = data.statusCode || '30';
        const mappedStatus = normalizeDpdStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (data.events || []).map((ev) => ({
          at: new Date(ev.date ? ev.date : Date.now()),
          carrierStatusCode: ev.statusCode || rawStatus,
          status: normalizeDpdStatus(ev.statusCode || rawStatus),
          description: ev.description || ev.statusName || 'DPD kargo hareketi',
          location: ev.location,
        }));

        if (events.length === 0) {
          events.push({
            at: new Date(),
            carrierStatusCode: rawStatus,
            status: mappedStatus,
            description: data.statusName || 'Kargo yolda',
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
