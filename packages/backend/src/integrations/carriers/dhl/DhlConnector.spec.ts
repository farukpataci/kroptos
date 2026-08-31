import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { DhlConnector } from './DhlConnector';
import { normalizeDhlPhone } from './DhlMapper';
import { normalizeDhlStatus } from './DhlStatusMap';

describe('DHL Express Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'DHL',
    create: (ctx) => new DhlConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiKey: 'dhl_api_key_test',
      apiSecret: 'dhl_api_secret_test',
      accountNumber: '123456789',
    },
    requiredCredentials: ['apiKey', 'apiSecret', 'accountNumber'],
    normalizeStatus: normalizeDhlStatus,
    respond: (req) => {
      if (req.url?.includes('conformance-never-created')) {
        return JSON.stringify({
          shipments: [],
        });
      }

      if (req.method === 'POST' && req.url?.includes('/shipments')) {
        return JSON.stringify({
          shipmentTrackingNumber: 'conformance-ref-1',
          trackingUrl: 'https://express.dhl.com/track/conformance-ref-1',
          packages: [
            {
              referenceNumber: 1,
              trackingNumber: 'conformance-ref-1',
            },
          ],
          documents: [
            {
              imageFormat: 'PDF',
              content: Buffer.from('DHL SAMPLE LABEL').toString('base64'),
              typeCode: 'label',
            },
          ],
        });
      }

      if (req.method === 'DELETE' && req.url?.includes('/shipments/')) {
        return JSON.stringify({
          message: 'Shipment cancelled',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/tracking')) {
        return JSON.stringify({
          shipments: [
            {
              shipmentTrackingNumber: 'conformance-ref-1',
              status: 'TRANSIT',
              events: [
                {
                  date: '2026-08-31',
                  time: '12:00:00',
                  typeCode: 'TRANSIT',
                  description: 'Shipment in transit',
                },
              ],
            },
          ],
        });
      }

      return JSON.stringify({
        shipments: [
          {
            shipmentTrackingNumber: 'conformance-ref-1',
            status: 'TRANSIT',
          },
        ],
      });
    },
    capabilities: {
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('DHL Express Specific Unit Tests', () => {
    it('normalizes international phone numbers correctly', () => {
      expect(normalizeDhlPhone('+90 555 123 45 67')).toBe('+905551234567');
      expect(normalizeDhlPhone('05551234567')).toBe('+905551234567');
      expect(normalizeDhlPhone('5551234567')).toBe('+905551234567');
    });

    it('maps unknown status code to in_transit and never to terminal', () => {
      expect(normalizeDhlStatus('UNKNOWN_DHL_CODE')).toBe('in_transit');
      expect(normalizeDhlStatus('CREATED')).toBe('created');
      expect(normalizeDhlStatus('DELIVERED')).toBe('delivered');
      expect(normalizeDhlStatus('CANCELLED')).toBe('cancelled');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent for DHL', () => {
      const factory = new CarrierConnectorFactory(
        null as any,
        null as any,
      );
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('DHL');
      expect(credService.requiredFields('DHL')).toEqual(['apiKey', 'apiSecret', 'accountNumber']);

      const instance = factory.create('DHL', {
        apiKey: 'key',
        apiSecret: 'sec',
        accountNumber: '123',
      });
      expect(instance).toBeInstanceOf(DhlConnector);
    });
  });
});
