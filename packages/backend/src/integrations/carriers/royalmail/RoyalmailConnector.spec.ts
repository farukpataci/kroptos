import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { RoyalmailConnector } from './RoyalmailConnector';
import { normalizeRoyalmailStatus } from './RoyalmailStatusMap';

describe('Royal Mail Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'ROYAL_MAIL',
    create: (ctx) => new RoyalmailConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiKey: 'royalmail_test_click_and_drop_api_key_123',
    },
    requiredCredentials: ['apiKey'],
    normalizeStatus: normalizeRoyalmailStatus,
    respond: (req) => {
      // 1. Probe / test connection
      if (req.method === 'GET' && req.url?.includes('/orders?pageSize=1')) {
        return JSON.stringify({
          orders: [],
        });
      }

      // 2. Order creation
      if (req.method === 'POST' && req.url?.includes('/orders')) {
        return JSON.stringify({
          orderIdentifier: 'RM-ORDER-123456',
          orderReference: 'RM-REF-1',
          createdDateTime: '2026-09-01T10:00:00.000Z',
          orderStatus: 'created',
          trackingNumber: 'RM123456789GB',
        });
      }

      // 3. Update status / cancel
      if (req.method === 'PUT' && req.url?.includes('/orders/status')) {
        return JSON.stringify({
          success: true,
          status: 'cancelled',
        });
      }

      // 4. Label download
      if (req.method === 'GET' && req.url?.includes('/orders/') && req.url?.includes('/label')) {
        return JSON.stringify({
          orderIdentifier: 'RM-ORDER-123456',
          trackingNumber: 'RM123456789GB',
          labelData: 'JVBERi0xLjQK...MOCK_ROYALMAIL_PDF_LABEL...',
        });
      }

      // 5. Tracking details
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          errors: [
            {
              errorCode: 'NOT_FOUND',
              errorMessage: 'Order not found',
            },
          ],
        });
      }

      if (req.method === 'GET' && req.url?.includes('/orders/')) {
        return JSON.stringify({
          orderIdentifier: 'RM-ORDER-123456',
          orderStatus: 'despatched',
          trackingNumber: 'RM123456789GB',
          createdDateTime: '2026-09-01T10:00:00.000Z',
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

  describe('Royal Mail Specific Unit Tests', () => {
    it('normalizes Royal Mail status activity codes accurately', () => {
      expect(normalizeRoyalmailStatus('delivered')).toBe('delivered');
      expect(normalizeRoyalmailStatus('out_for_delivery')).toBe('out_for_delivery');
      expect(normalizeRoyalmailStatus('despatched')).toBe('handed_over');
      expect(normalizeRoyalmailStatus('collected')).toBe('handed_over');
      expect(normalizeRoyalmailStatus('in_transit')).toBe('in_transit');
      expect(normalizeRoyalmailStatus('created')).toBe('created');
      expect(normalizeRoyalmailStatus('returned')).toBe('returned');
      expect(normalizeRoyalmailStatus('cancelled')).toBe('cancelled');
      expect(normalizeRoyalmailStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include ROYAL_MAIL', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('ROYAL_MAIL');
      expect(credService.requiredFields('ROYAL_MAIL')).toEqual(['apiKey']);

      const instance = factory.create('ROYAL_MAIL', {
        apiKey: 'key',
      });
      expect(instance).toBeInstanceOf(RoyalmailConnector);
    });
  });
});
