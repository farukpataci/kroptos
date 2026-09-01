import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { PacketaConnector } from './PacketaConnector';
import { normalizePacketaStatus } from './PacketaStatusMap';

describe('Packeta (Zásilkovna) Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'PACKETA',
    create: (ctx) => new PacketaConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiKey: 'packeta_api_key_123',
      apiSecret: 'packeta_api_secret_456',
      eshop: 'my-store-cz',
    },
    requiredCredentials: ['apiKey', 'apiSecret', 'eshop'],
    normalizeStatus: normalizePacketaStatus,
    respond: (req) => {
      // 1. Branch Probe (/branch.json)
      if (req.method === 'GET' && req.url?.includes('/branch.json')) {
        return JSON.stringify({
          data: {
            1: { name: 'Prague Z-Point Depot' },
          },
        });
      }

      // 2. Create Packet (action: createPacket)
      if (req.method === 'POST' && req.body?.includes('"createPacket"')) {
        return JSON.stringify({
          status: 'ok',
          result: {
            id: 'Z9876543210',
            barcode: 'Z9876543210',
          },
        });
      }

      // 3. Cancel Packet (action: cancelPacket)
      if (req.method === 'POST' && req.body?.includes('"cancelPacket"')) {
        return JSON.stringify({
          status: 'ok',
          result: 'cancelled',
        });
      }

      // 4. Tracking details (action: packetStatus)
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          status: 'error',
          error: { code: '404', message: 'Packet not found' },
        });
      }

      if (req.method === 'POST' && req.body?.includes('"packetStatus"')) {
        return JSON.stringify({
          status: 'ok',
          result: {
            packetId: 'Z9876543210',
            statusCode: '5',
            statusName: 'Ready for pickup',
            events: [
              {
                code: '2',
                name: 'Submitted by e-shop',
                dateTime: '2026-09-01 07:00:00',
              },
              {
                code: '5',
                name: 'Ready for pickup at Z-Point',
                dateTime: '2026-09-01 09:00:00',
                location: 'Prague Z-Box Locker 102',
              },
            ],
          },
        });
      }

      return JSON.stringify({ status: 'ok' });
    },
    capabilities: {
      getRates: false,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('Packeta Specific Unit Tests', () => {
    it('normalizes Packeta status activity codes accurately', () => {
      expect(normalizePacketaStatus(6)).toBe('delivered');
      expect(normalizePacketaStatus('DELIVERED')).toBe('delivered');
      expect(normalizePacketaStatus(5)).toBe('out_for_delivery');
      expect(normalizePacketaStatus(2)).toBe('handed_over');
      expect(normalizePacketaStatus(3)).toBe('in_transit');
      expect(normalizePacketaStatus(1)).toBe('created');
      expect(normalizePacketaStatus(7)).toBe('returned');
      expect(normalizePacketaStatus(8)).toBe('cancelled');
      expect(normalizePacketaStatus(999)).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include PACKETA', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('PACKETA');
      expect(credService.requiredFields('PACKETA')).toEqual(['apiKey', 'apiSecret', 'eshop']);

      const instance = factory.create('PACKETA', {
        apiKey: 'key',
        apiSecret: 'secret',
        eshop: 'shop',
      });
      expect(instance).toBeInstanceOf(PacketaConnector);
    });
  });
});
