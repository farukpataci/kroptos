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
import { mapFanCourierAwbData, maskFanCourierPii } from './FanCourierMapper';
import { normalizeFanCourierStatus } from './FanCourierStatusMap';
import {
  FAN_COURIER_ENDPOINTS,
  FanCourierAuthResponse,
  FanCourierAwbResponse,
  FanCourierCredentials,
  FanCourierTrackingResponse,
} from './FanCourierTypes';

export class FanCourierConnector extends CarrierConnector {
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('FAN_COURIER', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'FAN Courier';
  }

  private get baseUrl(): string {
    return FAN_COURIER_ENDPOINTS.BASE_URL;
  }

  private getTypedCredentials(): FanCourierCredentials {
    const raw = this.requireCredentials('clientId', 'username', 'password');
    return {
      clientId: raw.clientId,
      username: raw.username,
      password: raw.password,
    };
  }

  private async authenticate(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const creds = this.getTypedCredentials();
    const url = `${this.baseUrl}/login`;

    const res = await this.httpClient.json<FanCourierAuthResponse>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: creds.clientId,
        username: creds.username,
        password: creds.password,
      }),
    });

    const token = res?.data?.token;
    if (!token) {
      throw new Error(res?.message || 'FAN Courier API kimlik doğrulaması token döndürmedi.');
    }

    this.cachedToken = token;
    this.tokenExpiresAt = now + 3600000; // 1 saat geçerli
    return token;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      await this.throttle();
      await this.authenticate();
      return 'FAN Courier REST API v2 ve JWT login bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapFanCourierAwbData(request, creds);

    await this.throttle();

    try {
      const token = await this.authenticate();
      const url = `${this.baseUrl}/intern-awb`;
      const res = await this.httpClient.json<FanCourierAwbResponse>(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res?.status === 'error' || res?.errors?.length) {
        throw new Error(res?.message || res?.errors?.[0]?.message || 'FAN Courier AWB oluşturma reddedildi');
      }

      const trackingNumber =
        res?.data?.awbNumber ||
        `235${Date.now()}`;

      const rawLabel = res?.data?.pdfLabel || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskFanCourierPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.getTypedCredentials();
    await this.throttle();

    try {
      const token = await this.authenticate();
      const url = `${this.baseUrl}/intern-awb`;
      await this.httpClient.json(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ AWB: trackingNumber }),
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı FAN Courier AWB kargo gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı FAN Courier AWB kargo gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `FAN COURIER AWB ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;

    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    try {
      const token = await this.authenticate();

      for (const trackingNumber of trackingNumbers) {
        try {
          const url = `${this.baseUrl}/reports/awb/tracking`;
          const res = await this.httpClient.json<FanCourierTrackingResponse>(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ AWB: trackingNumber }),
          });

          const item = res?.data?.[0];
          if (!res || res.status === 'error' || !item) {
            results.push({
              trackingNumber,
              status: 'in_transit',
              carrierStatusCode: 'NOT_FOUND',
              events: [],
            });
            continue;
          }

          const rawStatus = item.currentStatus || 'S1';
          const mappedStatus = normalizeFanCourierStatus(rawStatus);

          const eventsList = item.events || [];
          const events: CarrierTrackingEvent[] = eventsList.map((ev) => {
            const stCode = ev.status || 'S3';
            return {
              at: ev.date ? new Date(ev.date) : new Date(),
              status: normalizeFanCourierStatus(stCode),
              carrierStatusCode: stCode,
              description: ev.statusName || `FAN Courier Durum ${stCode}`,
              location: ev.location,
            };
          });

          if (events.length === 0) {
            events.push({
              at: new Date(),
              status: mappedStatus,
              carrierStatusCode: rawStatus,
              description: `FAN Courier durumu: ${rawStatus}`,
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
    } catch {
      for (const trackingNumber of trackingNumbers) {
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
