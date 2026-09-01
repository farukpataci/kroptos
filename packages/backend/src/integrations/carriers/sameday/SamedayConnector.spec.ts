import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { SamedayConnector } from './SamedayConnector';
import { normalizeSamedayStatus } from './SamedayStatusMap';

describe('Sameday Courier Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'SAMEDAY',
    create: (ctx) => new SamedayConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      username: 'sameday_test_user',
      password: 'sameday_test_password_123',
    },
    requiredCredentials: ['username', 'password'],
    normalizeStatus: normalizeSamedayStatus,
    respond: (req) => {
      // 1. Authentication (/api/authenticate)
      if (req.method === 'POST' && req.url?.includes('/api/authenticate')) {
        return JSON.stringify({
          token: 'sameday_mock_jwt_token_xyz987',
          expires_at: '2026-09-01T23:59:59.000Z',
        });
      }

      // 2. AWB creation (/api/awb)
      if (req.method === 'POST' && req.url?.includes('/api/awb')) {
        return JSON.stringify({
          awbNumber: '1NBSMD987654321RO',
          awbCost: 15.5,
          pdfLink: 'https://api.sameday.ro/api/awb/download/1NBSMD987654321RO/pdf',
          rawLabelData: 'JVBERi0xLjQK...MOCK_SAMEDAY_PDF_LABEL...',
        });
      }

      // 3. Cancel AWB (/api/awb/{awbNumber})
      if (req.method === 'DELETE' && req.url?.includes('/api/awb/')) {
        return JSON.stringify({
          success: true,
          message: 'AWB cancelled successfully',
        });
      }

      // 4. Tracking details (/api/awb/status/{awbNumber})
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          status: 404,
          error: 'AWB not found',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/api/awb/status/')) {
        return JSON.stringify({
          awbNumber: '1NBSMD987654321RO',
          statusId: 3,
          statusState: 'OUT_FOR_DELIVERY',
          statusLabel: 'Curierul este en-route spre adresa',
          history: [
            {
              statusId: 1,
              statusState: 'PICKUP',
              statusLabel: 'Preluat de la expeditor',
              updatedAt: '2026-09-01T07:00:00.000Z',
            },
            {
              statusId: 3,
              statusState: 'OUT_FOR_DELIVERY',
              statusLabel: 'Curierul este en-route spre adresa',
              updatedAt: '2026-09-01T09:00:00.000Z',
              transitLocation: 'Hub Bucharest',
            },
          ],
        });
      }

      return JSON.stringify({ status: 200 });
    },
    capabilities: {
      getRates: false,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Sameday Specific Unit Tests', () => {
    it('normalizes Sameday status activity codes accurately', () => {
      expect(normalizeSamedayStatus(4)).toBe('delivered');
      expect(normalizeSamedayStatus('DELIVERED')).toBe('delivered');
      expect(normalizeSamedayStatus(3)).toBe('out_for_delivery');
      expect(normalizeSamedayStatus(1)).toBe('handed_over');
      expect(normalizeSamedayStatus(2)).toBe('in_transit');
      expect(normalizeSamedayStatus(0)).toBe('created');
      expect(normalizeSamedayStatus(5)).toBe('returned');
      expect(normalizeSamedayStatus(6)).toBe('cancelled');
      expect(normalizeSamedayStatus(999)).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include SAMEDAY', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('SAMEDAY');
      expect(credService.requiredFields('SAMEDAY')).toEqual(['username', 'password']);

      const instance = factory.create('SAMEDAY', {
        username: 'user',
        password: 'pwd',
      });
      expect(instance).toBeInstanceOf(SamedayConnector);
    });
  });
});
