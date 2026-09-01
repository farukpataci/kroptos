import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { CargusConnector } from './CargusConnector';
import { normalizeCargusStatus } from './CargusStatusMap';

describe('Cargus (Urgent Cargus) Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'CARGUS',
    create: (ctx) => new CargusConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      subscriptionKey: 'azure_apim_key_123456789',
      username: 'cargus_webexpress_user',
      password: 'cargus_webexpress_password',
    },
    requiredCredentials: ['subscriptionKey', 'username', 'password'],
    normalizeStatus: normalizeCargusStatus,
    respond: (req) => {
      // 1. LoginUser (/LoginUser)
      if (req.method === 'POST' && req.url?.includes('/LoginUser')) {
        return JSON.stringify('cargus_mock_jwt_token_999xyz');
      }

      // 2. AWB creation (/Awbs)
      if (req.method === 'POST' && req.url?.includes('/Awbs')) {
        return JSON.stringify({
          BarCode: '1089876543210',
          ReturnCode: 0,
          PdfLabel: 'JVBERi0xLjQK...MOCK_CARGUS_PDF_LABEL...',
        });
      }

      // 3. Cancel AWB (DELETE /Awbs)
      if (req.method === 'DELETE' && req.url?.includes('/Awbs')) {
        return JSON.stringify({
          ReturnCode: 0,
          ReturnMessage: 'AWB cancelled',
        });
      }

      // 4. Tracking details (/Awbs/Track/)
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          status: 404,
          error: 'AWB not found',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/Awbs/Track/')) {
        return JSON.stringify([
          {
            BarCode: '1089876543210',
            StatusCode: '4',
            StatusName: 'In livrare',
            EventList: [
              {
                StatusCode: '1',
                StatusName: 'Preluat de la expeditor',
                EventDate: '2026-09-01 07:00:00',
              },
              {
                StatusCode: '4',
                StatusName: 'In livrare',
                EventDate: '2026-09-01 09:00:00',
                LocationName: 'Depozit București',
              },
            ],
          },
        ]);
      }

      return JSON.stringify({ ReturnCode: 0 });
    },
    capabilities: {
      getRates: false,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Cargus Specific Unit Tests', () => {
    it('normalizes Cargus status activity codes accurately', () => {
      expect(normalizeCargusStatus(5)).toBe('delivered');
      expect(normalizeCargusStatus('DELIVERED')).toBe('delivered');
      expect(normalizeCargusStatus(4)).toBe('out_for_delivery');
      expect(normalizeCargusStatus(1)).toBe('handed_over');
      expect(normalizeCargusStatus(2)).toBe('in_transit');
      expect(normalizeCargusStatus(0)).toBe('created');
      expect(normalizeCargusStatus(6)).toBe('returned');
      expect(normalizeCargusStatus(7)).toBe('cancelled');
      expect(normalizeCargusStatus(999)).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include CARGUS', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('CARGUS');
      expect(credService.requiredFields('CARGUS')).toEqual(['subscriptionKey', 'username', 'password']);

      const instance = factory.create('CARGUS', {
        subscriptionKey: 'sub',
        username: 'user',
        password: 'pwd',
      });
      expect(instance).toBeInstanceOf(CargusConnector);
    });
  });
});
