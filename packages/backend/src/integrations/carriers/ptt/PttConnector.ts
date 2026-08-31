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
import { PttEnvelope } from './PttEnvelope';
import { mapPttCreateShipmentData, maskPttPii } from './PttMapper';
import { PttParser } from './PttParser';
import { normalizePttStatus } from './PttStatusMap';
import { PTT_GATEWAY, PttCredentials } from './PttTypes';

export class PttConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('PTT', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'PTT Kargo';
  }

  private get shipmentUrl(): string {
    return this.isTestMode ? PTT_GATEWAY.TEST : PTT_GATEWAY.PRODUCTION_SHIPMENT;
  }

  private get trackingUrl(): string {
    return this.isTestMode ? PTT_GATEWAY.TEST : PTT_GATEWAY.PRODUCTION_TRACKING;
  }

  private getTypedCredentials(): PttCredentials {
    const raw = this.requireCredentials('username', 'password', 'customerCode');
    return {
      username: raw.username,
      password: raw.password,
      customerCode: raw.customerCode,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      const xmlEnv = PttEnvelope.buildTrackingEnvelope(creds, 'TEST_BARCODE_PROBE');
      const xmlRes = await this.httpClient.request(this.trackingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: xmlEnv,
      });

      PttParser.parseRawSoap(xmlRes);
      return 'PTT Kargo SOAP servisi bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapPttCreateShipmentData(request, creds);

    await this.throttle();
    const xmlEnv = PttEnvelope.buildCreateShipmentEnvelope(creds, payload);

    try {
      const xmlRes = await this.httpClient.request(this.shipmentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: xmlEnv,
      });

      const parsed = PttParser.parseCreateShipmentResult(xmlRes);
      if (parsed.resultCode !== '0' && parsed.resultCode !== '200' && parsed.resultCode !== 'OK') {
        throw new Error(parsed.resultMessage || `PTT Kargo gönderi verisi kaydedilemedi (${parsed.resultCode})`);
      }

      const trackingNumber = parsed.barcode || payload.barcode;
      const barcode = trackingNumber;

      return {
        trackingNumber,
        barcode,
        carrierShipmentId: trackingNumber,
        raw: maskPttPii(xmlRes),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    try {
      const creds = this.getTypedCredentials();
      await this.throttle();

      const xmlEnv = PttEnvelope.buildCancelShipmentEnvelope(creds, trackingNumber);
      const xmlRes = await this.httpClient.request(this.shipmentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: xmlEnv,
      });

      const parsed = PttParser.parseCancelShipmentResult(xmlRes);
      if (parsed.resultCode !== '0' && parsed.resultCode !== '200' && parsed.resultCode !== 'OK') {
        return {
          success: false,
          message: parsed.resultMessage || `${trackingNumber} numaralı PTT Kargo gönderisi iptal isteği reddedildi.`,
        };
      }

      return {
        success: true,
        message: parsed.resultMessage || `${trackingNumber} numaralı PTT Kargo gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı PTT Kargo gönderisi iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `PTT KARGO ETIKETI\nBarkod No: ${trackingNumber}`;
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
        const xmlEnv = PttEnvelope.buildTrackingEnvelope(creds, trackingNumber);
        const xmlRes = await this.httpClient.request(this.trackingUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          body: xmlEnv,
        });

        const parsed = PttParser.parseTrackingResult(xmlRes);
        if (!parsed || !parsed.statusCode || parsed.statusCode === 'NOT_FOUND' || parsed.statusCode === '-1') {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = parsed.statusCode || 'YOLDA';
        const mappedStatus = normalizePttStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (parsed.events || []).map((ev) => ({
          at: new Date(ev.date ? ev.date : Date.now()),
          carrierStatusCode: ev.statusCode || rawStatus,
          status: normalizePttStatus(ev.statusCode || rawStatus),
          description: ev.description || 'PTT Kargo hareketi',
          location: ev.location,
        }));

        if (events.length === 0) {
          events.push({
            at: new Date(),
            carrierStatusCode: rawStatus,
            status: mappedStatus,
            description: parsed.statusName || 'Kargo yolda',
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
