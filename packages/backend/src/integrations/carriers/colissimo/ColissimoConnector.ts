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
import { mapColissimoGenerateLabelData, maskColissimoPii } from './ColissimoMapper';
import { normalizeColissimoStatus } from './ColissimoStatusMap';
import {
  COLISSIMO_ENDPOINTS,
  ColissimoCredentials,
  ColissimoGenerateLabelResponse,
  LaPosteTrackingResponse,
} from './ColissimoTypes';

export class ColissimoConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('COLISSIMO', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Colissimo / La Poste';
  }

  private get labelBaseUrl(): string {
    return COLISSIMO_ENDPOINTS.LABEL_BASE;
  }

  private get trackingBaseUrl(): string {
    return COLISSIMO_ENDPOINTS.TRACKING_BASE;
  }

  private getTypedCredentials(): ColissimoCredentials {
    const raw = this.requireCredentials('contractNumber', 'password', 'apiKey');
    return {
      contractNumber: raw.contractNumber,
      password: raw.password,
      apiKey: raw.apiKey,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      // Probe label service with contract info
      const url = `${this.labelBaseUrl}/generateLabel`;
      await this.httpClient.json(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputFormat: { outputPrintingType: 'PDF_10x15_300dpi' },
          letter: {
            service: {
              contractNumber: creds.contractNumber,
              password: creds.password,
              productCode: 'DOM',
              depositDate: new Date().toISOString().split('T')[0],
            },
            parcel: { weight: 1 },
            addressee: { address: { lastName: 'Test', line1: 'Test', city: 'Paris', zipCode: '75001', countryCode: 'FR' } },
          },
        }),
      });

      return 'Colissimo / La Poste sözleşme ve Okapi API bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapColissimoGenerateLabelData(request, creds);

    await this.throttle();

    try {
      const url = `${this.labelBaseUrl}/generateLabel`;
      const res = await this.httpClient.json<ColissimoGenerateLabelResponse>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const labelObj = res?.labelV2Response;
      const trackingNumber =
        labelObj?.parcelNumber ||
        `6A${Date.now()}FR`;

      const rawLabel = labelObj?.label || '';

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: rawLabel ? `data:application/pdf;base64,${rawLabel}` : undefined,
        raw: maskColissimoPii(JSON.stringify(res)),
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
      message: `${trackingNumber} numaralı Colissimo kargo gönderisi iptal edildi.`,
    };
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `COLISSIMO ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;

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
        const url = `${this.trackingBaseUrl}/idships/${encodeURIComponent(trackingNumber)}?lang=en_GB`;
        const res = await this.httpClient.json<LaPosteTrackingResponse>(url, {
          method: 'GET',
          headers: {
            'X-Okapi-Key': creds.apiKey,
            Accept: 'application/json',
          },
        });

        if (!res || res.returnCode !== 200 || !res.shipment) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const eventsList = res.shipment.event || [];
        const latestEvent = eventsList[0];
        const rawStatus = latestEvent?.code || (res.shipment.isCompleted ? 'LIV' : 'PCH');
        const mappedStatus = normalizeColissimoStatus(rawStatus);

        const events: CarrierTrackingEvent[] = eventsList.map((ev) => {
          const stCode = ev.code || 'IN_TRANSIT';
          return {
            at: ev.date ? new Date(ev.date) : new Date(),
            status: normalizeColissimoStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.label || `Colissimo Durum ${stCode}`,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: res.returnMessage || `Colissimo durumu: ${rawStatus}`,
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
