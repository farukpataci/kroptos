import { CarrierHttpClient } from '../core/CarrierHttpClient';
import { CarrierRateLimiter } from '../core/CarrierRateLimiter';
import { CreateShipmentRequest } from '../core/CarrierTypes';
import { SuratConnector } from './SuratConnector';

describe('SuratConnector', () => {
  let httpClient: CarrierHttpClient;
  let rateLimiter: CarrierRateLimiter;
  let connector: SuratConnector;

  const mockCredentials = {
    userName: 'test_user',
    password: 'test_password',
    customerCode: '123456',
  };

  const sampleRequest: CreateShipmentRequest = {
    orderId: 'ord_123',
    orderNumber: 'ORD-12345',
    referenceCode: 'SRT_REF_001',
    sender: {
      fullName: 'Gönderici Firma',
      phone: '05551112233',
      line1: 'Maslak Mah. No:1',
      district: 'Sarıyer',
      city: 'İstanbul',
      countryCode: 'TR',
    },
    recipient: {
      fullName: 'Ahmet Yılmaz',
      phone: '05321112233',
      line1: 'Atatürk Cad. No:42',
      district: 'Çankaya',
      city: 'Ankara',
      countryCode: 'TR',
    },
    parcels: [
      {
        weightKg: 2,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
        desi: 1,
        chargeableWeightKg: 2,
      },
    ],
    desiDivisor: 3000,
    paymentType: 'sender_pays',
  };

  beforeEach(() => {
    httpClient = new CarrierHttpClient();
    rateLimiter = new CarrierRateLimiter();
    connector = new SuratConnector(mockCredentials, httpClient, rateLimiter, true);
  });

  describe('testConnection', () => {
    it('returns success when SOAP response is valid', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <KargoTakipHareketDetayliV2Response xmlns="http://tempuri.org/">
      <KargoTakipHareketDetayliV2Result>
        <SonucKodu>1</SonucKodu>
        <SonucAciklamasi>Bağlantı Başarılı</SonucAciklamasi>
      </KargoTakipHareketDetayliV2Result>
    </KargoTakipHareketDetayliV2Response>
  </soap:Body>
</soap:Envelope>`;

      jest.spyOn(httpClient, 'soap').mockResolvedValue(mockXml);

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('bağlantı testi başarılı');
    });

    it('returns failure when SOAP fault occurs', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Client</faultcode>
      <faultstring>Hatalı Kullanıcı Adı veya Şifre</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;

      jest.spyOn(httpClient, 'soap').mockResolvedValue(mockXml);

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Hatalı Kullanıcı Adı veya Şifre');
    });
  });

  describe('createShipment', () => {
    it('creates shipment and returns barcode and tracking number', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResponse xmlns="http://tempuri.org/">
      <GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResult>
        <ResultCode>1</ResultCode>
        <ResultMessage>Sipariş Oluşturuldu</ResultMessage>
        <Barcode>SURAT123456789</Barcode>
        <TrackingNumber>SRT_REF_001</TrackingNumber>
      </GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResult>
    </GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResponse>
  </soap:Body>
</soap:Envelope>`;

      jest.spyOn(httpClient, 'soap').mockResolvedValue(mockXml);

      const res = await connector.createShipment(sampleRequest);
      expect(res.trackingNumber).toBe('SRT_REF_001');
      expect(res.barcode).toBe('SURAT123456789');
    });

    it('throws error when creation fails', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResponse xmlns="http://tempuri.org/">
      <GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResult>
        <ResultCode>0</ResultCode>
        <ResultMessage>Adres bilgisi yetersiz</ResultMessage>
      </GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResult>
    </GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResponse>
  </soap:Body>
</soap:Envelope>`;

      jest.spyOn(httpClient, 'soap').mockResolvedValue(mockXml);

      await expect(connector.createShipment(sampleRequest)).rejects.toThrow(
        'Adres bilgisi yetersiz',
      );
    });
  });

  describe('cancelShipment', () => {
    it('cancels shipment successfully', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GonderiGeriCekResponse xmlns="http://tempuri.org/">
      <GonderiGeriCekResult>
        <ResultCode>1</ResultCode>
        <ResultMessage>Gönderi İptal Edildi</ResultMessage>
      </GonderiGeriCekResult>
    </GonderiGeriCekResponse>
  </soap:Body>
</soap:Envelope>`;

      jest.spyOn(httpClient, 'soap').mockResolvedValue(mockXml);

      const res = await connector.cancelShipment('SRT_REF_001');
      expect(res.success).toBe(true);
      expect(res.message).toContain('iptal edildi');
    });
  });

  describe('track', () => {
    it('tracks shipment movements and normalizes status', async () => {
      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <KargoTakipHareketDetayliV2Response xmlns="http://tempuri.org/">
      <KargoTakipHareketDetayliV2Result>
        <TakipNo>SRT_REF_001</TakipNo>
        <SonucKodu>TESLIM EDILDI</SonucKodu>
        <SonucAciklamasi>Kargo Alıcıya Teslim Edildi</SonucAciklamasi>
        <TeslimAlan>Ahmet Yılmaz</TeslimAlan>
        <Hareketler>
          <Movement>
            <Tarih>2026-08-31T10:00:00Z</Tarih>
            <IslemKodu>TESLIM</IslemKodu>
            <IslemAciklamasi>Teslim Edildi</IslemAciklamasi>
            <BirimAdi>Çankaya Şubesi</BirimAdi>
          </Movement>
        </Hareketler>
      </KargoTakipHareketDetayliV2Result>
    </KargoTakipHareketDetayliV2Response>
  </soap:Body>
</soap:Envelope>`;

      jest.spyOn(httpClient, 'soap').mockResolvedValue(mockXml);

      const res = await connector.track(['SRT_REF_001']);
      expect(res).toHaveLength(1);
      expect(res[0].status).toBe('delivered');
      expect(res[0].recipientName).toBe('Ahmet Yılmaz');
      expect(res[0].events).toHaveLength(1);
      expect(res[0].events[0].status).toBe('delivered');
    });
  });

  describe('getLabel', () => {
    it('returns formatted label', async () => {
      const label = await connector.getLabel('SRT_REF_001', 'ZPL');
      expect(label.format).toBe('ZPL');
      expect(label.content).toContain('SRT_REF_001');
    });
  });
});
