import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { DpdConnector } from './DpdConnector';
import { normalizeDpdPhone } from './DpdMapper';
import { normalizeDpdStatus } from './DpdStatusMap';

describe('DPD Logistics Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'DPD',
    create: (ctx) => new DpdConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiKey: 'dpd_api_key_test_123',
      accountNumber: 'DPD_ACC_998877',
    },
    requiredCredentials: ['apiKey', 'accountNumber'],
    normalizeStatus: normalizeDpdStatus,
    respond: (req) => {
      if (req.url?.includes('conformance-never-created')) {
        return JSON.stringify({
          statusCode: 'NOT_FOUND',
          statusName: 'Shipment not found',
        });
      }

      if (req.method === 'POST' && req.url?.includes('/shipments')) {
        return JSON.stringify({
          shipmentResponse: {
            status: 'CREATED',
            shipmentNumber: 'conformance-ref-1',
            parcelNumber: 'DPD123456789',
          },
        });
      }

      if (req.method === 'PUT' && req.url?.includes('/cancellation')) {
        return JSON.stringify({
          status: 'SUCCESS',
          message: 'Shipment cancelled',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/tracking')) {
        return JSON.stringify({
          trackingData: {
            statusCode: 'IN_TRANSIT',
            statusName: 'In transit at hub',
            events: [
              {
                date: '2026-08-31T12:00:00.000Z',
                statusCode: 'IN_TRANSIT',
                statusName: 'In transit',
                description: 'Arrived at sorting hub',
              },
            ],
          },
        });
      }

      return JSON.stringify({
        status: 'OK',
      });
    },
    capabilities: {
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('DPD Logistics Specific Unit Tests', () => {
    it('normalizes international phone numbers', () => {
      expect(normalizeDpdPhone('+49 (0) 69 123456')).toBe('+49069123456');
      expect(normalizeDpdPhone('+90 532 111 22 33')).toBe('+905321112233');
    });

    it('maps unknown status code to in_transit and never to terminal', () => {
      expect(normalizeDpdStatus('UNKNOWN_DPD_CODE')).toBe('in_transit');
      expect(normalizeDpdStatus('CREATED')).toBe('created');
      expect(normalizeDpdStatus('DELIVERED')).toBe('delivered');
      expect(normalizeDpdStatus('CANCELLED')).toBe('cancelled');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent for DPD', () => {
      const factory = new CarrierConnectorFactory(
        null as any,
        null as any,
      );
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('DPD');
      expect(credService.requiredFields('DPD')).toEqual(['apiKey', 'accountNumber']);

      const instance = factory.create('DPD', {
        apiKey: 'key',
        accountNumber: 'acc',
      });
      expect(instance).toBeInstanceOf(DpdConnector);
    });
  });
});
