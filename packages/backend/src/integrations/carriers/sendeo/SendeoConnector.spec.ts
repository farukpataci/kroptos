import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { SendeoConnector } from './SendeoConnector';
import { normalizeSendeoPhone } from './SendeoMapper';
import { normalizeSendeoStatus } from './SendeoStatusMap';

describe('Sendeo Kargo Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'SENDEO',
    create: (ctx) => new SendeoConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      username: 'sendeo_user_test',
      password: 'sendeo_pass_test',
      customerCode: '987654',
    },
    requiredCredentials: ['username', 'password', 'customerCode'],
    normalizeStatus: normalizeSendeoStatus,
    respond: (req) => {
      if (req.url?.includes('/Token/Login')) {
        return JSON.stringify({
          result: {
            token: 'mock-sendeo-jwt-token-456',
            expireDate: '2026-08-31T23:59:59',
          },
        });
      }

      if (req.url?.includes('conformance-never-created')) {
        return JSON.stringify({
          result: {
            statusCode: 'NOT_FOUND',
            statusName: 'Sipariş bulunamadı',
          },
        });
      }

      if (req.method === 'POST' && req.url?.includes('/SetCargo')) {
        return JSON.stringify({
          status: '200',
          result: {
            trackingNo: 'conformance-ref-1',
            barcode: 'conformance-ref-1',
            cargoId: 'SENDEO-SHIP-1',
          },
        });
      }

      if (req.method === 'POST' && req.url?.includes('/CancelCargo')) {
        return JSON.stringify({
          status: '200',
          message: 'Sipariş iptal edildi',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/GetCargoTracking')) {
        return JSON.stringify({
          result: {
            statusCode: '300',
            statusName: 'Kargo Sevk Edildi',
            trackingNo: 'conformance-ref-1',
            events: [
              {
                date: '2026-08-31T12:00:00.000Z',
                statusCode: '300',
                statusName: 'Kargo Sevk Edildi',
                description: 'Transfer merkezinde',
              },
            ],
          },
        });
      }

      return JSON.stringify({
        result: {
          statusCode: '300',
          statusName: 'Kargo Yolda',
        },
      });
    },
    capabilities: {
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Sendeo Kargo Specific Unit Tests', () => {
    it('normalizes Turkish phone numbers to 10 digits', () => {
      expect(normalizeSendeoPhone('+90 555 123 45 67')).toBe('5551234567');
      expect(normalizeSendeoPhone('05551234567')).toBe('5551234567');
      expect(normalizeSendeoPhone('5551234567')).toBe('5551234567');
    });

    it('maps unknown status code to in_transit and never to terminal', () => {
      expect(normalizeSendeoStatus('UNKNOWN_SENDEO_CODE')).toBe('in_transit');
      expect(normalizeSendeoStatus('100')).toBe('created');
      expect(normalizeSendeoStatus('500')).toBe('delivered');
      expect(normalizeSendeoStatus('900')).toBe('cancelled');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent for SENDEO', () => {
      const factory = new CarrierConnectorFactory(
        null as any,
        null as any,
      );
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('SENDEO');
      expect(credService.requiredFields('SENDEO')).toEqual(['username', 'password', 'customerCode']);

      const instance = factory.create('SENDEO', {
        username: 'usr',
        password: 'pwd',
        customerCode: '123',
      });
      expect(instance).toBeInstanceOf(SendeoConnector);
    });
  });
});
