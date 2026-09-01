import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { ChronopostConnector } from './ChronopostConnector';
import { normalizeChronopostStatus } from './ChronopostStatusMap';

describe('Chronopost Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'CHRONOPOST',
    create: (ctx) => new ChronopostConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      accountNumber: '12345678',
      password: 'chronopost_secret_password',
    },
    requiredCredentials: ['accountNumber', 'password'],
    normalizeStatus: normalizeChronopostStatus,
    respond: (req) => {
      // 1. Shipping creation (shippingV2)
      if (req.method === 'POST' && req.url?.includes('/ShippingServiceWS/shippingV2')) {
        return JSON.stringify({
          errorCode: 0,
          errorMessage: 'OK',
          skybillNumber: 'FW987654321FR',
          pdfEtiquette: 'JVBERi0xLjQK...MOCK_CHRONOPOST_PDF_LABEL...',
        });
      }

      // 2. Tracking details (trackSkybillV2)
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          errorCode: 404,
          errorMessage: 'Skybill not found',
        });
      }

      if (req.method === 'POST' && req.url?.includes('/TrackingServiceWS/trackSkybillV2')) {
        return JSON.stringify({
          errorCode: 0,
          errorMessage: 'OK',
          skybillNumber: 'FW987654321FR',
          isDelivered: false,
          events: [
            {
              code: 'E',
              label: 'En cours de livraison',
              eventDate: '2026-09-01T09:00:00.000+02:00',
              eventLocation: 'Agence Paris Nord',
            },
            {
              code: 'PC',
              label: 'Pris en charge',
              eventDate: '2026-09-01T07:00:00.000+02:00',
            },
          ],
        });
      }

      return JSON.stringify({ errorCode: 0 });
    },
    capabilities: {
      getRates: false,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Chronopost Specific Unit Tests', () => {
    it('normalizes Chronopost status activity codes accurately', () => {
      expect(normalizeChronopostStatus('D')).toBe('delivered');
      expect(normalizeChronopostStatus('E')).toBe('out_for_delivery');
      expect(normalizeChronopostStatus('PC')).toBe('handed_over');
      expect(normalizeChronopostStatus('TA')).toBe('in_transit');
      expect(normalizeChronopostStatus('PRE')).toBe('created');
      expect(normalizeChronopostStatus('RB')).toBe('returned');
      expect(normalizeChronopostStatus('AN')).toBe('cancelled');
      expect(normalizeChronopostStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include CHRONOPOST', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('CHRONOPOST');
      expect(credService.requiredFields('CHRONOPOST')).toEqual(['accountNumber', 'password']);

      const instance = factory.create('CHRONOPOST', {
        accountNumber: '12345',
        password: 'pwd',
      });
      expect(instance).toBeInstanceOf(ChronopostConnector);
    });
  });
});
