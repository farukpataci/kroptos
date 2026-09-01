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
import { mapPacketaPacketData, maskPacketaPii } from './PacketaMapper';
import { normalizePacketaStatus } from './PacketaStatusMap';
import {
  PACKETA_ENDPOINTS,
  PacketaCredentials,
  PacketaPacketResponse,
  PacketaTrackingResponse,
} from './PacketaTypes';

export class PacketaConnector extends CarrierConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: CarrierHttpClient,
    rateLimiter: CarrierRateLimiter,
    isTestMode = true,
  ) {
    super('PACKETA', credentials, httpClient, rateLimiter, isTestMode);
  }

  protected override get displayName(): string {
    return 'Packeta (Zásilkovna)';
  }

  private get baseUrl(): string {
    return PACKETA_ENDPOINTS.BASE_URL;
  }

  private getTypedCredentials(): PacketaCredentials {
    const raw = this.requireCredentials('apiKey', 'apiSecret', 'eshop');
    return {
      apiKey: raw.apiKey,
      apiSecret: raw.apiSecret,
      eshop: raw.eshop,
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.probe(async () => {
      const creds = this.getTypedCredentials();
      await this.throttle();

      const url = `${PACKETA_ENDPOINTS.BRANCHES_URL}/${encodeURIComponent(creds.apiKey)}/branch.json`;
      await this.httpClient.json(url, { method: 'GET' });

      return 'Packeta / Zásilkovna REST API ve teslimat noktası servisi bağlantısı başarılı.';
    });
  }

  async createShipment(request: CreateShipmentRequest): Promise<CarrierShipmentResult> {
    const creds = this.getTypedCredentials();
    const payload = mapPacketaPacketData(request, creds);

    await this.throttle();

    try {
      const url = `${this.baseUrl}`;
      const res = await this.httpClient.json<PacketaPacketResponse>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPacket',
          apiPassword: creds.apiSecret,
          packetAttributes: payload,
        }),
      });

      if (res?.status === 'error' || res?.error) {
        throw new Error(res?.error?.message || 'Packeta paket oluşturma reddedildi');
      }

      const trackingNumber =
        res?.result?.id ||
        res?.result?.barcode ||
        `Z${Date.now()}`;

      return {
        trackingNumber,
        barcode: trackingNumber,
        carrierShipmentId: trackingNumber,
        labelUrl: `https://tracking.packeta.com/tr/?id=${trackingNumber}`,
        raw: maskPacketaPii(JSON.stringify(res)),
      };
    } catch (error: any) {
      throw this.describeError(error);
    }
  }

  async cancelShipment(trackingNumber: string): Promise<CancelResult> {
    const creds = this.getTypedCredentials();
    await this.throttle();

    try {
      const url = `${this.baseUrl}`;
      await this.httpClient.json(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancelPacket',
          apiPassword: creds.apiSecret,
          packetId: trackingNumber,
        }),
      });

      return {
        success: true,
        message: `${trackingNumber} numaralı Packeta / Zásilkovna gönderisi iptal edildi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || `${trackingNumber} numaralı Packeta / Zásilkovna gönderisi iptal edilemedi.`,
      };
    }
  }

  async getLabel(trackingNumber: string, format: LabelFormat): Promise<CarrierLabel> {
    this.getTypedCredentials();
    await this.throttle();

    const contentText = `PACKETA / ZÁSILKOVNA ETİKETİ\nTakip No: ${trackingNumber}\nTip: ${format}`;

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
        const url = `${this.baseUrl}`;
        const res = await this.httpClient.json<PacketaTrackingResponse>(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'packetStatus',
            apiPassword: creds.apiSecret,
            packetId: trackingNumber,
          }),
        });

        const item = res?.result;
        if (!res || res.status === 'error' || !item) {
          results.push({
            trackingNumber,
            status: 'in_transit',
            carrierStatusCode: 'NOT_FOUND',
            events: [],
          });
          continue;
        }

        const rawStatus = item.statusCode || '1';
        const mappedStatus = normalizePacketaStatus(rawStatus);

        const eventsList = item.events || [];
        const events: CarrierTrackingEvent[] = eventsList.map((ev) => {
          const stCode = ev.code || '3';
          return {
            at: ev.dateTime ? new Date(ev.dateTime) : new Date(),
            status: normalizePacketaStatus(stCode),
            carrierStatusCode: stCode,
            description: ev.name || `Packeta Durum ${stCode}`,
            location: ev.location,
          };
        });

        if (events.length === 0) {
          events.push({
            at: new Date(),
            status: mappedStatus,
            carrierStatusCode: rawStatus,
            description: item.statusName || `Packeta durumu: ${rawStatus}`,
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
