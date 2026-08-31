import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { GlsConnector } from './GlsConnector';
import { normalizeGlsStatus } from './GlsStatusMap';

describe('GLS Logistics Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'GLS',
    create: (ctx) => new GlsConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      username: 'gls_user_test',
      password: 'gls_password_test',
      shipperId: 'DE10012345',
    },
    requiredCredentials: ['username', 'password', 'shipperId'],
    normalizeStatus: normalizeGlsStatus,
    respond: (req) => {
      if (req.url?.includes('conformance-never-created')) {
        return JSON.stringify({
          parcelNumber: 'conformance-never-created',
          statusCode: 'NOT_FOUND',
          statusDescription: 'Parcel not found',
        });
      }

      if (req.method === 'POST' && req.url?.includes('/backend/rs/shipments')) {
        return JSON.stringify({
          parcelNumber: 'GLS123456789DE',
          shipmentNumber: 'SHIP-999',
          status: 'CREATED',
        });
      }

      if (req.method === 'DELETE' && req.url?.includes('/backend/rs/shipments/')) {
        return JSON.stringify({
          success: true,
          message: 'Shipment deleted',
        });
      }

      if (req.method === 'GET' && req.url?.includes('/backend/rs/shipments/')) {
        return JSON.stringify({
          parcelNumber: 'GLS123456789DE',
          statusCode: 'IN_TRANSIT',
          statusDescription: 'In transit at hub',
          events: [
            {
              dateTime: '2026-08-31T12:00:00.000Z',
              code: 'IN_TRANSIT',
              description: 'In transit',
              location: 'München Hub',
            },
          ],
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

  describe('GLS Specific Unit Tests', () => {
    it('maps unknown status code to in_transit and never to terminal', () => {
      expect(normalizeGlsStatus('UNKNOWN_GLS_CODE')).toBe('in_transit');
      expect(normalizeGlsStatus('DELIVERED')).toBe('delivered');
      expect(normalizeGlsStatus('CANCELLED')).toBe('cancelled');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS are consistent for GLS', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('GLS');
      expect(credService.requiredFields('GLS')).toEqual(['username', 'password', 'shipperId']);

      const instance = factory.create('GLS', {
        username: 'user',
        password: 'pass',
        shipperId: 'DE123',
      });
      expect(instance).toBeInstanceOf(GlsConnector);
    });
  });
});
