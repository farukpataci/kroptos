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
  RateQuote,
  RateQuoteRequest,
} from '../core/CarrierTypes';
import { mapFedexCreateShipmentData, maskFedexPii } from './FedexMapper';
import { normalizeFedexStatus } from './FedexStatusMap';
import {
  FEDEX_ENDPOINTS,
  FedexCancelRequest,
  FedexCancelResponse,
  FedexCredentials,
  FedexPickupRequest,
  FedexPickupResponse,
  FedexRateRequest,
  FedexRateResponse,
  FedexShipmentResponse,
  FedexTokenResponse,
  FedexTrackingRequest,
  FedexTrackingResponse,
} from './FedexTypes';

export class FedexConnector extends CarrierConnector {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('FEDEX', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'FedEx Express';
  }

  private get baseUrl(): string {
    return this.isTestMode ? FEDEX_ENDPOINTS.TEST : FEDEX_ENDPOINTS.PRODUCTION;
  }

  private getTypedCredentials(): FedexCredentials {
    const raw = this.requireCredentials('apiKey', 'secretKey', 'accountNumber');
    return {
      apiKey: raw.apiKey,
      secretKey: raw.secretKey,
      accountNumber: raw.accountNumber,
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.token;
    }

    const creds = this.getTypedCredentials();
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(creds.apiKey)}&client_secret=${encodeURIComponent(creds.secretKey)}`;

    const res = await this.httpClient.json<FedexTokenResponse>(
      `${this.baseUrl}/oauth/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!res?.access_token) {
      throw new Error('FedEx OAuth 2.0 erişim anahtarı alınamadı.');
    }

    const expiresInMs = (res.expires_in || 3600) * 1000;
    this.tokenCache = {
      token: res.access_token,
      expiresAt: now + expiresInMs,
    };

    return res.access_token;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-customer-transaction-id': `KROPTOS-${Date.now()}`,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.getTypedCredentials();
      await this.throttle();
      const token = await this.getAccessToken();
      if (!token) throw new Error('FedEx Kimlik doğrulama başarısız.');
      return 'FedEx API ve OAuth 2.0 bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapFedexCreateShipmentData(request, creds);

    await this.throttle();

    try {
      const headers = await this.getAuthHeader();
      const res = await this.httpClient.json<FedexShipmentResponse>(
        `${this.baseUrl}/ship/v1/shipments`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      const piece = res?.output?.transactionShipments?.[0]?.pieceResponses?.[0];
      const trackingNumber =
        piece?.trackingNumber ||
        res?.output?.transactionShipments?.[0]?.masterTrackingNumber ||
        request.referenceCode ||
        `77${Date.now()}`;

      const rawLabel = piece?.packageDocuments?.[0]?.encodedLabel || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskFedexPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    await this.throttle();

    try {
      const creds = this.getTypedCredentials();
      const headers = await this.getAuthHeader();

      const payload: FedexCancelRequest = {
        accountNumber: { value: creds.accountNumber },
        trackingNumber,
      };

      const res = await this.httpClient.json<FedexCancelResponse>(
        `${this.baseUrl}/ship/v1/shipments/cancel`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        },
      );

      const isOk = res?.output?.cancelledShipment === true || !res?.errors?.length;

      return {
        success: isOk,
        message:
          res?.output?.successMessage ||
          (isOk ? `${trackingNumber} numaralı FedEx kargosu iptal edildi.` : 'FedEx iptal işlemi başarısız.'),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı FedEx kargo iptali reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    const contentText = `FEDEX ETİKETİ\nTakip No: ${trackingNumber}\nHesap: ${this.getTypedCredentials().accountNumber}`;
    return format === 'ZPL' || format === 'HTML'
      ? { format, content: contentText }
      : { format, content: Buffer.from(contentText).toString('base64') };
  }

  async track(trackingNumbers: string[]): Promise<CarrierTrackingResult[]> {
    await this.throttle();

    const results: CarrierTrackingResult[] = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const headers = await this.getAuthHeader();
        const payload: FedexTrackingRequest = {
          includeDetailedScans: true,
          trackingInfo: [
            {
              trackingNumberInfo: {
                trackingNumber,
              },
            },
          ],
        };

        const res = await this.httpClient.json<FedexTrackingResponse>(
          `${this.baseUrl}/track/v1/trackingnumbers`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          },
        );

        const trackResult = res?.output?.completeTrackResults?.[0]?.trackResults?.[0];
        const scans = trackResult?.scanEvents || [];

        if (!trackResult || !trackResult.latestStatusDetail?.code) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = trackResult.latestStatusDetail.code;
        const mappedStatus = normalizeFedexStatus(rawStatus);

        const events: CarrierTrackingEvent[] = scans.map((ev) => {
          const stCode = ev.scanEventCode || 'IT';
          const locStr = [ev.scanLocation?.city, ev.scanLocation?.countryCode]
            .filter(Boolean)
            .join(', ');

          return {
            at: ev.date ? new Date(ev.date) : new Date(),
            carrierStatusCode: stCode,
            status: normalizeFedexStatus(stCode),
            description: ev.eventDescription || 'Kargo hareketi',
            location: locStr || undefined,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            carrierStatusCode: rawStatus,
            status: mappedStatus,
            description: trackResult.latestStatusDetail.description || 'Kargo yolda',
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
          carrierStatusCode: 'NOT_FOUND',
          events: [],
        });
      }
    }

    return results;
  }

  async getRates(request: RateQuoteRequest): Promise<RateQuote[]> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const headers = await this.getAuthHeader();
      const payload: FedexRateRequest = {
        accountNumber: { value: creds.accountNumber },
        requestedShipment: {
          shipper: {
            address: {
              postalCode: request.sender?.postalCode || '34000',
              countryCode: request.sender?.countryCode || 'TR',
            },
          },
          recipient: {
            address: {
              postalCode: request.recipient?.postalCode || '06000',
              countryCode: request.recipient?.countryCode || 'TR',
            },
          },
          pickupType: 'USE_SCHEDULED_PICKUP',
          rateRequestType: ['ACCOUNT'],
          requestedPackageLineItems: [
            {
              weight: {
                units: 'KG',
                value: request.parcels?.[0]?.weightKg || 1.0,
              },
            },
          ],
        },
      };

      const res = await this.httpClient.json<FedexRateResponse>(
        `${this.baseUrl}/rate/v1/rates/quotes`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      const detail = res?.output?.rateReplyDetails?.[0];
      const charge = detail?.ratedShipmentDetails?.[0];

      return [
        {
          provider: 'FEDEX',
          serviceLevel: request.serviceLevel || 'standard',
          amount: charge?.totalNetCharge || 0,
          currency: charge?.currency || 'TRY',
        },
      ];
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async requestPickup(senderAddress: any): Promise<{ success: boolean; confirmationCode?: string }> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const headers = await this.getAuthHeader();
      const payload: FedexPickupRequest = {
        associatedAccountNumber: { value: creds.accountNumber },
        originDetail: {
          pickupLocation: {
            contact: {
              personName: senderAddress.fullName || 'Shipper',
              phoneNumber: senderAddress.phone || '0000000000',
            },
            address: {
              streetLines: [senderAddress.line1, senderAddress.line2].filter(Boolean) as string[],
              city: senderAddress.city || 'Istanbul',
              postalCode: senderAddress.postalCode || '34000',
              countryCode: senderAddress.countryCode || 'TR',
            },
          },
          readyTimestamp: new Date().toISOString(),
          companyCloseTime: '18:00:00',
        },
        carrierCode: 'FDXE',
      };

      const res = await this.httpClient.json<FedexPickupResponse>(
        `${this.baseUrl}/pickup/v1/pickups`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      return {
        success: Boolean(res?.output?.pickupConfirmationCode),
        confirmationCode: res?.output?.pickupConfirmationCode,
      };
    } catch (error: any) {
      return { success: false };
    }
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
    } catch (_) {
      return null;
    }
  }
}
