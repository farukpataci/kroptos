import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { ColissimoConnector } from './ColissimoConnector';
import { normalizeColissimoStatus } from './ColissimoStatusMap';

describe('Colissimo / La Poste Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'COLISSIMO',
    create: (ctx) => new ColissimoConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      contractNumber: '12345678',
      password: 'colissimo_secret_pwd',
      apiKey: 'okapi_test_key_999',
    },
    requiredCredentials: ['contractNumber', 'password', 'apiKey'],
    normalizeStatus: normalizeColissimoStatus,
    respond: (req) => {
      // 1. Label generation (Create shipment / Probe)
      if (req.method === 'POST' && req.url?.includes('/generateLabel')) {
        return JSON.stringify({
          labelV2Response: {
            parcelNumber: '6A987654321FR',
            label: 'JVBERi0xLjQK...MOCK_COLISSIMO_PDF_LABEL...',
          },
        });
      }

      // 2. Tracking details
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          returnCode: 404,
          returnMessage: 'Parcel not found',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/suivi/v2/idships/')) {
        return JSON.stringify({
          returnCode: 200,
          returnMessage: 'OK',
          shipment: {
            idShip: '6A987654321FR',
            isCompleted: false,
            event: [
              {
                code: 'PC1',
                label: 'Colis en cours de livraison',
                date: '2026-09-01T09:00:00.000+02:00',
              },
              {
                code: 'PCH',
                label: 'Colis pris en charge',
                date: '2026-09-01T07:00:00.000+02:00',
              },
            ],
          },
        });
      }

      return JSON.stringify({ returnCode: 200 });
    },
    capabilities: {
      getRates: false,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Colissimo Specific Unit Tests', () => {
    it('normalizes Colissimo status activity codes accurately', () => {
      expect(normalizeColissimoStatus('LIV')).toBe('delivered');
      expect(normalizeColissimoStatus('PC1')).toBe('out_for_delivery');
      expect(normalizeColissimoStatus('PCH')).toBe('handed_over');
      expect(normalizeColissimoStatus('EXP')).toBe('in_transit');
      expect(normalizeColissimoStatus('PRE')).toBe('created');
      expect(normalizeColissimoStatus('RTO')).toBe('returned');
      expect(normalizeColissimoStatus('ANN')).toBe('cancelled');
      expect(normalizeColissimoStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include COLISSIMO', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('COLISSIMO');
      expect(credService.requiredFields('COLISSIMO')).toEqual(['contractNumber', 'password', 'apiKey']);

      const instance = factory.create('COLISSIMO', {
        contractNumber: '123',
        password: 'pwd',
        apiKey: 'key',
      });
      expect(instance).toBeInstanceOf(ColissimoConnector);
    });
  });
});
