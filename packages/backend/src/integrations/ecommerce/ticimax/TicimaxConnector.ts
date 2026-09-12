import { BadRequestException } from '@nestjs/common';
import { EcommerceConnector } from '../core/EcommerceConnector';
import { EcommerceHttpClient } from '../core/EcommerceHttpClient';
import { EcommerceRateLimiter } from '../core/EcommerceRateLimiter';
import {
  EcommerceConnectionTestResult,
  EcommerceFulfillmentRequest,
  EcommerceFulfillmentResult,
  EcommerceInventoryUpdate,
  EcommerceInventoryUpdateResult,
  EcommerceOrder,
  EcommerceOrderQueryFilter,
  EcommerceProduct,
} from '../core/EcommerceTypes';
import { TicimaxSoapClient } from './TicimaxSoapClient';
import { TicimaxParser } from './TicimaxParser';
import { TicimaxMapper } from './TicimaxMapper';

export class TicimaxConnector extends EcommerceConnector {
  protected override readonly rateLimitPerMinute: number = 120;
  private readonly soapClient: TicimaxSoapClient;
  private readonly uyeKodu: string;

  constructor(
    credentials: Record<string, any>,
    httpClient: EcommerceHttpClient,
    rateLimiter: EcommerceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('TICIMAX', credentials, httpClient, rateLimiter, settings);
    this.soapClient = new TicimaxSoapClient(httpClient);
    this.uyeKodu = String(
      credentials.uyeKodu ||
        credentials.authCode ||
        credentials.wsYetkiKodu ||
        credentials.apiKey ||
        '',
    ).trim();
  }

  protected override get displayName(): string {
    return 'Ticimax';
  }

  /**
   * Returns clean normalized base store URL (e.g. "https://www.magaza.com").
   */
  public getNormalizedStoreUrl(): string {
    const raw = String(
      this.credentials.storeDomain ||
        this.credentials.domain ||
        this.credentials.url ||
        this.setting<string>('general.shopUrl', ''),
    ).trim();

    if (!raw) {
      throw new BadRequestException('Ticimax mağaza adresi (storeDomain) belirtilmedi.');
    }

    let url = raw;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    // Strip trailing slashes
    url = url.replace(/\/+$/, '');

    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }

  private get urunServiceUrl(): string {
    return `${this.getNormalizedStoreUrl()}/Servis/UrunServis.svc`;
  }

  private get siparisServiceUrl(): string {
    return `${this.getNormalizedStoreUrl()}/Servis/SiparisServis.svc`;
  }

