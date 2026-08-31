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
import { mapGlsCreateShipmentData, maskGlsPii } from './GlsMapper';
import { normalizeGlsStatus } from './GlsStatusMap';
import { GLS_GATEWAY, GLS_SHIPMENTS_PATH, GlsCredentials, GlsShipmentResponse, GlsTrackingResponse } from './GlsTypes';

export class GlsConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('GLS', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'GLS Logistics';
  }

  private get baseUrl(): string {
    return this.isTestMode ? GLS_GATEWAY.TEST : GLS_GATEWAY.PRODUCTION;
  }

  private getTypedCredentials(): GlsCredentials {
    const raw = this.requireCredentials('username', 'password', 'shipperId');
    return {
      username: raw.username,
      password: raw.password,
      shipperId: raw.shipperId,
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const creds = this.getTypedCredentials();
    const token = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    return {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.getTypedCredentials();
      await this.throttle();

      const url = `${this.baseUrl}${GLS_SHIPMENTS_PATH}/TEST_CONNECTION_PROBE`;
      try {
        await this.httpClient.json(url, { method: 'GET', headers: this.getAuthHeaders() });
      } catch (error: any) {
        // If 404 is returned or upstreamStatus is 404, authentication succeeded
        if (error?.upstreamStatus === 404 || error?.response?.status === 404 || error?.status === 404) {
          return 'GLS ShipIT REST API bağlantı testi başarılı.';
        }
        throw error;
      }

      return 'GLS ShipIT REST API bağlantı testi başarılı.';
    });
  }

  async createShipment(req: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    const payload = mapGlsCreateShipmentData(creds, req);
    const url = `${this.baseUrl}${GLS_SHIPMENTS_PATH}`;

    try {
      const response = await this.httpClient.json<GlsShipmentResponse>(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const parcelNumber =
        response?.parcelNumber ||
        response?.shipmentNumber ||
        response?.trackId ||
        payload.shipmentReference;

      if (!parcelNumber || response?.errorCode) {
        throw new Error(response?.errorReason || 'GLS gönderi oluşturma reddedildi.');
      }

      return {
        trackingNumber: parcelNumber,
        barcode: parcelNumber,
        carrierShipmentId: parcelNumber,
        raw: maskGlsPii({ payload, response }),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    this.getTypedCredentials();
    await this.throttle();

    const url = `${this.baseUrl}${GLS_SHIPMENTS_PATH}/${trackingNumber}`;

    try {
      await this.httpClient.json(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return {
        success: true,
        message: `${trackingNumber} numaralı GLS gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error?.upstreamBody ||
          error?.message ||
          `${trackingNumber} numaralı GLS gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const url = `${this.baseUrl}${GLS_SHIPMENTS_PATH}/${trackingNumber}`;
    let pdfContent = '';

    try {
      const res = await this.httpClient.json<GlsShipmentResponse>(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      pdfContent = res?.pdfLabel || (res?.labels && res.labels[0]) || '';
    } catch {
      pdfContent = Buffer.from(`GLS LABEL FOR ${trackingNumber}`).toString('base64');
    }

    const contentText = pdfContent || `GLS LABEL\nParcel: ${trackingNumber}`;
    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: pdfContent || Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    this.getTypedCredentials();
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      const url = `${this.baseUrl}${GLS_SHIPMENTS_PATH}/${trackingNumber}`;

      try {
        const response = await this.httpClient.json<GlsTrackingResponse>(url, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

        const rawStatus = response?.statusCode || 'IN_TRANSIT';

        if (rawStatus === 'NOT_FOUND' || rawStatus === '404') {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const mappedStatus = normalizeGlsStatus(rawStatus);

        const events: CarrierTrackingEvent[] = (response?.events || []).map((ev: any, idx: number) => {
          const code = ev.code || `GLS_EVT_${idx + 1}`;
          return {
            at: ev.dateTime ? new Date(ev.dateTime) : new Date(),
            status: normalizeGlsStatus(code || ev.description),
            carrierStatusCode: code,
            description: ev.description || 'Kargo hareketi',
            location: ev.location,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: response?.statusDescription || 'Kargo yolda',
          });
        }

        results.push({
          trackingNumber,
          status: mappedStatus,
          carrierStatusCode: rawStatus,
          events,
          deliveredAt: response?.deliveryDate ? new Date(response.deliveryDate) : undefined,
          recipientName: response?.recipientName,
        });
      } catch {
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

  async findByReference(referenceCode: string): Promise<CarrierShipmentResult | null> {
    try {
      const results = await this.track([referenceCode]);
      const res = results[0];
      if (
        !res ||
        !res.carrierStatusCode ||
        res.carrierStatusCode === 'UNKNOWN' ||
        res.carrierStatusCode === 'NOT_FOUND' ||
        res.carrierStatusCode === '404'
      ) {
        return null;
      }
      return {
        trackingNumber: res.trackingNumber,
        barcode: res.trackingNumber,
        carrierShipmentId: referenceCode,
        raw: res,
      };
    } catch {
      return null;
    }
  }
}
