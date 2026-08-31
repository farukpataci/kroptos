import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { UpsConnector } from './UpsConnector';
import { normalizeUpsStatus } from './UpsStatusMap';

describe('UPS (United Parcel Service) Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'UPS',
    create: (ctx) => new UpsConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      clientId: 'ups_client_id_test',
      clientSecret: 'ups_client_secret_test',
      accountNumber: '123456',
    },
    requiredCredentials: ['clientId', 'clientSecret', 'accountNumber'],
    normalizeStatus: normalizeUpsStatus,
    respond: (req) => {
      // 1. OAuth Token endpoint
      if (req.method === 'POST' && req.url?.includes('/security/v1/oauth/token')) {
        return JSON.stringify({
          access_token: 'mock_ups_bearer_token_123',
          token_type: 'Bearer',
          expires_in: '14399',
          status: 'approved',
        });
      }

      // 2. Shipment creation
      if (req.method === 'POST' && req.url?.includes('/shipments/v1/ship')) {
        return JSON.stringify({
          ShipmentResponse: {
            Response: {
              ResponseStatus: {
                Code: '1',
                Description: 'Success',
              },
            },
            ShipmentResults: {
              ShipmentIdentificationNumber: '1Z1234567890123456',
              PackageResults: [
                {
                  TrackingNumber: '1Z1234567890123456',
                  ShippingLabel: {
                    ImageFormat: { Code: 'PDF' },
                    GraphicImage: 'JVBERi0xLjQK...',
                  },
                },
              ],
            },
          },
        });
      }

      // 3. Void / Cancel shipment
      if (req.method === 'DELETE' && req.url?.includes('/shipments/v1/void/cancel/')) {
        return JSON.stringify({
          VoidShipmentResponse: {
            Response: {
              ResponseStatus: {
                Code: '1',
                Description: 'Voided successfully',
              },
            },
            SummaryResult: {
              Status: {
                Code: '1',
                Description: 'Voided',
              },
            },
          },
        });
      }

      // 4. Rate quote
      if (req.method === 'POST' && req.url?.includes('/rating/v1/Rate')) {
        return JSON.stringify({
          RateResponse: {
            Response: {
              ResponseStatus: { Code: '1', Description: 'Success' },
            },
            RatedShipment: [
              {
                Service: { Code: '11' },
                TotalCharges: {
                  CurrencyCode: 'TRY',
                  MonetaryValue: '150.00',
                },
              },
            ],
          },
        });
      }

      // 5. Tracking details
      if (req.url?.includes('conformance-never-created')) {
        return JSON.stringify({
          trackResponse: {
            shipment: [],
          },
        });
      }

      if (req.method === 'GET' && req.url?.includes('/track/v1/details/')) {
        return JSON.stringify({
          trackResponse: {
            shipment: [
              {
                package: [
                  {
                    trackingNumber: '1Z1234567890123456',
                    activity: [
                      {
                        location: {
                          address: {
                            city: 'Istanbul',
                            country: 'TR',
                          },
                        },
                        status: {
                          type: 'I',
                          description: 'In Transit',
                        },
                        date: '20260831',
                        time: '120000',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }

      return JSON.stringify({ status: 'OK' });
    },
    capabilities: {
      getRates: true,
      batchTracking: false,
      findByReference: true,
    },
  });

  describe('UPS Specific Unit Tests', () => {
    it('normalizes UPS status activity codes accurately', () => {
      expect(normalizeUpsStatus('D')).toBe('delivered');
      expect(normalizeUpsStatus('P')).toBe('handed_over');
      expect(normalizeUpsStatus('O')).toBe('out_for_delivery');
      expect(normalizeUpsStatus('I')).toBe('in_transit');
      expect(normalizeUpsStatus('X')).toBe('undelivered');
      expect(normalizeUpsStatus('M')).toBe('created');
      expect(normalizeUpsStatus('V')).toBe('cancelled');
      expect(normalizeUpsStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include UPS', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('UPS');
      expect(credService.requiredFields('UPS')).toEqual(['clientId', 'clientSecret', 'accountNumber']);

      const instance = factory.create('UPS', {
        clientId: 'id',
        clientSecret: 'secret',
        accountNumber: '123456',
      });
      expect(instance).toBeInstanceOf(UpsConnector);
    });
  });
});
