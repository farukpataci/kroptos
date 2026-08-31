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
import { mapMngCreateShipmentData, maskMngPii } from './MngMapper';
import { normalizeMngStatus } from './MngStatusMap';
import {
  MNG_GATEWAY,
  MngAuthResponse,
  MngAuthToken,
  MngCreateOrderResponse,
  MngCredentials,
  MngShipmentStatusResponse,
} from './MngTypes';

export class MngConnector extends CarrierConnector {
  private cachedToken: MngAuthToken | null = null;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('MNG', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'MNG Kargo';
  }

  private get baseUrl(): string {
    return this.isTestMode ? MNG_GATEWAY.TEST : MNG_GATEWAY.PRODUCTION;
  }

  private getTypedCredentials(): MngCredentials {
    const raw = this.requireCredentials('customerNumber', 'username', 'password');
    return {
      customerNumber: raw.customerNumber,
      username: raw.username,
      password: raw.password,
    };
  }

  private async getToken(creds: MngCredentials): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.token;
    }

    const res = await this.httpClient.json<MngAuthResponse>(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerNumber: creds.customerNumber,
        username: creds.username,
        password: creds.password,
        identityType: 1,
      }),
    });

    const token = res?.jwtToken || res?.token;
    if (!token) {
      throw new Error('MNG Kargo oturum tokenı alınamadı.');
    }

    // Cache for 30 minutes
    this.cachedToken = { token, expiresAt: now + 30 * 60 * 1000 };
    return token;
  }

  private async getAuthHeaders(creds: MngCredentials): Promise<Record<string, string>> {
    const token = await this.getToken(creds);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();
      await this.getToken(creds);
      return 'MNG Kargo REST API bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapMngCreateShipmentData(request);

    await this.throttle();
    const headers = await this.getAuthHeaders(creds);

    try {
      const res = await this.httpClient.json<MngCreateOrderResponse>(
        `${this.baseUrl}/standardcmdapi/createOrder`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      if (res?.statusCode && res.statusCode !== '0' && res.statusCode !== '200' && res.statusCode !== 'OK') {
        throw new Error(res.message || `MNG Kargo sipariş oluşturma reddedildi (${res.statusCode})`);
      }

      const trackingNumber = res?.trackingCode || res?.barcode || payload.order.referenceId;
      const barcode = res?.barcode || trackingNumber;

      return {
        trackingNumber,
        barcode,
        carrierShipmentId: res?.shipmentId || trackingNumber,
        raw: maskMngPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    try {
      const creds = this.getTypedCredentials();
      await this.throttle();
      const headers = await this.getAuthHeaders(creds);

      const res = await this.httpClient.json<any>(
        `${this.baseUrl}/standardcmdapi/cancelOrder`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ trackingCode: trackingNumber }),
        },
      );

      return {
        success: true,
        message: res?.message || `${trackingNumber} numaralı MNG Kargo gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı MNG Kargo gönderisi iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `MNG KARGO ETIKETI\nKargo Anahtarı: ${trackingNumber}`;
    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    const creds = this.getTypedCredentials();
    await this.throttle();
    const headers = await this.getAuthHeaders(creds);

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const res = await this.httpClient.json<MngShipmentStatusResponse>(
          `${this.baseUrl}/standardqueryapi/getShipmentStatus?trackingCode=${encodeURIComponent(trackingNumber)}`,
          {
            method: 'GET',
            headers,
          },
        );

        if (!res || !res.statusCode || res.statusCode === 'NOT_FOUND' || res.statusCode === '404') {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = res.statusCode || 'YOLDA';
        const mappedStatus = normalizeMngStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (res.events || []).map((ev: any) => ({
          at: new Date(ev.date ? ev.date : Date.now()),
          carrierStatusCode: ev.statusCode || rawStatus,
          status: normalizeMngStatus(ev.statusCode || rawStatus),
          description: ev.description || ev.statusName || 'Kargo hareketi',
          location: ev.location,
        }));

        if (events.length === 0) {
          events.push({
            at: new Date(),
            carrierStatusCode: rawStatus,
            status: mappedStatus,
            description: res.statusName || 'Kargo yolda',
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
