import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { PocztexConnector } from './PocztexConnector';
import { normalizePocztexStatus } from './PocztexStatusMap';

describe('Pocztex (Poczta Polska) Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'POCZTEX',
    create: (ctx) => new PocztexConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      username: 'pocztex_enadawca_user',
      password: 'pocztex_enadawca_password',
      accountNumber: '12345678',
    },
    requiredCredentials: ['username', 'password', 'accountNumber'],
    normalizeStatus: normalizePocztexStatus,
    respond: (req) => {
      // 1. Create Przesylka (action: addPrzesylka)
      if (req.method === 'POST' && req.body?.includes('"addPrzesylka"')) {
        return JSON.stringify({
          status: 'OK',
          numerNadania: 'PX987654321PL',
        });
      }

      // 2. Cancel Envelope (action: clearEnvelope)
      if (req.method === 'POST' && req.body?.includes('"clearEnvelope"')) {
        return JSON.stringify({
          status: 'OK',
        });
      }

      // 3. Tracking details (/uss/v1/tracking/)
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          status: 'ERROR',
          error: { code: '404', message: 'Przesylka nie znaleziona' },
        });
      }

      if (req.method === 'GET' && req.url?.includes('/uss/v1/tracking/')) {
        return JSON.stringify({
          numer: 'PX987654321PL',
          status: 'OK',
          zdarzenia: [
            {
              kod: '1',
              nazwa: 'Nadanie w placówce pocztowej',
              czas: '2026-09-01 07:00:00',
            },
            {
              kod: '4',
              nazwa: 'Przygotowanie do doręczenia',
              czas: '2026-09-01 09:00:00',
              jednostka: 'WER Warszawa',
            },
          ],
        });
      }

      return JSON.stringify({ status: 'OK' });
    },
    capabilities: {
      getRates: false,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Pocztex Specific Unit Tests', () => {
    it('normalizes Pocztex status activity codes accurately', () => {
      expect(normalizePocztexStatus(5)).toBe('delivered');
      expect(normalizePocztexStatus('DORECZENIE')).toBe('delivered');
      expect(normalizePocztexStatus(3)).toBe('out_for_delivery');
      expect(normalizePocztexStatus('AWIZO')).toBe('out_for_delivery');
      expect(normalizePocztexStatus(1)).toBe('handed_over');
      expect(normalizePocztexStatus(2)).toBe('in_transit');
      expect(normalizePocztexStatus(0)).toBe('created');
      expect(normalizePocztexStatus(6)).toBe('returned');
      expect(normalizePocztexStatus(7)).toBe('cancelled');
      expect(normalizePocztexStatus(999)).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include POCZTEX', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('POCZTEX');
      expect(credService.requiredFields('POCZTEX')).toEqual(['username', 'password', 'accountNumber']);

      const instance = factory.create('POCZTEX', {
        username: 'user',
        password: 'pwd',
        accountNumber: '123',
      });
      expect(instance).toBeInstanceOf(PocztexConnector);
    });
  });
});
