import { CarrierConnectorFactory } from '../core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../core/CarrierCredentialService';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { FedexConnector } from './FedexConnector';
import { normalizeFedexStatus } from './FedexStatusMap';

describe('FedEx Express Carrier Integration', () => {
  describeCarrierConformance({
    provider: 'FEDEX',
    create: (ctx) => new FedexConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
    credentials: {
      apiKey: 'fedex_api_key_test',
      secretKey: 'fedex_secret_key_test',
      accountNumber: '123456789',
    },
    requiredCredentials: ['apiKey', 'secretKey', 'accountNumber'],
    normalizeStatus: normalizeFedexStatus,
    respond: (req) => {
      // 1. OAuth Token Endpoint
      if (req.method === 'POST' && req.url?.includes('/oauth/token')) {
        return JSON.stringify({
          access_token: 'mock_fedex_bearer_token_123',
          token_type: 'Bearer',
          expires_in: 3600,
        });
      }

      // 2. Shipment creation
      if (req.method === 'POST' && req.url?.includes('/ship/v1/shipments')) {
        return JSON.stringify({
          transactionId: 'TX-12345',
          output: {
            transactionShipments: [
              {
                masterTrackingNumber: '771234567890',
                pieceResponses: [
                  {
                    trackingNumber: '771234567890',
                    packageDocuments: [
                      {
                        docType: 'LABEL',
                        encodedLabel: 'JVBERi0xLjQK...',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }

      // 3. Cancel shipment
      if (req.method === 'PUT' && req.url?.includes('/ship/v1/shipments/cancel')) {
        return JSON.stringify({
          output: {
            cancelledShipment: true,
            successMessage: 'Shipment cancelled successfully',
          },
        });
      }

      // 4. Rate quote
      if (req.method === 'POST' && req.url?.includes('/rate/v1/rates/quotes')) {
        return JSON.stringify({
          output: {
            rateReplyDetails: [
              {
                serviceType: 'FEDEX_EXPRESS_SAVER',
                ratedShipmentDetails: [
                  {
                    totalNetCharge: 175.5,
                    currency: 'TRY',
                  },
                ],
              },
            ],
          },
        });
      }

      // 5. Pickup request
      if (req.method === 'POST' && req.url?.includes('/pickup/v1/pickups')) {
        return JSON.stringify({
          output: {
            pickupConfirmationCode: 'PU-987654321',
            message: 'Pickup scheduled',
          },
        });
      }

      // 6. Tracking details
      if (
        req.url?.includes('conformance-never-created') ||
        req.body?.includes('conformance-never-created')
      ) {
        return JSON.stringify({
          output: {
            completeTrackResults: [],
          },
        });
      }

      if (req.method === 'POST' && req.url?.includes('/track/v1/trackingnumbers')) {
        return JSON.stringify({
          output: {
            completeTrackResults: [
              {
                trackResults: [
                  {
                    trackingNumberInfo: { trackingNumber: '771234567890' },
                    latestStatusDetail: {
                      code: 'IT',
                      description: 'In transit',
                    },
                    scanEvents: [
                      {
                        date: '2026-08-31T12:00:00.000Z',
                        scanEventCode: 'IT',
                        eventDescription: 'In transit at sort facility',
                        scanLocation: {
                          city: 'Istanbul',
                          countryCode: 'TR',
                        },
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

  describe('FedEx Specific Unit Tests', () => {
    it('normalizes FedEx status activity codes accurately', () => {
      expect(normalizeFedexStatus('DL')).toBe('delivered');
      expect(normalizeFedexStatus('PU')).toBe('handed_over');
      expect(normalizeFedexStatus('OD')).toBe('out_for_delivery');
      expect(normalizeFedexStatus('IT')).toBe('in_transit');
      expect(normalizeFedexStatus('OC')).toBe('created');
      expect(normalizeFedexStatus('CA')).toBe('cancelled');
      expect(normalizeFedexStatus('DE')).toBe('undelivered');
      expect(normalizeFedexStatus('UNKNOWN')).toBe('in_transit');
    });

    it('ensures Factory, supportedProviders, and REQUIRED_CREDENTIALS include FEDEX', () => {
      const factory = new CarrierConnectorFactory(null as any, null as any);
      const credService = new CarrierCredentialService();

      expect(factory.supportedProviders()).toContain('FEDEX');
      expect(credService.requiredFields('FEDEX')).toEqual(['apiKey', 'secretKey', 'accountNumber']);

      const instance = factory.create('FEDEX', {
        apiKey: 'key',
        secretKey: 'sec',
        accountNumber: '123',
      });
      expect(instance).toBeInstanceOf(FedexConnector);
    });
  });
});
