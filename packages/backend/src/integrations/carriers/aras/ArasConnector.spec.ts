import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { CarrierHttpClient } from '../core/CarrierHttpClient';
import { CarrierRateLimiter } from '../core/CarrierRateLimiter';
import { ArasConnector } from './ArasConnector';
import { ArasEnvelope } from './ArasEnvelope';
import { normalizeArasPhone } from './ArasMapper';
import { normalizeArasStatus } from './ArasStatusMap';
import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';

describe('Aras Kargo Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'ARAS',
    create: (ctx) => new ArasConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      userName: 'test_aras_user',
      password: 'test_aras_password',
      customerCode: '12345678',
    },
    requiredCredentials: ['userName', 'password', 'customerCode'],
    normalizeStatus: normalizeArasStatus,
    respond: (req) => {
      if (req.body?.includes('SetOrder')) {
        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SetOrderResponse xmlns="http://tempuri.org/">
      <SetOrderResult>
        <ResultCode>0</ResultCode>
        <ResultMessage>Başarılı</ResultMessage>
        <IntegrationCode>conformance-ref-1</IntegrationCode>
      </SetOrderResult>
    </SetOrderResponse>
  </soap:Body>
</soap:Envelope>`;
      }

      if (req.body?.includes('conformance-never-created')) {
        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetOrderWithIntegrationCodeResponse xmlns="http://tempuri.org/">
      <GetOrderWithIntegrationCodeResult>
        <OrderInformation>
          <StatusCode>NOT_FOUND</StatusCode>
        </OrderInformation>
      </GetOrderWithIntegrationCodeResult>
    </GetOrderWithIntegrationCodeResponse>
  </soap:Body>
</soap:Envelope>`;
      }

      if (req.body?.includes('GetOrderWithIntegrationCode')) {
        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetOrderWithIntegrationCodeResponse xmlns="http://tempuri.org/">
      <GetOrderWithIntegrationCodeResult>
        <OrderInformation>
          <OrderId>ORD-123</OrderId>
          <IntegrationCode>conformance-ref-1</IntegrationCode>
          <CargoKey>ARAS-KEY-123</CargoKey>
          <StatusCode>YOLDA</StatusCode>
          <StatusName>Yolda</StatusName>
          <Events>
            <Event>
              <Date>2026-08-31T12:00:00Z</Date>
              <StatusCode>YOLDA</StatusCode>
              <Description>Kargo yolda</Description>
            </Event>
          </Events>
        </OrderInformation>
      </GetOrderWithIntegrationCodeResult>
    </GetOrderWithIntegrationCodeResponse>
  </soap:Body>
</soap:Envelope>`;
      }

      if (req.body?.includes('CancelOrder')) {
        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CancelOrderResponse xmlns="http://tempuri.org/">
      <CancelOrderResult>
        <ResultCode>0</ResultCode>
        <ResultMessage>İptal edildi</ResultMessage>
      </CancelOrderResult>
    </CancelOrderResponse>
  </soap:Body>
</soap:Envelope>`;
      }

      return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetOrderWithIntegrationCodeResponse xmlns="http://tempuri.org/">
      <GetOrderWithIntegrationCodeResult>
        <OrderInformation>
          <StatusCode>YOLDA</StatusCode>
        </OrderInformation>
      </GetOrderWithIntegrationCodeResult>
    </GetOrderWithIntegrationCodeResponse>
  </soap:Body>
</soap:Envelope>`;
    },
    capabilities: {
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Aras Kargo Specific Unit Tests', () => {
    it('generates valid SOAP Envelope for SetOrder', () => {
      const xml = ArasEnvelope.buildSetOrderEnvelope(
        { userName: 'usr', password: 'pwd', customerCode: 'cust123' },
        {
          integrationCode: 'INT123',
          receiverName: 'Ahmet Yılmaz',
          receiverAddress: 'Atatürk Cad. No: 10 İstanbul',
          receiverPhone: '5551234567',
          cityName: 'İstanbul',
          townName: 'Kadıköy',
          payorTypeCode: 1,
          pieceCount: 1,
          weight: 2,
          desi: 2,
        },
      );

      expect(xml).toContain('<SetOrder');
      expect(xml).toContain('<userName>usr</userName>');
      expect(xml).toContain('<password>pwd</password>');
      expect(xml).toContain('<IntegrationCode>INT123</IntegrationCode>');
      expect(xml).toContain('<ReceiverName>Ahmet Yılmaz</ReceiverName>');
    });

    it('normalizes Turkish phone numbers to 10 digits', () => {
      expect(normalizeArasPhone('+90 555 123 45 67')).toBe('5551234567');
      expect(normalizeArasPhone('05551234567')).toBe('5551234567');
      expect(normalizeArasPhone('5551234567')).toBe('5551234567');
    });

    it('maps unknown status code to in_transit and never to terminal', () => {
      expect(normalizeArasStatus('UNKNOWN_ARAS_CODE')).toBe('in_transit');
      expect(normalizeArasStatus('SIPARIŞ ALINDI')).toBe('created');
      expect(normalizeArasStatus('TESLİM EDİLDİ')).toBe('delivered');
      expect(normalizeArasStatus('İPTAL EDİLDİ')).toBe('cancelled');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent for ARAS', () => {
      const factory = new CarrierConnectorFactory(
        new CarrierHttpClient(),
        new CarrierRateLimiter(),
      );
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('ARAS');
      expect(credService.requiredFields('ARAS')).toEqual(['userName', 'password', 'customerCode']);

      const instance = factory.create('ARAS', {
        userName: 'u',
        password: 'p',
        customerCode: 'c',
      });
      expect(instance).toBeInstanceOf(ArasConnector);
    });
  });
});
