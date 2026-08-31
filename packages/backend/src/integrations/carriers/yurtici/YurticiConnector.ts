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
import { YurticiEnvelope } from './YurticiEnvelope';
import { mapCreateShipmentData, maskYurticiPii } from './YurticiMapper';
import { YurticiParser } from './YurticiParser';
import { normalizeYurticiStatus } from './YurticiStatusMap';
import {
  YURTICI_DISPATCHER_PATH,
  YURTICI_GATEWAY,
  YurticiCredentials,
} from './YurticiTypes';

export class YurticiConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('YURTICI', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Yurtiçi Kargo';
  }

  private get baseUrl(): string {
    return this.isTestMode ? YURTICI_GATEWAY.TEST : YURTICI_GATEWAY.PRODUCTION;
  }

  private get serviceUrl(): string {
    return `${this.baseUrl}${YURTICI_DISPATCHER_PATH}`;
  }

  private getTypedCredentials(): YurticiCredentials {
    const raw = this.requireCredentials('wsUserName', 'wsPassword');
    return {
      wsUserName: raw.wsUserName,
      wsPassword: raw.wsPassword,
      userLanguage: this.credentials.userLanguage || 'TR',
      wsLanguage: this.credentials.wsLanguage || 'TR',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      const xml = YurticiEnvelope.buildQueryShipment(creds, 'TEST_CONNECTION_PROBE');
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      YurticiParser.parseRawSoap(resXml);

      return 'Yurtiçi Kargo test bağlantısı başarılı.';
    });
  }

  async createShipment(req: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const data = mapCreateShipmentData(req);
    const xml = YurticiEnvelope.buildCreateShipment(creds, data);

    try {
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      const result = YurticiParser.parseShippingOrderResult(resXml);

      if (result.outFlag === '1' || (result.errCode && result.errCode !== '0')) {
        throw new Error(
          result.errMessage || result.outResult || 'Yurtiçi Kargo sipariş oluşturma reddedildi.',
        );
      }

      const barcode = result.shippingDataDetailVVO?.docNo || data.cargoKey;

      return {
        trackingNumber: data.cargoKey,
        barcode,
        carrierShipmentId: result.jobId || data.cargoKey,
        raw: maskYurticiPii({ request: data, response: result }),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const xml = YurticiEnvelope.buildCancelShipment(creds, trackingNumber);
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      const result = YurticiParser.parseShippingOrderResult(resXml);

      if (result.outFlag === '0' || result.errCode === '0') {
        return {
          success: true,
          message: `${trackingNumber} numaralı Yurtiçi Kargo gönderisi iptal edildi.`,
        };
      }

      return {
        success: false,
        message:
          result.errMessage ||
          result.outResult ||
          `${trackingNumber} numaralı Yurtiçi Kargo gönderisi iptal edilemedi.`,
      };
    } catch (error: any) {
      // Cancellation refusal MUST return CancelResult, never throw exception
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Yurtiçi Kargo iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.requireCredentials('wsUserName', 'wsPassword');
    await this.throttle();

    // Default label payload for Yurtiçi
    const contentText = `YURTICI KARGO ETIKETI\nKargo Anahtarı: ${trackingNumber}`;
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
        const xml = YurticiEnvelope.buildQueryShipment(creds, number);
        const resXml = await this.httpClient.soap(this.serviceUrl, xml);
        const parsedList = YurticiParser.parseQueryShipmentResult(resXml);

        const item = parsedList.find((p) => p.cargoKey === number) || parsedList[0];

        const rawEvents = item?.shippingDeliveryItemDetailVOArray || [];
        const events: CarrierTrackingEvent[] = rawEvents.map((evt, idx) => {
          const evtCode = evt.operationCode || `YK_EVT_${idx + 1}`;
          return {
            at: evt.operationDate ? new Date(evt.operationDate) : new Date(),
            status: normalizeYurticiStatus(evtCode),
            carrierStatusCode: evtCode,
            description: evt.operationName || 'Kargo hareketi',
            location: evt.unitName,
          };
        });

        const currentCode = item?.operationCode || 'YK_IN_TRANSIT';
        const status = normalizeYurticiStatus(currentCode);

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status,
            carrierStatusCode: currentCode,
            description: item?.operationMessage || 'Kargo yolda',
          });
        }

        results.push({
          trackingNumber: number,
          status,
          carrierStatusCode: currentCode,
          events,
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
      const xml = YurticiEnvelope.buildQueryShipment(creds, referenceCode);
      const resXml = await this.httpClient.soap(this.serviceUrl, xml);
      const parsedList = YurticiParser.parseQueryShipmentResult(resXml);

      const matched = parsedList.find((p) => p.cargoKey === referenceCode || p.docId === referenceCode);
      if (!matched || (!matched.cargoKey && !matched.docId && matched.errCode)) {
        return null;
      }

      return {
        trackingNumber: matched.cargoKey || referenceCode,
        barcode: matched.docNo || matched.cargoKey || referenceCode,
        carrierShipmentId: matched.jobId || referenceCode,
        raw: matched,
      };
    } catch {
      return null;
    }
  }
}
