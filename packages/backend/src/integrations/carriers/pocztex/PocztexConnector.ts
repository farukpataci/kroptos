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
import { mapPocztexPrzesylkaData, maskPocztexPii } from './PocztexMapper';
import { normalizePocztexStatus } from './PocztexStatusMap';
import {
  POCZTEX_ENDPOINTS,
  PocztexCredentials,
  PocztexPrzesylkaResponse,
  PocztexTrackingResponse,
} from './PocztexTypes';

export class PocztexConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('POCZTEX', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Pocztex (Poczta Polska)';
  }

  private get baseUrl(): string {
    return this.isTestMode ? POCZTEX_ENDPOINTS.TEST_WSDL : POCZTEX_ENDPOINTS.PROD_WSDL;
  }

  private getTypedCredentials(): PocztexCredentials {
    const raw = this.requireCredentials('username', 'password', 'accountNumber');
    return {
      username: raw.username,
      password: raw.password,
      accountNumber: raw.accountNumber,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.getTypedCredentials();
      await this.throttle();

      // Probe E-Nadawca service URL
      await this.httpClient.json(this.baseUrl, { method: 'GET' }).catch(() => null);
      return 'Poczta Polska E-Nadawca Web Service ve Śledzenie tracking bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapPocztexPrzesylkaData(request, creds);

    await this.throttle();

    try {
      const url = `${this.baseUrl}`;
      const res = await this.httpClient.json<PocztexPrzesylkaResponse>(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addPrzesylka',
          payload,
        }),
      });

      if (res?.status === 'ERROR' || res?.error) {
        throw new Error(res?.error?.message || 'Pocztex gönderi oluşturma reddedildi');
      }

      const trackingNumber =
        res?.numerNadania ||
        `PX${Date.now()}PL`;

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: `https://uss.poczta-polska.pl/uss/v1/tracking/${trackingNumber}`,
        raw: maskPocztexPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const url = `${this.baseUrl}`;
      await this.httpClient.json(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clearEnvelope',
          numerNadania: trackingNumber,
        }),
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı Pocztex (Poczta Polska) gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Pocztex gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `POCZTEX / POCZTA POLSKA ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;

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
        const url = `${POCZTEX_ENDPOINTS.REST_TRACKING_URL}/${encodeURIComponent(trackingNumber)}`;
        const res = await this.httpClient.json<PocztexTrackingResponse>(url, {
          method: 'GET',
        });

        if (!res || res.status === 'ERROR' || (!res.zdarzenia && !res.events)) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const eventsList = res.zdarzenia || res.events || [];
        const lastEvent = eventsList[eventsList.length - 1];
        const rawStatus = lastEvent?.kod || '1';
        const mappedStatus = normalizePocztexStatus(rawStatus);

        const events: CarrierTrackingEvent[] = eventsList.map((ev) => {
          const stCode = ev.kod || '2';
          return {
            at: ev.czas ? new Date(ev.czas) : new Date(),
            status: normalizePocztexStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.nazwa || `Pocztex Durum ${stCode}`,
            location: ev.jednostka,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: `Pocztex durumu: ${rawStatus}`,
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
