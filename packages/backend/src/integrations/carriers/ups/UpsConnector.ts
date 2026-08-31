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
import { mapUpsCreateShipmentData, maskUpsPii } from './UpsMapper';
import { normalizeUpsStatus } from './UpsStatusMap';
import {
  UPS_ENDPOINTS,
  UpsCredentials,
  UpsRatingResponse,
  UpsShipmentResponse,
  UpsTokenResponse,
  UpsTrackingResponse,
  UpsVoidResponse,
} from './UpsTypes';

export class UpsConnector extends CarrierConnector {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('UPS', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'UPS (United Parcel Service)';
  }

  private get baseUrl(): string {
    return this.isTestMode ? UPS_ENDPOINTS.TEST : UPS_ENDPOINTS.PRODUCTION;
  }

  private getTypedCredentials(): UpsCredentials {
    const raw = this.requireCredentials('clientId', 'clientSecret', 'accountNumber');
    return {
      clientId: raw.clientId,
      clientSecret: raw.clientSecret,
      accountNumber: raw.accountNumber,
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.token;
    }

    const creds = this.getTypedCredentials();
    const basicToken = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');

    const res = await this.httpClient.json<UpsTokenResponse>(
      `${this.baseUrl}/security/v1/oauth/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
    );

    if (!res?.access_token) {
      throw new Error('UPS OAuth 2.0 erişim anahtarı alınamadı.');
    }

    const expiresInMs =
      (typeof res.expires_in === 'number' ? res.expires_in : parseInt(res.expires_in || '14399', 10)) * 1000;
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
      transId: `KROPTOS-${Date.now()}`,
      transactionSrc: 'KROPTOS',
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      this.getTypedCredentials();
      await this.throttle();
      const token = await this.getAccessToken();
      if (!token) throw new Error('UPS Kimlik doğrulama başarısız.');
      return 'UPS API ve OAuth 2.0 bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const headers = await this.getAuthHeader();
    const payload = mapUpsCreateShipmentData(request, creds);

    await this.throttle();

    try {
      const res = await this.httpClient.json<UpsShipmentResponse>(
        `${this.baseUrl}/shipments/v1/ship`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      const pkgResult = res?.ShipmentResponse?.ShipmentResults?.PackageResults?.[0];
      const trackingNumber =
        pkgResult?.TrackingNumber ||
        res?.ShipmentResponse?.ShipmentResults?.ShipmentIdentificationNumber ||
        request.referenceCode ||
        `1Z${Date.now()}`;

      const rawLabel = pkgResult?.ShippingLabel?.GraphicImage || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskUpsPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    await this.throttle();

    try {
      const headers = await this.getAuthHeader();
      const res = await this.httpClient.json<UpsVoidResponse>(
        `${this.baseUrl}/shipments/v1/void/cancel/${encodeURIComponent(trackingNumber)}`,
        {
          method: 'DELETE',
          headers,
        },
      );

      const status = res?.VoidShipmentResponse?.Response?.ResponseStatus?.Code;
      const isOk = status === '1' || status === '200';

      return {
        success: isOk,
        message:
          res?.VoidShipmentResponse?.Response?.ResponseStatus?.Description ||
          `${trackingNumber} numaralı UPS kargosu iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı UPS kargo iptali reddedildi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    const contentText = `UPS ETİKETİ\nTakip No: ${trackingNumber}\nHesap: ${this.getTypedCredentials().accountNumber}`;
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
        const res = await this.httpClient.json<UpsTrackingResponse>(
          `${this.baseUrl}/track/v1/details/${encodeURIComponent(trackingNumber)}`,
          {
            method: 'GET',
            headers,
          },
        );

        const pkg = res?.trackResponse?.shipment?.[0]?.package?.[0];
        const activities = pkg?.activity || [];

        if (!pkg || activities.length === 0) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const latest = activities[0];
        const rawStatus = latest?.status?.type || 'I';
        const mappedStatus = normalizeUpsStatus(rawStatus);

        const events: CarrierTrackingEvent[] = activities.map((act) => {
          const rawDate = act.date; // YYYYMMDD
          const rawTime = act.time || '000000'; // HHMMSS
          let eventDate = new Date();
          if (rawDate && rawDate.length === 8) {
            const year = rawDate.slice(0, 4);
            const month = rawDate.slice(4, 6);
            const day = rawDate.slice(6, 8);
            const hh = rawTime.slice(0, 2);
            const mm = rawTime.slice(2, 4);
            const ss = rawTime.slice(4, 6);
            eventDate = new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}Z`);
          }

          const stCode = act.status?.type || 'I';
          const locStr = [act.location?.address?.city, act.location?.address?.country]
            .filter(Boolean)
            .join(', ');

          return {
            at: eventDate,
            carrierStatusCode: stCode,
            status: normalizeUpsStatus(stCode),
            description: act.status?.description || 'Kargo hareketi',
            location: locStr || undefined,
          };
        });

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
    const headers = await this.getAuthHeader();
    await this.throttle();

    try {
      const payload = {
        RateRequest: {
          Request: { SubVersion: '1801' },
          Shipment: {
            Shipper: {
              Name: 'Shipper',
              ShipperNumber: creds.accountNumber,
              Address: {
                City: request.sender?.city || 'Istanbul',
                CountryCode: request.sender?.countryCode || 'TR',
              },
            },
            ShipTo: {
              Name: 'Recipient',
              Address: {
                City: request.recipient?.city || 'Ankara',
                CountryCode: request.recipient?.countryCode || 'TR',
              },
            },
            Service: { Code: '11' },
            Package: {
              PackagingType: { Code: '02' },
              PackageWeight: {
                UnitOfMeasurement: { Code: 'KGS' },
                Weight: String(request.parcels?.[0]?.weightKg || 1.0),
              },
            },
          },
        },
      };

      const res = await this.httpClient.json<UpsRatingResponse>(
        `${this.baseUrl}/rating/v1/Rate`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      const totalCharges = res?.RateResponse?.RatedShipment?.[0]?.TotalCharges;
      const amount = totalCharges?.MonetaryValue ? parseFloat(totalCharges.MonetaryValue) : 0;
      const currency = totalCharges?.CurrencyCode || 'TRY';

      return [
        {
          provider: 'UPS',
          serviceLevel: request.serviceLevel || 'standard',
          amount,
          currency,
        },
      ];
    } catch (error: any) {
      throw this.describeError(error);
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
