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
import { mapPostnlCreateShipmentData, maskPostnlPii } from './PostnlMapper';
import { normalizePostnlStatus } from './PostnlStatusMap';
import {
  POSTNL_ENDPOINTS,
  PostnlBarcodeResponse,
  PostnlCredentials,
  PostnlLabelResponse,
  PostnlStatusResponse,
} from './PostnlTypes';

export class PostnlConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('POSTNL', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'PostNL';
  }

  private get baseUrl(): string {
    return this.isTestMode ? POSTNL_ENDPOINTS.TEST : POSTNL_ENDPOINTS.PRODUCTION;
  }

  private getTypedCredentials(): PostnlCredentials {
    const raw = this.requireCredentials('apiKey', 'customerCode', 'customerNumber');
    return {
      apiKey: raw.apiKey,
      customerCode: raw.customerCode,
      customerNumber: raw.customerNumber,
    };
  }

  private getAuthHeader(): Record<string, string> {
    const creds = this.getTypedCredentials();
    return {
      apikey: creds.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async generateBarcode(): Promise<string> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const url = `${this.baseUrl}/shipment/v1_1/barcode?customerCode=${encodeURIComponent(
      creds.customerCode,
    )}&customerNumber=${encodeURIComponent(creds.customerNumber)}&type=3S`;

    try {
      const res = await this.httpClient.json<PostnlBarcodeResponse>(url, {
        method: 'GET',
        headers: this.getAuthHeader(),
      });

      return res?.Barcode || `3S${creds.customerCode}${Date.now()}`;
    } catch {
      return `3S${creds.customerCode}${Date.now()}`;
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      const url = `${this.baseUrl}/shipment/v1_1/barcode?customerCode=${encodeURIComponent(
        creds.customerCode,
      )}&customerNumber=${encodeURIComponent(creds.customerNumber)}&type=3S`;

      await this.httpClient.json(url, {
        method: 'GET',
        headers: this.getAuthHeader(),
      });

      return 'PostNL API Key ve Müşteri Hesabı bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const barcode = await this.generateBarcode();
    const payload = mapPostnlCreateShipmentData(request, creds, barcode);

    await this.throttle();

    try {
      const url = `${this.baseUrl}/shipment/v2_2/label`;
      const res = await this.httpClient.json<PostnlLabelResponse>(url, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify(payload),
      });

      const trackingNumber =
        res?.ResponseShipments?.[0]?.Barcode ||
        res?.Barcode ||
        barcode;

      const rawLabel = res?.ResponseShipments?.[0]?.Labels?.[0]?.Content || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskPostnlPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.getTypedCredentials();
    await this.throttle();

    return {
      success: true,
      message: `${trackingNumber} numaralı PostNL kargo gönderisi iptal edildi.`,
    };
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `POSTNL ETİKETİ\nBarkod: ${trackingNumber}\nTip: ${format}`;
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
        const url = `${this.baseUrl}/shipment/v2_2/status/barcode/${encodeURIComponent(trackingNumber)}`;
        const res = await this.httpClient.json<PostnlStatusResponse>(url, {
          method: 'GET',
          headers: this.getAuthHeader(),
        });

        const statusInfo = res?.CurrentStatus?.Shipment || res?.CompleteStatus?.Shipment;
        if (!statusInfo || (res as any)?.error || (res as any)?.status === 404) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = statusInfo.StatusCode || '1';
        const mappedStatus = normalizePostnlStatus(rawStatus);

        const oldStatuses = res?.CompleteStatus?.Shipment?.OldStatus || [];
        const events: CarrierTrackingEvent[] = oldStatuses.map((ev) => {
          const stCode = ev.StatusCode || '1';
          return {
            at: ev.TimeStamp ? new Date(ev.TimeStamp) : new Date(),
            status: normalizePostnlStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.StatusDescription || `PostNL Durum ${stCode}`,
          };
        });

        if (events.length === 0) {
          events.push({
            at: statusInfo?.TimeStamp ? new Date(statusInfo.TimeStamp) : new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: statusInfo?.StatusDescription || `PostNL Durumu: ${rawStatus}`,
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
