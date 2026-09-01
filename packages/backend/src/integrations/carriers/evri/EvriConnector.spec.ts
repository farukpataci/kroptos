import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { EvriConnector } from './EvriConnector';
import { normalizeEvriStatus } from './EvriStatusMap';

describe('Evri (Hermes UK) Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'EVRI',
    create: (ctx) => new EvriConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiKey: 'evri_test_api_key_123',
      apiSecret: 'evri_test_api_secret_456',
      clientId: '98765',
      clientSecret: 'sec123',
    },
    requiredCredentials: ['apiKey', 'apiSecret', 'clientId', 'clientSecret'],
    normalizeStatus: normalizeEvriStatus,
    respond: (req) => {
      // 1. Probe / test connection
      if (req.method === 'GET' && req.url?.includes('/v1/shipments?limit=1')) {
        return JSON.stringify({
          items: [],
          totalCount: 0,
        });
      }

      // 2. Shipment creation
      if (req.method === 'POST' && req.url?.includes('/v1/shipments')) {
        return JSON.stringify({
          shipmentId: 'EVR-SHIP-12345',
          barcode: 'HRM987654321GB',
          trackingNumber: 'HRM987654321GB',
          status: 'CREATED',
          labelData: 'JVBERi0xLjQK...MOCK_EVRI_PDF_LABEL...',
        });
      }

      // 3. Cancel shipment
      if (req.method === 'POST' && req.url?.includes('/v1/shipments/') && req.url?.includes('/cancel')) {
        return JSON.stringify({
          shipmentId: 'EVR-SHIP-12345',
          status: 'CANCELLED',
        });
      }

      // 4. Label download
      if (req.method === 'GET' && req.url?.includes('/v1/shipments/') && req.url?.includes('/label')) {
        return JSON.stringify({
          shipmentId: 'EVR-SHIP-12345',
          trackingNumber: 'HRM987654321GB',
          labelData: 'JVBERi0xLjQK...MOCK_EVRI_PDF_LABEL...',
        });
      }

      // 5. Tracking details
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          error: 'NOT_FOUND',
          status: 404,
        });
      }

      if (req.method === 'GET' && req.url?.includes('/v1/tracking/')) {
        return JSON.stringify({
          trackingNumber: 'HRM987654321GB',
          status: 'OUT_FOR_DELIVERY',
          statusDescription: 'Out for delivery with courier',
          events: [
            {
              statusCode: 'CREATED',
              statusDescription: 'Parcel information received',
              timestamp: '2026-09-01T07:00:00.000Z',
            },
            {
              statusCode: 'OUT_FOR_DELIVERY',
              statusDescription: 'Out for delivery with courier',
              timestamp: '2026-09-01T09:00:00.000Z',
              location: 'London North Depot',
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

  describe('Evri Specific Unit Tests', () => {
    it('normalizes Evri status activity codes accurately', () => {
      expect(normalizeEvriStatus('DELIVERED')).toBe('delivered');
      expect(normalizeEvriStatus('OUT_FOR_DELIVERY')).toBe('out_for_delivery');
      expect(normalizeEvriStatus('COLLECTED')).toBe('handed_over');
      expect(normalizeEvriStatus('IN_TRANSIT')).toBe('in_transit');
      expect(normalizeEvriStatus('CREATED')).toBe('created');
      expect(normalizeEvriStatus('RETURNED')).toBe('returned');
      expect(normalizeEvriStatus('CANCELLED')).toBe('cancelled');
      expect(normalizeEvriStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include EVRI', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('EVRI');
      expect(credService.requiredFields('EVRI')).toEqual(['apiKey', 'apiSecret', 'clientId', 'clientSecret']);

      const instance = factory.create('EVRI', {
        apiKey: 'key',
        apiSecret: 'sec',
        clientId: 'cid',
        clientSecret: 'csec',
      });
      expect(instance).toBeInstanceOf(EvriConnector);
    });
  });
});
