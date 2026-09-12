import { TicimaxConnector } from './TicimaxConnector';
import { TicimaxMapper } from './TicimaxMapper';
import { TicimaxParser } from './TicimaxParser';
import { TicimaxSoapClient } from './TicimaxSoapClient';
import { TicimaxMarketplaceAdapter } from './TicimaxMarketplaceAdapter';
import { EcommerceHttpClient, EcommerceRateLimiter } from '../core';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

describe('Ticimax Integration Suite', () => {
  describe('TicimaxMapper', () => {
    it('parses amounts correctly with decimal and comma formats', () => {
      expect(TicimaxMapper.parseAmount('199.90')).toBe(199.9);
      expect(TicimaxMapper.parseAmount('1.450,50')).toBe(1450.5);
      expect(TicimaxMapper.parseAmount(75.25)).toBe(75.25);
      expect(TicimaxMapper.parseAmount(undefined)).toBe(0);
      expect(TicimaxMapper.parseAmount(null)).toBe(0);
      expect(TicimaxMapper.parseAmount('')).toBe(0);
    });

    it('maps order statuses correctly to KroptOS unified status', () => {
      expect(TicimaxMapper.mapToKroptosStatus('Onay Bekliyor')).toBe('pending');
      expect(TicimaxMapper.mapToKroptosStatus('Ödeme Bekliyor')).toBe('pending');
      expect(TicimaxMapper.mapToKroptosStatus('Onaylandı')).toBe('processing');
      expect(TicimaxMapper.mapToKroptosStatus('Hazırlanıyor')).toBe('processing');
      expect(TicimaxMapper.mapToKroptosStatus('Kargoya Verildi')).toBe('shipped');
      expect(TicimaxMapper.mapToKroptosStatus('Teslim Edildi')).toBe('delivered');
      expect(TicimaxMapper.mapToKroptosStatus('İptal Edildi')).toBe('cancelled');
      expect(TicimaxMapper.mapToKroptosStatus('İade Edildi')).toBe('returned');
    });

    it('falls back to pending for unrecognized status', () => {
      expect(TicimaxMapper.mapToKroptosStatus('Bilinmeyen_Durum')).toBe('pending');
      expect(TicimaxMapper.mapOrderStatus('Bilinmeyen_Durum')).toBe('open');
    });
  });

  describe('TicimaxSoapClient & Parser', () => {
    let httpClient: EcommerceHttpClient;
    let soapClient: TicimaxSoapClient;

    beforeEach(() => {
      httpClient = new EcommerceHttpClient();
      soapClient = new TicimaxSoapClient(httpClient);
    });

    it('parses successful SelectUrunCount response', () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <SelectUrunCountResponse xmlns="http://tempuri.org/">
      <SelectUrunCountResult>42</SelectUrunCountResult>
    </SelectUrunCountResponse>
  </s:Body>
</s:Envelope>`;

      const res = soapClient.parseSoapResponse(mockXml, 'SelectUrunCount');
      expect(res).toBe('42');
    });

    it('throws error when SOAP Fault occurs', () => {
      const faultXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <s:Fault>
      <faultcode>s:Client</faultcode>
      <faultstring>Yetkisiz Erişim: UyeKodu geçersiz.</faultstring>
    </s:Fault>
  </s:Body>
</s:Envelope>`;

      expect(() => soapClient.parseSoapResponse(faultXml, 'SelectUrunCount')).toThrow(
        /Yetkisiz Erişim/,
      );
    });

    it('parses orders XML into structured objects', () => {
      const mockRaw = {
        Siparis: [
          {
            ID: '1001',
            SiparisNo: 'TS-1001',
            Durum: 'Onaylandı',
            GenelToplam: '750.00',
            MusteriAdi: 'Ahmet',
            MusteriSoyadi: 'Yılmaz',
            MusteriEmail: 'ahmet@example.com',
            Urunler: {
              SiparisUrun: [
                {
                  ID: '201',
                  UrunAdi: 'Deri Cüzdan',
                  StokKodu: 'CUZ-01',
                  Adet: '2',
                  BirimFiyat: '375.00',
                  ToplamTutar: '750.00',
                },
              ],
            },
            TeslimatAdresi: {
              AliciAdi: 'Ahmet Yılmaz',
              Adres: 'Atatürk Cad. No: 5',
              Il: 'İstanbul',
              Ilce: 'Şişli',
              PostaKodu: '34381',
              Telefon: '05551234567',
            },
          },
        ],
      };

      const orders = TicimaxParser.parseOrders(mockRaw);
      expect(orders).toHaveLength(1);
      expect(orders[0].SiparisNo).toBe('TS-1001');
      expect(orders[0].Urunler).toHaveLength(1);

      const unified = TicimaxMapper.toUnifiedOrder(orders[0]);
      expect(unified.orderNumber).toBe('TS-1001');
      expect(unified.totalPrice).toBe(750);
      expect(unified.items).toHaveLength(1);
      expect(unified.items[0].sku).toBe('CUZ-01');
      expect(unified.customer?.fullName).toBe('Ahmet Yılmaz');
      expect(unified.shippingAddress?.city).toBe('İstanbul');
    });
  });

  describe('TicimaxConnector End-to-End', () => {
    let httpClient: EcommerceHttpClient;
    let rateLimiter: EcommerceRateLimiter;
    let connector: TicimaxConnector;

    beforeEach(() => {
      httpClient = new EcommerceHttpClient();
      rateLimiter = new EcommerceRateLimiter();
      connector = new TicimaxConnector(
        {
          storeDomain: 'https://demo.ticimax.com',
          uyeKodu: 'TEST-AUTH-CODE-123',
        },
        httpClient,
        rateLimiter,
      );
    });

    it('normalizes store domain correctly', () => {
      expect(connector.getNormalizedStoreUrl()).toBe('https://demo.ticimax.com');

      const connector2 = new TicimaxConnector(
        { storeDomain: 'magaza.com', uyeKodu: 'CODE' },
        httpClient,
        rateLimiter,
      );
      expect(connector2.getNormalizedStoreUrl()).toBe('https://magaza.com');
    });

    it('tests connection successfully when credentials are valid', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <SelectUrunCountResponse xmlns="http://tempuri.org/">
      <SelectUrunCountResult>150</SelectUrunCountResult>
    </SelectUrunCountResponse>
  </s:Body>
</s:Envelope>`;

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockXml);

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('150 ürün bulundu');
    });

    it('returns failure result gracefully when connection fails', async () => {
      jest.spyOn(httpClient, 'request').mockRejectedValue(new Error('Connection timed out'));

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection timed out');
    });

    it('fetches orders and maps them', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <SelectSiparisResponse xmlns="http://tempuri.org/">
      <SelectSiparisResult>
        <Siparis>
          <ID>555</ID>
          <SiparisNo>SIP-555</SiparisNo>
          <Durum>Kargoya Verildi</Durum>
          <GenelToplam>450</GenelToplam>
          <KargoTakipNo>TRK123456</KargoTakipNo>
          <Urunler>
            <SiparisUrun>
              <ID>11</ID>
              <UrunAdi>Tişört</UrunAdi>
              <StokKodu>TSH-M</StokKodu>
              <Adet>1</Adet>
              <BirimFiyat>450</BirimFiyat>
            </SiparisUrun>
          </Urunler>
        </Siparis>
      </SelectSiparisResult>
    </SelectSiparisResponse>
  </s:Body>
</s:Envelope>`;

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockXml);

      const orders = await connector.fetchOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].orderNumber).toBe('SIP-555');
      expect(orders[0].fulfillmentStatus).toBe('fulfilled');
      expect(orders[0].rawPayload).toEqual({ trackingNumber: 'TRK123456', trackingCompany: undefined });
    });

    it('updates stock inventory successfully', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <StokGuncelleResponse xmlns="http://tempuri.org/">
      <StokGuncelleResult>true</StokGuncelleResult>
    </StokGuncelleResponse>
  </s:Body>
</s:Envelope>`;

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockXml);

      const res = await connector.updateInventory({ sku: 'TSH-M', availableQuantity: 25 });
      expect(res.success).toBe(true);
      expect(res.newQuantity).toBe(25);
    });

    it('fulfills order with tracking info', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <SetKargoTakipNoResponse xmlns="http://tempuri.org/">
      <SetKargoTakipNoResult>true</SetKargoTakipNoResult>
    </SetKargoTakipNoResponse>
  </s:Body>
</s:Envelope>`;

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockXml);

      const res = await connector.createFulfillment({
        orderId: '555',
        trackingNumber: 'YK-998877',
        carrierName: 'Yurtiçi Kargo',
      });

      expect(res.success).toBe(true);
      expect(res.fulfillmentId).toBe('555-fulfillment');
      expect(res.trackingNumber).toBe('YK-998877');
    });
  });

  describe('TicimaxMarketplaceAdapter', () => {
    it('adapts orders and products for KroptOS marketplace engine', async () => {
      const marketHttp = new MarketplaceHttpClient();
      const marketLimiter = new MarketplaceRateLimiter();

      const adapter = new TicimaxMarketplaceAdapter(
        { storeDomain: 'https://demo.ticimax.com', uyeKodu: 'TEST-CODE' },
        marketHttp,
        marketLimiter,
      );

      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <SelectSiparisResponse xmlns="http://tempuri.org/">
      <SelectSiparisResult>
        <Siparis>
          <ID>800</ID>
          <SiparisNo>TS-800</SiparisNo>
          <Durum>Onaylandı</Durum>
          <GenelToplam>300</GenelToplam>
        </Siparis>
      </SelectSiparisResult>
    </SelectSiparisResponse>
  </s:Body>
</s:Envelope>`;

      jest.spyOn(EcommerceHttpClient.prototype, 'request').mockResolvedValue(mockXml);

      const orders = await adapter.getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].source).toBe('ticimax');
      expect(orders[0].orderNumber).toBe('TS-800');
    });
  });
});
