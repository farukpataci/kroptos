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
import { ArasEnvelope } from './ArasEnvelope';
import { mapArasCreateShipmentData, maskArasPii } from './ArasMapper';
import { ArasParser } from './ArasParser';
import { normalizeArasStatus } from './ArasStatusMap';
import { ARAS_GATEWAY, ArasCredentials } from './ArasTypes';

export class ArasConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('ARAS', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Aras Kargo';
  }

  private get serviceUrl(): string {
    return this.isTestMode ? ARAS_GATEWAY.TEST : ARAS_GATEWAY.PRODUCTION;
  }

  private getTypedCredentials(): ArasCredentials {
    const raw = this.requireCredentials('userName', 'password', 'customerCode');
    return {
      userName: raw.userName,
      password: raw.password,
      customerCode: raw.customerCode,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      const xmlBody = ArasEnvelope.buildGetOrderEnvelope(creds, 'TEST-PING-000');
      const responseXml = await this.httpClient.soap(this.serviceUrl, xmlBody);

      ArasParser.parseRawSoap(responseXml);

      return 'Aras Kargo web servisi bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapArasCreateShipmentData(request);

    await this.throttle();
    const xmlBody = ArasEnvelope.buildSetOrderEnvelope(creds, payload);

    try {
      const responseXml = await this.httpClient.soap(this.serviceUrl, xmlBody);
      const parsed = ArasParser.parseSetOrderResult(responseXml);

      if (parsed.resultCode !== '0' && parsed.resultCode !== '1' && parsed.resultCode !== 'SUCCESS') {
        throw new Error(parsed.resultMessage || `Aras Kargo sipariş oluşturma reddedildi (${parsed.resultCode})`);
      }

      return {
        trackingNumber: payload.integrationCode,
        barcode: payload.integrationCode,
        carrierShipmentId: parsed.integrationCode || payload.integrationCode,
        raw: maskArasPii(responseXml),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const xmlBody = ArasEnvelope.buildCancelOrderEnvelope(creds, trackingNumber);

    try {
      const responseXml = await this.httpClient.soap(this.serviceUrl, xmlBody);
      const parsed = ArasParser.parseCancelOrderResult(responseXml);

      if (parsed.resultCode === '0' || parsed.resultCode === '1' || parsed.resultCode === 'SUCCESS') {
        return {
          success: true,
          message: parsed.resultMessage || `${trackingNumber} numaralı Aras Kargo gönderisi iptal edildi.`,
        };
      }

      return {
        success: false,
        message: parsed.resultMessage || `${trackingNumber} numaralı Aras Kargo gönderisi iptal reddedildi (${parsed.resultCode}).`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Aras Kargo iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.requireCredentials('userName', 'password', 'customerCode');
    await this.throttle();

    const contentText = `ARAS KARGO ETIKETI\nKargo Anahtarı: ${trackingNumber}`;
    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      const xmlBody = ArasEnvelope.buildGetOrderEnvelope(creds, trackingNumber);

      try {
        const responseXml = await this.httpClient.soap(this.serviceUrl, xmlBody);
        const queryResult = ArasParser.parseGetOrderResult(responseXml);

        const events: CarrierTrackingEvent[] = (queryResult.events || []).map((ev) => ({
          at: new Date(ev.date || Date.now()),
          carrierStatusCode: ev.statusCode,
          status: normalizeArasStatus(ev.statusCode),
          description: ev.description,
          location: ev.location,
        }));

        const rawStatusCode = queryResult.statusCode || 'in_transit';
        const mappedStatus = normalizeArasStatus(rawStatusCode);

        if (events.length === 0) {
          events.push({
            at: new Date(),
            carrierStatusCode: rawStatusCode,
            status: mappedStatus,
            description: queryResult.statusName || 'Kargo yolda',
          });
        }

        results.push({
          trackingNumber,
          status: mappedStatus,
          carrierStatusCode: rawStatusCode,
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
