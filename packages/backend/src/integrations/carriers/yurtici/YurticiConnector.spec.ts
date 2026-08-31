import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { YurticiConnector } from './YurticiConnector';
import { YurticiEnvelope } from './YurticiEnvelope';
import { normalizeYurticiPhone } from './YurticiMapper';
import { normalizeYurticiStatus } from './YurticiStatusMap';

describe('Yurtiçi Kargo Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'YURTICI',
    create: (ctx) => new YurticiConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      wsUserName: 'yurtici_user',
      wsPassword: 'yurtici_pass',
    },
    requiredCredentials: ['wsUserName', 'wsPassword'],
    normalizeStatus: normalizeYurticiStatus,
    respond: (req) => {
      if (req.body?.includes('createShipment')) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <createShipmentResponse xmlns="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
      <ShippingOrderResult>
        <outFlag>0</outFlag>
        <outResult>Başarılı</outResult>
        <errCode>0</errCode>
        <jobId>YK-JOB-12345</jobId>
        <shippingDataDetailVVO>
          <cargoKey>conformance-ref-1</cargoKey>
          <docNo>YK-DOC-12345</docNo>
        </shippingDataDetailVVO>
      </ShippingOrderResult>
    </createShipmentResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
      }

      if (req.body?.includes('queryShipment')) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <queryShipmentResponse xmlns="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
      <ShippingOrderResult>
        <outFlag>0</outFlag>
        <shippingDeliveryDetailVOArray>
          <cargoKey>CONF-TRK-1</cargoKey>
          <docId>YK-DOC-12345</docId>
          <operationCode>YK_IN_TRANSIT</operationCode>
          <shippingDeliveryItemDetailVOArray>
            <operationDate>2026-08-31 10:00:00</operationDate>
            <operationCode>YK_ACCEPTED</operationCode>
            <operationName>Teslim Alındı</operationName>
            <unitName>Tuzla Şube</unitName>
          </shippingDeliveryItemDetailVOArray>
          <shippingDeliveryItemDetailVOArray>
            <operationDate>2026-08-31 11:00:00</operationDate>
            <operationCode>YK_IN_TRANSIT</operationCode>
            <operationName>Transfer Merkezinde</operationName>
            <unitName>İstanbul Aktarma</unitName>
          </shippingDeliveryItemDetailVOArray>
        </shippingDeliveryDetailVOArray>
      </ShippingOrderResult>
    </queryShipmentResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
      }

      if (req.body?.includes('cancelShipment')) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <cancelShipmentResponse xmlns="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
      <ShippingOrderResult>
        <outFlag>0</outFlag>
        <errCode>0</errCode>
        <outResult>İptal Edildi</outResult>
      </ShippingOrderResult>
    </cancelShipmentResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
      }

      return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <response>OK</response>
  </soapenv:Body>
</soapenv:Envelope>`;
    },
    capabilities: {
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Yurtiçi Kargo Specific Unit Tests', () => {
    it('uses userLanguage for createShipment/cancelShipment and wsLanguage for queryShipment', () => {
      const creds = { wsUserName: 'u', wsPassword: 'p', userLanguage: 'TR', wsLanguage: 'TR' };

      const createXml = YurticiEnvelope.buildCreateShipment(creds, {
        cargoKey: 'KEY1',
        invoiceKey: 'INV1',
        receiverCustName: 'Ahmet Yılmaz',
        receiverAddress: 'Kadıköy Mh. Test Sk. No:1 İstanbul',
        receiverPhone1: '5551112233',
        desi: 1,
        kg: 1,
        cargoCount: 1,
      });
      expect(createXml).toContain('<userLanguage>TR</userLanguage>');
      expect(createXml).not.toContain('<wsLanguage>');

      const cancelXml = YurticiEnvelope.buildCancelShipment(creds, 'KEY1');
      expect(cancelXml).toContain('<userLanguage>TR</userLanguage>');
      expect(cancelXml).not.toContain('<wsLanguage>');

      const queryXml = YurticiEnvelope.buildQueryShipment(creds, 'KEY1');
      expect(queryXml).toContain('<wsLanguage>TR</wsLanguage>');
      expect(queryXml).not.toContain('<userLanguage>');
    });

    it('normalizes Turkish phone numbers to exactly 10 digits', () => {
      expect(normalizeYurticiPhone('+90 555 111 22 33')).toBe('5551112233');
      expect(normalizeYurticiPhone('05551112233')).toBe('5551112233');
      expect(normalizeYurticiPhone('2123652426')).toBe('2123652426');
    });

    it('ensures unknown status code maps to in_transit and never to terminal', () => {
      expect(normalizeYurticiStatus('UNKNOWN_CODE_999')).toBe('in_transit');
      expect(normalizeYurticiStatus('')).toBe('in_transit');
      expect(normalizeYurticiStatus(undefined)).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent', () => {
      const mockHttpClient = {} as any;
      const mockRateLimiter = {} as any;
      const factory = new CarrierConnectorFactory(mockHttpClient, mockRateLimiter);
      const credentialService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('YURTICI');

      const connector = factory.create('YURTICI', {
        wsUserName: 'u',
        wsPassword: 'p',
      });
      expect(connector).toBeInstanceOf(YurticiConnector);

      expect(credentialService.requiredFields('YURTICI')).toEqual([
        'wsUserName',
        'wsPassword',
      ]);

      expect(() =>
        credentialService.validate('YURTICI', {
          wsUserName: 'u',
          wsPassword: 'p',
        }),
      ).not.toThrow();
    });
  });
});
