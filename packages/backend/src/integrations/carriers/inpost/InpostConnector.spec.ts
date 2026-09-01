import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { InpostConnector } from './InpostConnector';
import { normalizeInpostStatus } from './InpostStatusMap';

describe('InPost (Paczkomaty) Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'INPOST',
    create: (ctx) => new InpostConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiToken: 'inpost_test_api_token_123',
      organizationId: '987654',
    },
    requiredCredentials: ['apiToken', 'organizationId'],
    normalizeStatus: normalizeInpostStatus,
    respond: (req) => {
      // 1. Probe / test connection
      if (req.method === 'GET' && req.url?.includes('/organizations/987654/shipments?per_page=1')) {
        return JSON.stringify({
          items: [],
          total_count: 0,
        });
      }

      // 2. Shipment creation
      if (req.method === 'POST' && req.url?.includes('/organizations/987654/shipments')) {
        return JSON.stringify({
          id: 1234567,
          status: 'confirmed',
          tracking_number: '66000000000000000000001',
          service: 'inpost_locker_standard',
          custom_attributes: {
            target_point: 'KRA010',
          },
          parcels: [
            {
              id: 'P123',
              tracking_number: '66000000000000000000001',
            },
          ],
        });
      }

      // 3. Cancel shipment
      if (req.method === 'POST' && req.url?.includes('/shipments/') && req.url?.includes('/cancel')) {
        return JSON.stringify({
          id: 1234567,
          status: 'cancelled',
        });
      }

      // 4. Label download
      if (req.method === 'GET' && req.url?.includes('/shipments/') && req.url?.includes('/label')) {
        return JSON.stringify({
          label: 'JVBERi0xLjQK...MOCK_INPOST_PDF_LABEL...',
        });
      }

      // 5. Tracking details
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          error: 'not_found',
          status: 404,
        });
      }

      if (req.method === 'GET' && req.url?.includes('/tracking/')) {
        return JSON.stringify({
          tracking_number: '66000000000000000000001',
          service: 'inpost_locker_standard',
          status: 'ready_for_pickup',
          tracking_details: [
            {
              status: 'confirmed',
              datetime: '2026-09-01T08:00:00.000Z',
              description: 'Przesyłka zarejestrowana',
            },
            {
              status: 'ready_for_pickup',
              datetime: '2026-09-01T10:30:00.000Z',
              description: 'Przesyłka oczekuje w Paczkomacie KRA010',
              location: 'KRA010',
            },
          ],
        });
      }

      // 6. Points listing
      if (req.method === 'GET' && req.url?.includes('/points')) {
        return JSON.stringify({
          items: [
            {
              name: 'KRA010',
              type: ['parcel_locker'],
              status: 'OPERATIONAL',
              address: {
                street: 'Pawia',
                building_number: '5',
                city: 'Kraków',
                post_code: '31-154',
                country_code: 'PL',
              },
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

  describe('InPost Specific Unit Tests', () => {
    it('normalizes InPost status activity codes accurately', () => {
      expect(normalizeInpostStatus('delivered')).toBe('delivered');
      expect(normalizeInpostStatus('ready_for_pickup')).toBe('out_for_delivery');
      expect(normalizeInpostStatus('out_for_delivery')).toBe('out_for_delivery');
      expect(normalizeInpostStatus('dispatched_by_sender')).toBe('handed_over');
      expect(normalizeInpostStatus('taken_by_courier')).toBe('handed_over');
      expect(normalizeInpostStatus('adopted_at_sorting_center')).toBe('in_transit');
      expect(normalizeInpostStatus('created')).toBe('created');
      expect(normalizeInpostStatus('returned_to_sender')).toBe('returned');
      expect(normalizeInpostStatus('cancelled')).toBe('cancelled');
      expect(normalizeInpostStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include INPOST', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('INPOST');
      expect(credService.requiredFields('INPOST')).toEqual(['apiToken', 'organizationId']);

      const instance = factory.create('INPOST', {
        apiToken: 'token',
        organizationId: '123',
      });
      expect(instance).toBeInstanceOf(InpostConnector);
    });

    it('lists pickup points (Paczkomaty) successfully', async () => {
      const connector = new InpostConnector(
        { apiToken: 'token', organizationId: '123' },
        {
          json: async () => ({
            items: [
              {
                name: 'WAR001',
                type: ['parcel_locker'],
                status: 'OPERATIONAL',
                address: {
                  street: 'Marszałkowska',
                  building_number: '10',
                  city: 'Warszawa',
                  post_code: '00-001',
                  country_code: 'PL',
                },
              },
            ],
          }),
        } as any,
        { throttle: async () => {} } as any,
        true,
      );

      const points = await connector.listPickupPoints('Warszawa');
      expect(points).toHaveLength(1);
      expect(points[0].name).toBe('WAR001');
    });
  });
});
