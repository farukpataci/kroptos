import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { MngConnector } from './MngConnector';
import { normalizeMngPhone } from './MngMapper';
import { normalizeMngStatus } from './MngStatusMap';

describe('MNG Kargo Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'MNG',
    create: (ctx) => new MngConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      customerNumber: '123456',
      username: 'mng_user_test',
      password: 'mng_pass_test',
    },
    requiredCredentials: ['customerNumber', 'username', 'password'],
    normalizeStatus: normalizeMngStatus,
    respond: (req) => {
      if (req.url?.includes('/token')) {
        return JSON.stringify({
          jwtToken: 'mock-mng-jwt-token-123',
          expireDate: '2026-08-31T23:59:59',
        });
      }

      if (req.url?.includes('conformance-never-created')) {
        return JSON.stringify({
          statusCode: 'NOT_FOUND',
          message: 'Sipariş bulunamadı',
        });
      }

      if (req.method === 'POST' && req.url?.includes('/createOrder')) {
        return JSON.stringify({
          statusCode: '200',
          trackingCode: 'conformance-ref-1',
          barcode: 'conformance-ref-1',
          shipmentId: 'MNG-SHIP-1',
        });
      }

      if (req.method === 'POST' && req.url?.includes('/cancelOrder')) {
        return JSON.stringify({
          statusCode: '200',
          message: 'Sipariş iptal edildi',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/getShipmentStatus')) {
        return JSON.stringify({
          statusCode: 'YOLDA',
          statusName: 'Kargo Yolda',
          trackingCode: 'conformance-ref-1',
          events: [
            {
              date: '2026-08-31T12:00:00.000Z',
              statusCode: 'YOLDA',
              statusName: 'Kargo Yolda',
              description: 'Transfer merkezinde',
            },
          ],
        });
      }

      return JSON.stringify({
        statusCode: 'YOLDA',
        statusName: 'Kargo Yolda',
      });
    },
    capabilities: {
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('MNG Kargo Specific Unit Tests', () => {
    it('normalizes Turkish phone numbers to 10 digits', () => {
      expect(normalizeMngPhone('+90 555 123 45 67')).toBe('5551234567');
      expect(normalizeMngPhone('05551234567')).toBe('5551234567');
      expect(normalizeMngPhone('5551234567')).toBe('5551234567');
    });

    it('maps unknown status code to in_transit and never to terminal', () => {
      expect(normalizeMngStatus('UNKNOWN_MNG_CODE')).toBe('in_transit');
      expect(normalizeMngStatus('SIPARIS_ALINDI')).toBe('created');
      expect(normalizeMngStatus('TESLIM_EDILDI')).toBe('delivered');
      expect(normalizeMngStatus('IPTAL_EDILDI')).toBe('cancelled');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent for MNG', () => {
      const factory = new CarrierConnectorFactory(
        null as any,
        null as any,
      );
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('MNG');
      expect(credService.requiredFields('MNG')).toEqual(['customerNumber', 'username', 'password']);

      const instance = factory.create('MNG', {
        customerNumber: '123',
        username: 'usr',
        password: 'pwd',
      });
      expect(instance).toBeInstanceOf(MngConnector);
    });
  });
});
