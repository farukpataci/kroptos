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
import { mapSendAdvanceRequest, maskRecipientPii } from './HepsijetMapper';
import { normalizeHepsijetStatus } from './HepsijetStatusMap';
import {
  HEPSIJET_ENDPOINTS,
  HEPSIJET_GATEWAY,
  HepsijetAuthResponse,
  HepsijetCancelResponse,
  HepsijetCredentials,
  HepsijetSendAdvanceResponse,
  HepsijetTrackingResponse,
} from './HepsijetTypes';

export class HepsijetConnector extends CarrierConnector {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('HEPSIJET', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'HepsiJET';
  }

  private get baseUrl(): string {
    return this.isTestMode ? HEPSIJET_GATEWAY.TEST : HEPSIJET_GATEWAY.PRODUCTION;
  }

  /**
   * Fetches bearer token via Basic Auth username:password.
   * Caches token for 30 minutes (DOCUMENTATION_REQUIRED: exact TTL to be confirmed with official docs).
   */
  private async getToken(creds: HepsijetCredentials): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.token;
    }

    const authHeader = 'Basic ' + Buffer.from(`${creds.userName}:${creds.password}`).toString('base64');
    const url = `${this.baseUrl}${HEPSIJET_ENDPOINTS.TOKEN}`;

    const res = await this.httpClient.json<HepsijetAuthResponse>(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    const token = res.data?.token;
    if (!token) {
      throw new Error('HepsiJET oturum tokenı alınamadı.');
    }

    // Cache for 30 minutes
    this.cachedToken = { token, expiresAt: now + 30 * 60 * 1000 };
    return token;
  }

  private async getAuthHeaders(creds: HepsijetCredentials): Promise<Record<string, string>> {
    const token = await this.getToken(creds);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.requireCredentials('userName', 'password', 'companyShortName');
      await this.throttle();
      await this.getToken(creds);
      return 'HepsiJET test bağlantısı başarılı.';
    });
  }

  async createShipment(req: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.requireCredentials('userName', 'password', 'companyShortName');
    await this.throttle();

    const headers = await this.getAuthHeaders(creds);
    const body = mapSendAdvanceRequest(req, creds.companyShortName);
    const url = `${this.baseUrl}${HEPSIJET_ENDPOINTS.CREATE_ADVANCE}`;

    try {
      const res = await this.httpClient.json<HepsijetSendAdvanceResponse>(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = res.data;
      const barcode = data?.barcode || data?.trackingNumber || body.customerOrderId;
      const trackingNumber = data?.trackingNumber || barcode;

      return {
        trackingNumber,
        barcode,
        carrierShipmentId: data?.deliveryId || body.customerOrderId,
        raw: maskRecipientPii({ request: body, response: res }),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.requireCredentials('userName', 'password', 'companyShortName');
    await this.throttle();

    try {
      const headers = await this.getAuthHeaders(creds);
      const url = `${this.baseUrl}${HEPSIJET_ENDPOINTS.CANCEL_ADVANCE}/${encodeURIComponent(trackingNumber)}`;

      const res = await this.httpClient.json<HepsijetCancelResponse>(url, {
        method: 'POST',
        headers,
      });

      if (res.status === 'OK' || res.data?.cancelled) {
        return { success: true, message: `${trackingNumber} numaralı HepsiJET kargosu iptal edildi.` };
      }

      return {
        success: false,
        message: res.message || `${trackingNumber} numaralı HepsiJET kargosu taşıyıcı tarafından iptal edilemedi.`,
      };
    } catch (error: any) {
      // Carrier refusal MUST return CancelResult, never throw an exception
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı HepsiJET kargo iptal isteği reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    const creds = this.requireCredentials('userName', 'password', 'companyShortName');
    await this.throttle();

    try {
      const headers = await this.getAuthHeaders(creds);
      const url = `${this.baseUrl}${HEPSIJET_ENDPOINTS.LABEL}?trackingNumber=${encodeURIComponent(trackingNumber)}&format=${format}`;

      const res = await this.httpClient.request(url, {
        method: 'GET',
        headers,
      });

      // Returns base64 encoded content for binary formats
      return {
        format,
        content: format === 'ZPL' || format === 'HTML' ? res : Buffer.from(res).toString('base64'),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    const creds = this.requireCredentials('userName', 'password', 'companyShortName');
    await this.throttle();

    try {
      const headers = await this.getAuthHeaders(creds);
      const url = `${this.baseUrl}${HEPSIJET_ENDPOINTS.TRACKING}`;

      const res = await this.httpClient.json<HepsijetTrackingResponse>(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ trackingNumbers }),
      });

      const payloadList = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];

      return trackingNumbers.map((trackingNumber) => {
        const matched = payloadList.find(
          (p) => p.trackingNumber === trackingNumber || p.customerOrderId === trackingNumber,
        );

        const currentStatusCode = matched?.currentStatusCode || 'HJ_IN_TRANSIT';
        const status = normalizeHepsijetStatus(currentStatusCode);

        const rawEvents = matched?.events || [];
        const events: CarrierTrackingEvent[] = rawEvents.map((evt, idx) => {
          const evtCode = evt.statusCode || `HJ_EVT_${idx + 1}`;
          return {
            at: evt.actionDate ? new Date(evt.actionDate) : new Date(),
            status: normalizeHepsijetStatus(evtCode),
            carrierStatusCode: evtCode,
            description: evt.description || evt.statusName || 'Kargo işlemi',
            location: evt.location,
          };
        });

        // Ensure at least one event exists if none returned
        if (events.length === 0) {
          events.push({
            at: new Date(),
            status,
            carrierStatusCode: currentStatusCode,
            description: matched?.currentStatusName || 'Kargo yolda',
          });
        }

        return {
          trackingNumber,
          status,
          carrierStatusCode: currentStatusCode,
          events,
        };
      });
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async findByReference(referenceCode: string): Promise<CarrierShipmentResult | null> {
    const creds = this.requireCredentials('userName', 'password', 'companyShortName');
    await this.throttle();

    try {
      const headers = await this.getAuthHeaders(creds);
      const url = `${this.baseUrl}${HEPSIJET_ENDPOINTS.TRACKING}`;

      const res = await this.httpClient.json<HepsijetTrackingResponse>(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ trackingNumbers: [referenceCode] }),
      });

      const payloadList = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      const matched = payloadList.find(
        (p) => p.trackingNumber === referenceCode || p.customerOrderId === referenceCode,
      );

      if (!matched || (!matched.trackingNumber && !matched.customerOrderId)) {
        return null;
      }

      return {
        trackingNumber: matched.trackingNumber || matched.customerOrderId || referenceCode,
        barcode: matched.trackingNumber || matched.customerOrderId || referenceCode,
        carrierShipmentId: matched.customerOrderId || referenceCode,
        raw: matched,
      };
    } catch {
      return null;
    }
  }
}
