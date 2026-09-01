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
import { mapRoyalmailCreateOrderData, maskRoyalmailPii } from './RoyalmailMapper';
import { normalizeRoyalmailStatus } from './RoyalmailStatusMap';
import {
  ROYALMAIL_ENDPOINTS,
  RoyalmailCredentials,
  RoyalmailLabelResponse,
  RoyalmailOrderResponse,
} from './RoyalmailTypes';

export class RoyalmailConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('ROYAL_MAIL', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Royal Mail';
  }

  private get baseUrl(): string {
    return this.isTestMode ? ROYALMAIL_ENDPOINTS.TEST : ROYALMAIL_ENDPOINTS.PRODUCTION;
  }

  private getTypedCredentials(): RoyalmailCredentials {
    const raw = this.requireCredentials('apiKey');
    return {
      apiKey: raw.apiKey,
    };
  }

  private getAuthHeader(): Record<string, string> {
    const creds = this.getTypedCredentials();
    return {
      Authorization: creds.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.getTypedCredentials();
      await this.throttle();

      const url = `${this.baseUrl}/orders?pageSize=1`;
      await this.httpClient.json(url, {
        method: 'GET',
        headers: this.getAuthHeader(),
      });

      return 'Royal Mail Click & Drop API bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    this.getTypedCredentials();
    const payload = mapRoyalmailCreateOrderData(request);

    await this.throttle();

    try {
      const url = `${this.baseUrl}/orders`;
      const res = await this.httpClient.json<RoyalmailOrderResponse>(url, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify(payload),
      });

      if (res?.errors?.length) {
        throw new Error(res.errors[0].errorMessage || 'Royal Mail sipariş oluşturma hatası');
      }

      const orderId = res?.orderIdentifier || String(res?.orderReference || payload.orderReference);
      const trackingNumber = res?.trackingNumber || `RM${Date.now()}GB`;

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: String(orderId),
        raw: maskRoyalmailPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.getTypedCredentials();
    await this.throttle();

    try {
      const url = `${this.baseUrl}/orders/status`;
      const payload = {
        orderIdentifiers: [trackingNumber],
        status: 'cancelled',
      };

      await this.httpClient.json(url, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı Royal Mail siparişi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Royal Mail siparişi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const url = `${this.baseUrl}/orders/${encodeURIComponent(trackingNumber)}/label`;
    let contentText = '';

    try {
      const res = await this.httpClient.json<RoyalmailLabelResponse>(url, {
        method: 'GET',
        headers: this.getAuthHeader(),
      });
      contentText = res?.labelData || '';
    } catch {
      contentText = `ROYAL MAIL ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;
    }

    const finalContent = contentText || `ROYAL MAIL ETİKETİ\nTakip No: ${trackingNumber}`;

    return format === 'ZPL' || format === 'HTML'
      ? { format, content: finalContent }
      : { format, content: Buffer.from(finalContent).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const url = `${this.baseUrl}/orders/${encodeURIComponent(trackingNumber)}`;
        const res = await this.httpClient.json<RoyalmailOrderResponse>(url, {
          method: 'GET',
          headers: this.getAuthHeader(),
        });

        if (res?.errors?.length || !res || !res.orderStatus) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = res.orderStatus || 'despatched';
        const mappedStatus = normalizeRoyalmailStatus(rawStatus);

        const events: CarrierTrackingEvent[] = [
          {
            at: res.createdDateTime ? new Date(res.createdDateTime) : new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: `Royal Mail sipariş durumu: ${rawStatus}`,
          },
        ];

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