  /**
   * Tests store connectivity and authorization code validity.
   */
  async testConnection(): Promise<EcommerceConnectionTestResult> {
    const start = Date.now();
    try {
      if (!this.uyeKodu) {
        throw new BadRequestException('Ticimax Web Servis Yetki Kodu (UyeKodu) girilmedi.');
      }

      await this.throttle();

      // Call SelectUrunCount to verify credentials
      const bodyXml = `<tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>`;
      const res = await this.soapClient.call(
        this.urunServiceUrl,
        'http://tempuri.org/IUrunServis/SelectUrunCount',
        'SelectUrunCount',
        bodyXml,
        15000,
      );

      const count = parseInt(String(res ?? 0), 10);

      return {
        success: true,
        message: `Ticimax bağlantısı başarılı. Mağazada ${isNaN(count) ? 0 : count} ürün bulundu.`,
        shopDomain: this.getNormalizedStoreUrl(),
        details: { count, durationMs: Date.now() - start },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Ticimax bağlantı hatası: ${error?.message || 'Bilinmeyen hata'}`,
        shopDomain: this.getNormalizedStoreUrl(),
        details: { durationMs: Date.now() - start },
      };
    }
  }

  /**
   * Fetches orders from Ticimax SiparisServis.
   */
  async fetchOrders(filter?: EcommerceOrderQueryFilter): Promise<EcommerceOrder[]> {
    await this.throttle();

    let filterXml = '<tem:siparisFiltre>';
    if (filter?.status) {
      filterXml += `<tem:SiparisDurumu>${filter.status}</tem:SiparisDurumu>`;
    }
    if (filter?.createdAfter) {
      filterXml += `<tem:BaslangicTarihi>${filter.createdAfter.toISOString()}</tem:BaslangicTarihi>`;
    }
    if (filter?.createdBefore) {
      filterXml += `<tem:BitisTarihi>${filter.createdBefore.toISOString()}</tem:BitisTarihi>`;
    }
    filterXml += '</tem:siparisFiltre>';

    const bodyXml = `
      <tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>
      ${filterXml}
    `;

    const res = await this.soapClient.call(
      this.siparisServiceUrl,
      'http://tempuri.org/ISiparisServis/SelectSiparis',
      'SelectSiparis',
      bodyXml,
    );

    const rawOrders = TicimaxParser.parseOrders(res);
    let orders = rawOrders.map((o) => TicimaxMapper.toUnifiedOrder(o));

    if (filter?.limit && filter.limit > 0) {
      orders = orders.slice(0, filter.limit);
    }

    return orders;
  }

  /**
   * Fetches single order details by ID.
   */
  async getOrder(orderId: string): Promise<EcommerceOrder> {
    await this.throttle();

    const bodyXml = `
      <tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>
      <tem:siparisFiltre>
        <tem:SiparisID>${orderId}</tem:SiparisID>
      </tem:siparisFiltre>
    `;

    const res = await this.soapClient.call(
      this.siparisServiceUrl,
      'http://tempuri.org/ISiparisServis/SelectSiparis',
      'SelectSiparis',
      bodyXml,
    );

    const rawOrders = TicimaxParser.parseOrders(res);
    if (!rawOrders || rawOrders.length === 0) {
      throw new BadRequestException(`Ticimax siparişi bulunamadı: ${orderId}`);
    }

    return TicimaxMapper.toUnifiedOrder(rawOrders[0]);
  }

  /**
   * Fulfills an order with tracking information and updates order status.
   */
  async createFulfillment(request: EcommerceFulfillmentRequest): Promise<EcommerceFulfillmentResult> {
    await this.throttle();

    try {
      const carrier = request.carrierName || request.carrierCode || '';
      const bodyXml = `
        <tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>
        <tem:SiparisID>${request.orderId}</tem:SiparisID>
        <tem:KargoTakipNo>${request.trackingNumber}</tem:KargoTakipNo>
        <tem:KargoTakipUrl>${request.trackingUrl || ''}</tem:KargoTakipUrl>
        <tem:KargoFirma>${carrier}</tem:KargoFirma>
      `;

      await this.soapClient.call(
        this.siparisServiceUrl,
        'http://tempuri.org/ISiparisServis/SetKargoTakipNo',
        'SetKargoTakipNo',
        bodyXml,
      );

      // Optionally set order status to Shipped (Kargoya Verildi)
      try {
        const statusXml = `
          <tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>
          <tem:SiparisID>${request.orderId}</tem:SiparisID>
          <tem:YeniDurumID>4</tem:YeniDurumID>
        `;
        await this.soapClient.call(
          this.siparisServiceUrl,
          'http://tempuri.org/ISiparisServis/SetSiparisDurum',
          'SetSiparisDurum',
          statusXml,
        );
      } catch {
        // Status update failure does not invalidate tracking number save
      }

      return {
        success: true,
        fulfillmentId: `${request.orderId}-fulfillment`,
        trackingNumber: request.trackingNumber,
        carrierName: carrier,
      };
    } catch (err: any) {
      throw new BadRequestException(
        `Ticimax kargo takip numarası kaydedilemedi: ${err?.message || 'Bilinmeyen hata'}`,
      );
    }
  }

  /**
   * Updates inventory/stock in Ticimax via UrunServis StokGuncelle.
   */
  async updateInventory(update: EcommerceInventoryUpdate): Promise<EcommerceInventoryUpdateResult> {
    await this.throttle();

    try {
      const bodyXml = `
        <tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>
        <tem:urunler>
          <tem:StokGuncelleme>
            <tem:StokKodu>${update.sku}</tem:StokKodu>
            <tem:Miktar>${update.availableQuantity}</tem:Miktar>
          </tem:StokGuncelleme>
        </tem:urunler>
      `;

      await this.soapClient.call(
        this.urunServiceUrl,
        'http://tempuri.org/IUrunServis/StokGuncelle',
        'StokGuncelle',
        bodyXml,
      );

      return {
        sku: update.sku,
        newQuantity: update.availableQuantity,
        success: true,
      };
    } catch (err: any) {
      return {
        sku: update.sku,
        success: false,
        message: err?.message || 'Stok güncellenemedi',
      };
    }
  }

  /**
   * Fetches product catalogue from Ticimax UrunServis.
   */
  async fetchProducts(limit: number = 50, page: number = 1): Promise<EcommerceProduct[]> {
    await this.throttle();

    const bodyXml = `
      <tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>
      <tem:f>
        <tem:SayfaNo>${page}</tem:SayfaNo>
        <tem:SayfaKayitSayisi>${limit}</tem:SayfaKayitSayisi>
      </tem:f>
    `;

    const res = await this.soapClient.call(
      this.urunServiceUrl,
      'http://tempuri.org/IUrunServis/SelectUrunler',
      'SelectUrunler',
      bodyXml,
    );

    const raw = TicimaxParser.parseProducts(res);
    return raw.map((p) => TicimaxMapper.toUnifiedProduct(p));
  }

  /**
   * Fetches category tree from Ticimax UrunServis.
   */
  async getCategories(): Promise<any[]> {
    await this.throttle();

    const bodyXml = `<tem:UyeKodu>${this.uyeKodu}</tem:UyeKodu>`;
    const res = await this.soapClient.call(
      this.urunServiceUrl,
      'http://tempuri.org/IUrunServis/SelectKategoriler',
      'SelectKategoriler',
      bodyXml,
    );

    return TicimaxParser.parseCategories(res);
  }
}
