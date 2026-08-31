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
import { SuratEnvelope } from './SuratEnvelope';
import { mapCreateShipmentData, maskSuratPii } from './SuratMapper';
import { SuratParser } from './SuratParser';
import { normalizeSuratStatus } from './SuratStatusMap';
import { SURAT_GATEWAY, SuratCredentials } from './SuratTypes';

export class SuratConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('SURAT', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Sürat Kargo';
  }

  private get serviceUrl(): string {
    return this.isTestMode ? SURAT_GATEWAY.TEST : SURAT_GATEWAY.PRODUCTION;
  }

  private getTypedCredentials(): SuratCredentials {
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

      const xml = SuratEnvelope.buildQueryTracking(creds, 'TEST_CONNECTION_PROBE');
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      SuratParser.parseRawSoap(resXml);

      return 'Sürat Kargo bağlantı testi başarılı.';
    });
  }

  async createShipment(req: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const data = mapCreateShipmentData(req);
    const xml = SuratEnvelope.buildCreateShipment(creds, data);

    try {
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      const result = SuratParser.parseCreateShipmentResult(resXml);

      if (result.resultCode === '0' || result.resultCode === 'false') {
        throw new Error(result.resultMessage || 'Sürat Kargo gönderi oluşturma reddedildi.');
      }

      const barcode = result.barcode || result.cargoKey || data.cargoKey;
      const trackingNumber = result.trackingNumber || data.cargoKey;

      return {
        trackingNumber,
        barcode,
        carrierShipmentId: trackingNumber,
        raw: maskSuratPii({ request: data, response: result }),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const xml = SuratEnvelope.buildCancelShipment(creds, trackingNumber);
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      const result = SuratParser.parseCancelResult(resXml);

      if (result.resultCode === '1' || result.resultCode === 'true') {
        return {
          success: true,
          message: `${trackingNumber} numaralı Sürat Kargo gönderisi iptal edildi.`,
        };
      }

      return {
        success: false,
        message: result.resultMessage || `${trackingNumber} numaralı Sürat Kargo gönderisi iptal edilemedi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Sürat Kargo iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.requireCredentials('userName', 'password');
    await this.throttle();

    const contentText = `SURAT KARGO ETIKETI\nTakip No: ${trackingNumber}`;
    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const results: CarrierTrackingResult[] = [];

      for (const number of trackingNumbers) {
        const xml = SuratEnvelope.buildQueryTracking(creds, number);
        const resXml = await this.httpClient.soap(this.serviceUrl, xml);
        const parsed = SuratParser.parseTrackingResult(resXml, number);

        const events: CarrierTrackingEvent[] = parsed.events.map((evt, idx) => {
          const code = evt.statusCode || `SURAT_EVT_${idx + 1}`;
          return {
            at: evt.date ? new Date(evt.date) : new Date(),
            status: normalizeSuratStatus(code || evt.description),
            carrierStatusCode: code,
            description: evt.description || 'Kargo hareketi',
            location: evt.location,
          };
        });

        const currentStatus = normalizeSuratStatus(parsed.statusCode || parsed.statusName);

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: currentStatus,
            carrierStatusCode: parsed.statusCode || 'SURAT_IN_TRANSIT',
            description: parsed.statusName || 'Kargo yolda',
          });
        }

        results.push({
          trackingNumber: number,
          status: currentStatus,
          carrierStatusCode: parsed.statusCode || 'SURAT_IN_TRANSIT',
          events,
          deliveredAt: parsed.deliveredAt ? new Date(parsed.deliveredAt) : undefined,
          recipientName: parsed.recipientName,
        });
      }

      return results;
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async findByReference(referenceCode: string): Promise<CarrierShipmentResult | null> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const xml = SuratEnvelope.buildQueryTracking(creds, referenceCode);
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      const parsed = SuratParser.parseTrackingResult(resXml, referenceCode);

      if (!parsed || (!parsed.trackingNumber && parsed.events.length === 0)) {
        return null;
      }

      return {
        trackingNumber: parsed.trackingNumber || referenceCode,
        barcode: parsed.trackingNumber || referenceCode,
        carrierShipmentId: referenceCode,
        raw: parsed,
      };
    } catch {
      return null;
    }
  }
}
