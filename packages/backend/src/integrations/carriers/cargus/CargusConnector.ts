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
import { mapCargusAwbData, maskCargusPii } from './CargusMapper';
import { normalizeCargusStatus } from './CargusStatusMap';
import {
  CARGUS_ENDPOINTS,
  CargusAwbResponse,
  CargusCredentials,
  CargusTrackingResponse,
} from './CargusTypes';

export class CargusConnector extends CarrierConnector {
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('CARGUS', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Cargus (Urgent Cargus)';
  }

  private get baseUrl(): string {
    return CARGUS_ENDPOINTS.BASE_URL;
  }

  private getTypedCredentials(): CargusCredentials {
    const raw = this.requireCredentials('subscriptionKey', 'username', 'password');
    return {
      subscriptionKey: raw.subscriptionKey,
      username: raw.username,
      password: raw.password,
      locationId: this.credentials.locationId || 1,
    };
  }

  private async authenticate(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const creds = this.getTypedCredentials();
    const url = `${this.baseUrl}/LoginUser`;

    const tokenRes = await this.httpClient.json<string | { token?: string }>(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': creds.subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        UserName: creds.username,
        Password: creds.password,
      }),
    });

    const token = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token;
    if (!token) {
      throw new Error('Cargus REST API kimlik doğrulaması token döndürmedi.');
    }

    // Clean token string quotes if raw string returned
    const cleanToken = token.replace(/^"+|"+$/g, '');
    this.cachedToken = cleanToken;
    this.tokenExpiresAt = now + 3600000; // 1 saat geçerli
    return cleanToken;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      await this.throttle();
      await this.authenticate();
      return 'Cargus Azure APIM ve LoginUser bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapCargusAwbData(request, creds);

    await this.throttle();

    try {
      const token = await this.authenticate();
      const url = `${this.baseUrl}/Awbs`;
      const res = await this.httpClient.json<CargusAwbResponse | string>(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': creds.subscriptionKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resObj: CargusAwbResponse =
        typeof res === 'string' ? { BarCode: res } : (res as CargusAwbResponse);

      if (resObj?.ErrorMessage || (resObj?.ReturnCode && resObj.ReturnCode !== 0)) {
        throw new Error(resObj.ErrorMessage || resObj.ReturnMessage || 'Cargus AWB oluşturma reddedildi');
      }

      const trackingNumber =
        resObj?.BarCode ||
        resObj?.Barcode ||
        resObj?.AwbNumber ||
        `108${Date.now()}`;

      const rawLabel = resObj?.PdfLabel || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskCargusPii(JSON.stringify(resObj)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const token = await this.authenticate();
      const url = `${this.baseUrl}/Awbs?barCode=${encodeURIComponent(trackingNumber)}`;
      await this.httpClient.json(url, {
        method: 'DELETE',
        headers: {
          'Ocp-Apim-Subscription-Key': creds.subscriptionKey,
          Authorization: `Bearer ${token}`,
        },
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı Cargus AWB kargo gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Cargus AWB kargo gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `CARGUS AWB ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;

    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    try {
      const token = await this.authenticate();

      for (const trackingNumber of trackingNumbers) {
        try {
          const url = `${this.baseUrl}/Awbs/Track/${encodeURIComponent(trackingNumber)}`;
          const res = await this.httpClient.json<CargusTrackingResponse[] | CargusTrackingResponse>(url, {
            method: 'GET',
            headers: {
              'Ocp-Apim-Subscription-Key': creds.subscriptionKey,
              Authorization: `Bearer ${token}`,
            },
          });

          const item: CargusTrackingResponse | undefined = Array.isArray(res) ? res[0] : res;

          if (!item || (item as any)?.status === 404 || (item as any)?.error) {
            results.push({
              trackingNumber,
              status: 'in_transit',
              carrierStatusCode: 'NOT_FOUND',
              events: [],
            });
            continue;
          }

          const rawStatus = item.StatusCode || (item.StatusId !== undefined ? String(item.StatusId) : '1');
          const mappedStatus = normalizeCargusStatus(rawStatus);

          const eventsList = item.EventList || item.Events || [];
          const events: CarrierTrackingEvent[] = eventsList.map((ev) => {
            const stCode = String(ev.StatusCode || ev.EventId || '2');
            return {
              at: ev.EventDate ? new Date(ev.EventDate) : new Date(),
              status: normalizeCargusStatus(stCode),
              carrierStatusCode: stCode,
              description: ev.StatusName || `Cargus Durum ${stCode}`,
              location: ev.LocationName,
            };
          });

          if (events.length === 0) {
            events.push({
              at: new Date(),
              status: mappedStatus,
              carrierStatusCode: rawStatus,
              description: item.StatusName || `Cargus durumu: ${rawStatus}`,
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
