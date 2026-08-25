import { ServiceUnavailableException } from '@nestjs/common';
import { CarrierHttpClient } from '../core/CarrierHttpClient';
import { CarrierRateLimiter } from '../core/CarrierRateLimiter';
import { describeCarrierConformance } from '../core/__tests__/connector-conformance';
import { MockCarrierConnector } from './MockCarrierConnector';

/**
 * The shared contract. The mock is the first subject on purpose: if the suite
 * cannot pass against a connector with no upstream at all, the clauses are
 * wrong and every real carrier would inherit that.
 */
describeCarrierConformance({
  provider: 'MOCK',
  create: (ctx) =>
    new MockCarrierConnector(ctx.credentials, ctx.httpClient, ctx.rateLimiter, ctx.isTestMode),
  credentials: {},
  // Genuinely none: there is nothing upstream to authenticate against. Any real
  // carrier listing `[]` here is skipping a clause it should be passing.
  requiredCredentials: [],
  // No upstream codes exist, so everything the mock could ever be handed is
  // unknown — and unknown means in_transit.
  normalizeStatus: () => 'in_transit',
  capabilities: {
    simulationOnly: true,
    findByReference: true,
  },
});

/**
 * The mock refuses to run outside test mode.
 *
 * This is the test that stops the old WMS behaviour from coming back. The
 * label service used to mint `YK-<random>` and call it a tracking number; the
 * failure only surfaced when a customer asked where their parcel was and no
 * carrier had ever heard of it. A mock that answers a live request is the same
 * bug wearing a connector's clothes, so every method has to refuse — not just
 * the obvious one.
 */
describe('MockCarrierConnector outside test mode', () => {
  const http = {} as CarrierHttpClient;
  const limiter = { throttle: jest.fn().mockResolvedValue(undefined) } as unknown as CarrierRateLimiter;

  const live = () => new MockCarrierConnector({}, http, limiter, false);
  const test = () => new MockCarrierConnector({}, http, limiter, true);

  const parcel = { weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10, desi: 0.33, chargeableWeightKg: 1 };
  const shipmentRequest = {
    orderId: 'ord-1',
    orderNumber: 'ORD-1',
    sender: {} as any,
    recipient: {} as any,
    parcels: [parcel],
    desiDivisor: 3000,
    paymentType: 'sender_pays' as const,
    referenceCode: 'ord-1',
  };

  it('refuses to create a shipment', async () => {
    await expect(live().createShipment(shipmentRequest)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('refuses to produce a label', async () => {
    await expect(live().getLabel('TRK-1', 'PDF')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('refuses to track', async () => {
    await expect(live().track(['TRK-1'])).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses to cancel', async () => {
    await expect(live().cancelShipment('TRK-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reports the connection as failed instead of claiming to be ready', async () => {
    const result = await live().testConnection();

    // testConnection answers rather than throws — that is its contract — but it
    // must not answer "ready".
    expect(result.success).toBe(false);
    expect(result.message).toContain('test modunda');
  });

  it('still works in test mode, and the tracking number is stable per reference', async () => {
    const connector = test();
    const first = await connector.createShipment(shipmentRequest);
    const second = await connector.createShipment(shipmentRequest);

    // Derived from the reference, not random: calling twice cannot mint a
    // second barcode.
    expect(first.trackingNumber).toBe(second.trackingNumber);
    expect(first.trackingNumber).toMatch(/^MOCK[0-9A-F]{10}$/);
    expect((await test().testConnection()).success).toBe(true);
  });
});
