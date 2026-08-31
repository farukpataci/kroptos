import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { HepsijetConnector } from './HepsijetConnector';
import { normalizeTurkishCharacters } from './HepsijetMapper';
import { normalizeHepsijetStatus } from './HepsijetStatusMap';

describe('HepsiJET Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'HEPSIJET',
    create: (ctx) => new HepsijetConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      userName: 'hepsijet_user',
      password: 'hepsijet_pass',
      companyShortName: 'HEPSI_SHORT',
    },
    requiredCredentials: ['userName', 'password', 'companyShortName'],
    normalizeStatus: normalizeHepsijetStatus,
    respond: (req) => {
      if (req.url.includes('/auth/getToken')) {
        return JSON.stringify({
          status: 'OK',
          data: { token: 'mock-hepsijet-token' },
        });
      }

      if (req.url.includes('/advance/sendDeliveryAdvance/v2')) {
        return JSON.stringify({
          status: 'OK',
          data: {
            barcode: 'HJ-BC-12345',
            trackingNumber: 'HJ-TRK-12345',
            customerOrderId: 'conformance-ref-1',
          },
        });
      }

      if (req.url.includes('/deliveryTransaction/getDeliveryTracking')) {
        return JSON.stringify({
          status: 'OK',
          data: [
            {
              trackingNumber: 'CONF-TRK-1',
              customerOrderId: 'CONF-TRK-1',
              currentStatusCode: 'HJ_IN_TRANSIT',
              events: [
                {
                  actionDate: new Date(Date.now() - 3600000).toISOString(),
                  statusCode: 'HJ_ACCEPTED',
                  statusName: 'Teslim Alındı',
                  location: 'Tuzla Transfer',
                },
                {
                  actionDate: new Date().toISOString(),
                  statusCode: 'HJ_IN_TRANSIT',
                  statusName: 'Yolda',
                  location: 'İstanbul Transfer',
                },
              ],
            },
          ],
        });
      }

      if (req.url.includes('/advance/deleteDeliveryAdvance')) {
        return JSON.stringify({
          status: 'OK',
          data: { cancelled: true },
        });
      }

      if (req.url.includes('/delivery/barcodes-label')) {
        return 'MOCK_LABEL_CONTENT';
      }

      return JSON.stringify({ status: 'OK' });
    },
    capabilities: {
      batchTracking: false, // HepsiJET batch tracking unconfirmed in single advance flow docs
      findByReference: true,
    },
  });

  describe('HepsiJET Specific Unit Tests', () => {
    it('normalizes Turkish characters in address fields', () => {
      expect(normalizeTurkishCharacters('İstanbul / Şişli / Beşiktaş')).toBe('Istanbul / Sisli / Besiktas');
      expect(normalizeTurkishCharacters('Örnek / Çankaya / Göztepe')).toBe('Ornek / Cankaya / Goztepe');
    });

    it('ensures unknown status code maps to in_transit and never to terminal', () => {
      expect(normalizeHepsijetStatus('UNKNOWN_CODE_999')).toBe('in_transit');
      expect(normalizeHepsijetStatus('')).toBe('in_transit');
      expect(normalizeHepsijetStatus(undefined)).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent', () => {
      const mockHttpClient = {} as any;
      const mockRateLimiter = {} as any;
      const factory = new CarrierConnectorFactory(mockHttpClient, mockRateLimiter);
      const credentialService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('HEPSIJET');

      const connector = factory.create('HEPSIJET', {
        userName: 'u',
        password: 'p',
        companyShortName: 'c',
      });
      expect(connector).toBeInstanceOf(HepsijetConnector);

      expect(credentialService.requiredFields('HEPSIJET')).toEqual([
        'userName',
        'password',
        'companyShortName',
      ]);

      expect(() =>
        credentialService.validate('HEPSIJET', {
          userName: 'u',
          password: 'p',
          companyShortName: 'c',
        }),
      ).not.toThrow();
    });
  });
});
