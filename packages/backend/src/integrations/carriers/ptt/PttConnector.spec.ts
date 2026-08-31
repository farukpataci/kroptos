import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { PttConnector } from './PttConnector';
import { normalizePttPhone } from './PttMapper';
import { normalizePttStatus } from './PttStatusMap';

describe('PTT Kargo Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'PTT',
    create: (ctx) => new PttConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      username: 'ptt_user_test',
      password: 'ptt_pass_test',
      customerCode: '123456',
    },
    requiredCredentials: ['username', 'password', 'customerCode'],
    normalizeStatus: normalizePttStatus,
    respond: (req) => {
      if (req.body?.includes('conformance-never-created')) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
   <soapenv:Body>
      <gonderiSorguResponse>
         <return>
            <sonucKodu>NOT_FOUND</sonucKodu>
            <sonucAciklamasi>Barkod bulunamadı</sonucAciklamasi>
         </return>
      </gonderiSorguResponse>
   </soapenv:Body>
</soapenv:Envelope>`;
      }

      if (req.body?.includes('gonderiKabul')) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
   <soapenv:Body>
      <gonderiKabulResponse>
         <return>
            <sonucKodu>0</sonucKodu>
            <sonucAciklamasi>İşlem Başarılı</sonucAciklamasi>
            <barkodNo>conformance-ref-1</barkodNo>
         </return>
      </gonderiKabulResponse>
   </soapenv:Body>
</soapenv:Envelope>`;
      }

      if (req.body?.includes('gonderiIptal')) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
   <soapenv:Body>
      <gonderiIptalResponse>
         <return>
            <sonucKodu>0</sonucKodu>
            <sonucAciklamasi>İptal Edildi</sonucAciklamasi>
         </return>
      </gonderiIptalResponse>
   </soapenv:Body>
</soapenv:Envelope>`;
      }

      if (req.body?.includes('gonderiSorgu')) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
   <soapenv:Body>
      <gonderiSorguResponse>
         <return>
            <sonucKodu>SEVKEDILDI</sonucKodu>
            <sonucAciklamasi>Kargo Sevk Edildi</sonucAciklamasi>
            <barkodNo>conformance-ref-1</barkodNo>
            <dongu>
               <tarih>2026-08-31T12:00:00.000Z</tarih>
               <durumKodu>SEVKEDILDI</durumKodu>
               <durumAciklamasi>Transfer merkezinde</durumAciklamasi>
            </dongu>
         </return>
      </gonderiSorguResponse>
   </soapenv:Body>
</soapenv:Envelope>`;
      }

      return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
   <soapenv:Body>
      <gonderiSorguResponse>
         <return>
            <sonucKodu>0</sonucKodu>
            <sonucAciklamasi>Başarılı</sonucAciklamasi>
         </return>
      </gonderiSorguResponse>
   </soapenv:Body>
</soapenv:Envelope>`;
    },
    capabilities: {
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('PTT Kargo Specific Unit Tests', () => {
    it('normalizes Turkish phone numbers to 10 digits', () => {
      expect(normalizePttPhone('+90 532 987 65 43')).toBe('5329876543');
      expect(normalizePttPhone('05329876543')).toBe('5329876543');
      expect(normalizePttPhone('5329876543')).toBe('5329876543');
    });

    it('maps unknown status code to in_transit and never to terminal', () => {
      expect(normalizePttStatus('UNKNOWN_PTT_CODE')).toBe('in_transit');
      expect(normalizePttStatus('VERI_YUKLENDI')).toBe('created');
      expect(normalizePttStatus('TESLIM_EDILDI')).toBe('delivered');
      expect(normalizePttStatus('IPTAL')).toBe('cancelled');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent for PTT', () => {
      const factory = new CarrierConnectorFactory(
        null as any,
        null as any,
      );
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('PTT');
      expect(credService.requiredFields('PTT')).toEqual(['username', 'password', 'customerCode']);

      const instance = factory.create('PTT', {
        username: 'usr',
        password: 'pwd',
        customerCode: '123',
      });
      expect(instance).toBeInstanceOf(PttConnector);
    });
  });
});
