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
import { mapSendeoCreateShipmentData, maskSendeoPii } from './SendeoMapper';
import { normalizeSendeoStatus } from './SendeoStatusMap';
import {
  SENDEO_GATEWAY,
  SendeoAuthResponse,
  SendeoAuthToken,
  SendeoCargoTrackingResponse,
  SendeoCredentials,
  SendeoSetCargoResponse,
} from './SendeoTypes';

export class SendeoConnector extends CarrierConnector {
  private cachedToken: SendeoAuthToken | null = null;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('SENDEO', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Sendeo Kargo';
  }

  private get baseUrl(): string {
    return this.isTestMode ? SENDEO_GATEWAY.TEST : SENDEO_GATEWAY.PRODUCTION;
  }

  private getTypedCredentials(): SendeoCredentials {
    const raw = this.requireCredentials('username', 'password', 'customerCode');
    return {
      username: raw.username,
      password: raw.password,
      customerCode: raw.customerCode,
    };
  }

  private async getToken(creds: SendeoCredentials): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.token;
    }

    const res = await this.httpClient.json<SendeoAuthResponse>(`${this.baseUrl}/Token/Login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: creds.username,
        password: creds.password,
      }),
    });

    const token = res?.result?.token || res?.token;
    if (!token) {
      throw new Error('Sendeo Kargo oturum tokenı alınamadı.');
    }

    // Cache for 30 minutes
    this.cachedToken = { token, expiresAt: now + 30 * 60 * 1000 };
    return token;
  }

  private async getAuthHeaders(creds: SendeoCredentials): Promise<Record<string, string>> {
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
      return 'Sendeo Kargo REST API bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapSendeoCreateShipmentData(request, creds);

    await this.throttle();
    const headers = await this.getAuthHeaders(creds);

    try {
      const res = await this.httpClient.json<SendeoSetCargoResponse>(
        `${this.baseUrl}/Cargo/SetCargo`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      if (res?.status && res.status !== '0' && res.status !== '200' && res.status !== 'OK') {
        throw new Error(res.message || `Sendeo Kargo sipariş oluşturma reddedildi (${res.status})`);
      }

      const trackingNumber = res?.result?.trackingNo || res?.trackingNo || payload.referenceNo;
      const barcode = res?.result?.barcode || res?.barcode || trackingNumber;

      return {
        trackingNumber,
        barcode,
        carrierShipmentId: res?.result?.cargoId || trackingNumber,
        raw: maskSendeoPii(JSON.stringify(res)),
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
        `${this.baseUrl}/Cargo/CancelCargo`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ trackingNo: trackingNumber }),
        },
      );

      return {
        success: true,
        message: res?.message || `${trackingNumber} numaralı Sendeo Kargo gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Sendeo Kargo gönderisi iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `SENDEO KARGO ETIKETI\nKargo Anahtarı: ${trackingNumber}`;
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
        const res = await this.httpClient.json<SendeoCargoTrackingResponse>(
          `${this.baseUrl}/Cargo/GetCargoTracking?trackingNo=${encodeURIComponent(trackingNumber)}`,
          {
            method: 'GET',
            headers,
          },
        );

        const data = res?.result || res;
        if (!data || !data.statusCode || data.statusCode === 'NOT_FOUND' || data.statusCode === '404') {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = data.statusCode || '300';
        const mappedStatus = normalizeSendeoStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (data.events || []).map((ev: any) => ({
          at: new Date(ev.date ? ev.date : Date.now()),
          carrierStatusCode: ev.statusCode || rawStatus,
          status: normalizeSendeoStatus(ev.statusCode || rawStatus),
          description: ev.description || ev.statusName || 'Kargo hareketi',
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
