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
import { mapSamedayAwbData, maskSamedayPii } from './SamedayMapper';
import { normalizeSamedayStatus } from './SamedayStatusMap';
import {
  SAMEDAY_ENDPOINTS,
  SamedayAuthResponse,
  SamedayAwbResponse,
  SamedayCredentials,
  SamedayTrackingResponse,
} from './SamedayTypes';

export class SamedayConnector extends CarrierConnector {
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('SAMEDAY', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Sameday Courier';
  }

  private get baseUrl(): string {
    return this.isTestMode ? SAMEDAY_ENDPOINTS.TEST : SAMEDAY_ENDPOINTS.PRODUCTION;
  }

  private getTypedCredentials(): SamedayCredentials {
    const raw = this.requireCredentials('username', 'password');
    return {
      username: raw.username,
      password: raw.password,
      pickupPointId: this.credentials.pickupPointId || 1,
    };
  }

  private async authenticate(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const creds = this.getTypedCredentials();
    const url = `${this.baseUrl}/api/authenticate`;

    const res = await this.httpClient.json<SamedayAuthResponse>(url, {
      method: 'POST',
      headers: {
        'X-Auth-Username': creds.username,
        'X-Auth-Password': creds.password,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
      }),
    });

    if (!res?.token) {
      throw new Error('Sameday Courier API kimlik doğrulaması token döndürmedi.');
    }

    this.cachedToken = res.token;
    this.tokenExpiresAt = now + 3600000; // 1 saat geçerli varsayılır
    return res.token;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      await this.throttle();
      await this.authenticate();
      return 'Sameday Courier API ve X-Auth-Username bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapSamedayAwbData(request, creds);

    await this.throttle();
    const token = await this.authenticate();

    try {
      const url = `${this.baseUrl}/api/awb`;
      const res = await this.httpClient.json<SamedayAwbResponse>(url, {
        method: 'POST',
        headers: {
          'X-Auth-Token': token,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res?.errors?.length) {
        throw new Error(res.errors[0].message || 'Sameday AWB oluşturma reddedildi');
      }

      const trackingNumber =
        res?.awbNumber ||
        `1NBSMD${Date.now()}RO`;

      const rawLabel = res?.rawLabelData || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: res?.pdfLink || (rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined),
        raw: maskSamedayPii(JSON.stringify(res)),
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
      const url = `${this.baseUrl}/api/awb/${encodeURIComponent(trackingNumber)}`;
      await this.httpClient.json(url, {
        method: 'DELETE',
        headers: {
          'X-Auth-Token': token,
          Authorization: `Bearer ${token}`,
        },
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı Sameday AWB kargo gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Sameday AWB kargo gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `SAMEDAY AWB ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;

    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    this.getTypedCredentials();
    await this.throttle();
    const token = await this.authenticate();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const url = `${this.baseUrl}/api/awb/status/${encodeURIComponent(trackingNumber)}`;
        const res = await this.httpClient.json<SamedayTrackingResponse>(url, {
          method: 'GET',
          headers: {
            'X-Auth-Token': token,
            Authorization: `Bearer ${token}`,
          },
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

        const rawStatus = res.statusId !== undefined ? String(res.statusId) : (res.statusState || '1');
        const mappedStatus = normalizeSamedayStatus(rawStatus);

        const eventsList = res.history || [];
        const events: CarrierTrackingEvent[] = eventsList.map((ev) => {
          const stCode = String(ev.statusId);
          return {
            at: ev.updatedAt ? new Date(ev.updatedAt) : new Date(),
            status: normalizeSamedayStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.statusLabel || ev.statusState || `Sameday Durum ${stCode}`,
            location: ev.transitLocation,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: res.statusLabel || `Sameday durumu: ${rawStatus}`,
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
