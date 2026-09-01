import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { FanCourierConnector } from './FanCourierConnector';
import { normalizeFanCourierStatus } from './FanCourierStatusMap';

describe('FAN Courier Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'FAN_COURIER',
    create: (ctx) => new FanCourierConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      clientId: '7032158',
      username: 'clienttest',
      password: 'testing',
    },
    requiredCredentials: ['clientId', 'username', 'password'],
    normalizeStatus: normalizeFanCourierStatus,
    respond: (req) => {
      // 1. Login (/login)
      if (req.method === 'POST' && req.url?.includes('/login')) {
        return JSON.stringify({
          status: 'success',
          data: {
            token: 'fancourier_jwt_token_test_123',
            expires_at: '2026-09-01T23:59:59.000Z',
          },
        });
      }

      // 2. AWB creation (/intern-awb)
      if (req.method === 'POST' && req.url?.includes('/intern-awb')) {
        return JSON.stringify({
          status: 'success',
          data: {
            awbNumber: '2359876543210',
            pdfLabel: 'JVBERi0xLjQK...MOCK_FAN_COURIER_PDF_LABEL...',
          },
        });
      }

      // 3. Cancel AWB (DELETE /intern-awb)
      if (req.method === 'DELETE' && req.url?.includes('/intern-awb')) {
        return JSON.stringify({
          status: 'success',
          message: 'AWB deleted',
        });
      }

      // 4. Tracking details (/reports/awb/tracking)
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          status: 'error',
          message: 'AWB not found',
        });
      }

      if (req.method === 'POST' && req.url?.includes('/reports/awb/tracking')) {
        return JSON.stringify({
          status: 'success',
          data: [
            {
              awbNumber: '2359876543210',
              currentStatus: 'S4',
              events: [
                {
                  status: 'S2',
                  statusName: 'Preluat de la expeditor',
                  date: '2026-09-01 07:00:00',
                },
                {
                  status: 'S4',
                  statusName: 'In livrare la adresant',
                  date: '2026-09-01 09:00:00',
                  location: 'Depozit București Nord',
                },
              ],
            },
          ],
        });
      }

      return JSON.stringify({ status: 'success' });
    },
    capabilities: {
      getRates: false,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('FAN Courier Specific Unit Tests', () => {
    it('normalizes FAN Courier status activity codes accurately', () => {
      expect(normalizeFanCourierStatus('S9')).toBe('delivered');
      expect(normalizeFanCourierStatus('DELIVERED')).toBe('delivered');
      expect(normalizeFanCourierStatus('S4')).toBe('out_for_delivery');
      expect(normalizeFanCourierStatus('S2')).toBe('handed_over');
      expect(normalizeFanCourierStatus('S3')).toBe('in_transit');
      expect(normalizeFanCourierStatus('S1')).toBe('created');
      expect(normalizeFanCourierStatus('S10')).toBe('returned');
      expect(normalizeFanCourierStatus('S99')).toBe('cancelled');
      expect(normalizeFanCourierStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include FAN_COURIER', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('FAN_COURIER');
      expect(credService.requiredFields('FAN_COURIER')).toEqual(['clientId', 'username', 'password']);

      const instance = factory.create('FAN_COURIER', {
        clientId: '7032158',
        username: 'clienttest',
        password: 'testing',
      });
      expect(instance).toBeInstanceOf(FanCourierConnector);
    });
  });
});
