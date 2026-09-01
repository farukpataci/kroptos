import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { PostnlConnector } from './PostnlConnector';
import { normalizePostnlStatus } from './PostnlStatusMap';

describe('PostNL Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'POSTNL',
    create: (ctx) => new PostnlConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiKey: 'postnl_test_api_key_123',
      customerCode: 'DEVT',
      customerNumber: '11223344',
    },
    requiredCredentials: ['apiKey', 'customerCode', 'customerNumber'],
    normalizeStatus: normalizePostnlStatus,
    respond: (req) => {
      // 1. Barcode generation / test connection
      if (req.method === 'GET' && req.url?.includes('/shipment/v1_1/barcode')) {
        return JSON.stringify({
          Barcode: '3SDEVT123456789',
          BarcodeType: '3S',
        });
      }

      // 2. Shipment & Label creation
      if (req.method === 'POST' && req.url?.includes('/shipment/v2_2/label')) {
        return JSON.stringify({
          ResponseShipments: [
            {
              Barcode: '3SDEVT123456789',
              ProductCodeDelivery: '3085',
              Labels: [
                {
                  Labeltype: 'Label',
                  Content: 'JVBERi0xLjQK...MOCK_POSTNL_PDF_LABEL...',
                },
              ],
            },
          ],
        });
      }

      // 3. Tracking details
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          error: 'not_found',
          status: 404,
        });
      }

      if (req.method === 'GET' && req.url?.includes('/shipment/v2_2/status/barcode/')) {
        return JSON.stringify({
          CurrentStatus: {
            Shipment: {
              StatusCode: '05',
              StatusDescription: 'Out for delivery',
              TimeStamp: '2026-09-01T09:00:00.000Z',
            },
          },
          CompleteStatus: {
            Shipment: {
              Barcode: '3SDEVT123456789',
              StatusCode: '05',
              OldStatus: [
                {
                  StatusCode: '01',
                  StatusDescription: 'Shipment announced',
                  TimeStamp: '2026-09-01T07:00:00.000Z',
                },
                {
                  StatusCode: '05',
                  StatusDescription: 'Driver on way',
                  TimeStamp: '2026-09-01T09:00:00.000Z',
                },
              ],
            },
          },
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

  describe('PostNL Specific Unit Tests', () => {
    it('normalizes PostNL status activity codes accurately', () => {
      expect(normalizePostnlStatus('07')).toBe('delivered');
      expect(normalizePostnlStatus('05')).toBe('out_for_delivery');
      expect(normalizePostnlStatus('02')).toBe('handed_over');
      expect(normalizePostnlStatus('03')).toBe('in_transit');
      expect(normalizePostnlStatus('01')).toBe('created');
      expect(normalizePostnlStatus('09')).toBe('returned');
      expect(normalizePostnlStatus('99')).toBe('cancelled');
      expect(normalizePostnlStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include POSTNL', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('POSTNL');
      expect(credService.requiredFields('POSTNL')).toEqual(['apiKey', 'customerCode', 'customerNumber']);

      const instance = factory.create('POSTNL', {
        apiKey: 'key',
        customerCode: 'DEVT',
        customerNumber: '112233',
      });
      expect(instance).toBeInstanceOf(PostnlConnector);
    });

    it('generates PostNL 3S barcodes accurately', async () => {
      const connector = new PostnlConnector(
        { apiKey: 'key', customerCode: 'DEVT', customerNumber: '123' },
        {
          json: async () => ({ Barcode: '3SDEVT99999' }),
        } as any,
        { throttle: async () => {} } as any,
        true,
      );

      const code = await connector.generateBarcode();
      expect(code).toBe('3SDEVT99999');
    });
  });
});
