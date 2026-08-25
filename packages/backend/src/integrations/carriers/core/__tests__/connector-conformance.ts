import {
  BadRequestException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CarrierConnector } from '../CarrierConnector';
import { CarrierHttpClient, CarrierHttpError, CarrierRequestOptions } from '../CarrierHttpClient';
import { CarrierRateLimiter } from '../CarrierRateLimiter';
import { CarrierAddress, CreateShipmentRequest, Parcel, ShipmentStatus } from '../CarrierTypes';

/**
 * The contract every CarrierConnector has to satisfy, written once.
 *
 * Adding a carrier is: get credentials, call describeCarrierConformance() from
 * that carrier's spec file, fix the red. Copying these assertions into each
 * spec is how they drift — the fifth carrier quietly drops the two clauses that
 * were inconvenient, and nobody notices until a customer is handed a barcode no
 * carrier issued.
 */

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/** Answers the connector's calls with a well-formed carrier payload. */
export type CarrierResponder = (req: RecordedRequest) => string | Promise<string>;

export interface ConformanceContext {
  credentials: Record<string, any>;
  httpClient: CarrierHttpClient;
  rateLimiter: CarrierRateLimiter;
  isTestMode: boolean;
}

export interface ConformanceCapabilities {
  /**
   * The carrier publishes a batch tracking endpoint. Defaults to true — one
   * request per parcel burns the quota, so dropping the clause has to be an
   * explicit opt-out backed by the carrier's doc page, not a silent default.
   */
  batchTracking?: boolean;
  /** No upstream API at all (mock/simulation). Must refuse live mode. */
  simulationOnly?: boolean;
  getRates?: boolean;
  createReturn?: boolean;
  findByReference?: boolean;
}

export interface ConformanceSubject {
  provider: string;
  /** Fresh connector per test: state shared between tests hides real bugs. */
  create(ctx: ConformanceContext): CarrierConnector;
  /** Credentials the happy paths run with. */
  credentials: Record<string, any>;
  /**
   * Keys the connector must refuse to run without. `[]` skips that clause, and
   * is only honest for a connector that genuinely talks to nothing.
   */
  requiredCredentials: string[];
  /** The carrier's raw code -> our status. The suite feeds it garbage. */
  normalizeStatus(rawCode: string): ShipmentStatus;
  /** Canned carrier answers. Omit only if the connector makes no HTTP calls. */
  respond?: CarrierResponder;
  capabilities?: ConformanceCapabilities;
}

// --- test doubles -----------------------------------------------------------

/**
 * Subclassed rather than hand-rolled, so `json()` and `soap()` are inherited: a
 * connector speaking either dialect is recorded without the double having to
 * reimplement JSON parsing or SOAP envelope headers.
 */
class RecordingHttpClient extends CarrierHttpClient {
  readonly calls: RecordedRequest[] = [];

  constructor(private readonly responder?: CarrierResponder) {
    super();
  }

  async request(url: string, options: CarrierRequestOptions = {}): Promise<string> {
    const call: RecordedRequest = {
      url,
      method: String(options.method ?? 'GET').toUpperCase(),
      headers: options.headers ?? {},
      body: options.body,
    };
    this.calls.push(call);

    if (!this.responder) {
      throw new Error(
        `Uygunluk paketi: ${call.method} ${url} çağrıldı ama subject.respond tanımlı değil.`,
      );
    }
    return this.responder(call);
  }

  /** Everything the connector put on the wire, as one searchable blob. */
  outbound(): string {
    return this.calls
      .map((c) => `${c.method} ${c.url} ${JSON.stringify(c.headers)} ${c.body ?? ''}`)
      .join('\n');
  }
}

class RecordingRateLimiter extends CarrierRateLimiter {
  readonly keys: string[] = [];
  delayMs = 0;

  async throttle(key: string): Promise<void> {
    this.keys.push(key);
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }
}

// --- fixtures ---------------------------------------------------------------

/** Distinctive on purpose: the masking clause greps captured logs for these. */
export const CONFORMANCE_PII = {
  phone: '+905551112233',
  email: 'alici.fixture@example.com',
  line1: 'Fixture Mahallesi 42/7 Daire 9',
};

const RECIPIENT: CarrierAddress = {
  fullName: 'Fixture Alıcı',
  phone: CONFORMANCE_PII.phone,
  email: CONFORMANCE_PII.email,
  line1: CONFORMANCE_PII.line1,
  district: 'Kadıköy',
  city: 'İstanbul',
  postalCode: '34710',
  countryCode: 'TR',
};

const SENDER: CarrierAddress = {
  fullName: 'Fixture Depo',
  phone: '+902165550000',
  line1: 'Depo Caddesi 1',
  district: 'Tuzla',
  city: 'İstanbul',
  countryCode: 'TR',
};

/**
 * Deliberately wrong: a 10x10x10 / 1kg parcel is 0.33 desi at 3000. A connector
 * that recomputes lands on 0.33 and loses this number, which is the whole point
 * — the tenant's divisor lives in DesiCalculator, not in fourteen connectors
 * that each guessed 3000.
 */
const WRONG_DESI = 999.5;

const PARCEL: Parcel = {
  weightKg: 1,
  lengthCm: 10,
  widthCm: 10,
  heightCm: 10,
  desi: WRONG_DESI,
  chargeableWeightKg: WRONG_DESI,
  contentDescription: 'Fixture',
};

export function conformanceShipmentRequest(
  overrides: Partial<CreateShipmentRequest> = {},
): CreateShipmentRequest {
  return {
    orderId: 'conformance-order-1',
    orderNumber: 'CONF-1',
    sender: SENDER,
    recipient: RECIPIENT,
    parcels: [PARCEL],
    desiDivisor: 3000,
    paymentType: 'sender_pays',
    referenceCode: 'conformance-ref-1',
    ...overrides,
  };
}

/** Codes no carrier publishes. Nothing may map these to a terminal status. */
const UNKNOWN_CODES = ['', 'ZZZ_NOT_A_CODE', '9999', 'null', 'DELIVERED_MAYBE'];

// --- log capture ------------------------------------------------------------

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Both surfaces, because connectors use both: console while being written, the
 * Nest logger once wired into a module. A leak through either lands in the same
 * aggregated log file.
 */
function captureLogs(): { lines: () => string; restore: () => void } {
  const collected: string[] = [];
  const push = (...args: unknown[]) =>
    collected.push(args.map((a) => (typeof a === 'string' ? a : safeJson(a))).join(' '));

  const undo: Array<() => void> = [];

  for (const key of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[key];
    undo.push(() => ((console as any)[key] = original));
    (console as any)[key] = push;
  }
  for (const key of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    const original = (Logger.prototype as any)[key];
    undo.push(() => ((Logger.prototype as any)[key] = original));
    (Logger.prototype as any)[key] = push;
  }

  return {
    lines: () => collected.join('\n'),
    restore: () => undo.forEach((fn) => fn()),
  };
}

// --- the suite --------------------------------------------------------------

export function describeCarrierConformance(subject: ConformanceSubject): void {
  const caps = subject.capabilities ?? {};
  const batchTracking = caps.batchTracking !== false;

  const build = (over: { credentials?: Record<string, any>; isTestMode?: boolean } = {}) => {
    const http = new RecordingHttpClient(subject.respond);
    const limiter = new RecordingRateLimiter();
    const connector = subject.create({
      credentials: over.credentials ?? subject.credentials,
      httpClient: http,
      rateLimiter: limiter,
      isTestMode: over.isTestMode ?? true,
    });
    return { connector, http, limiter };
  };

  describe(`${subject.provider} carrier conformance`, () => {
    it('carries the desi it was handed instead of recomputing it', async () => {
      const { connector, http } = build();
      const result = await connector.createShipment(conformanceShipmentRequest());

      // The wire is the real evidence. A connector that makes no calls (a
      // simulation) can only be judged by what it echoed back.
      const haystack = http.calls.length > 0 ? http.outbound() : safeJson(result.raw);

      expect(haystack).toMatch(/999[.,]5/);
      expect(haystack).not.toMatch(/\b0[.,]33\b/);
    });

    it('maps an unknown carrier code to in_transit, never to a terminal status', () => {
      for (const code of UNKNOWN_CODES) {
        expect(subject.normalizeStatus(code)).toBe('in_transit');
      }
    });

    it('keeps the carrier code beside the status, not inside it', async () => {
      const { connector } = build();
      const [result] = await connector.track(['CONF-TRK-1']);

      expect(result.trackingNumber).toBe('CONF-TRK-1');
      expect(result.status).not.toBe(result.carrierStatusCode);
    });

    (batchTracking ? it : it.skip)('tracks N numbers in one request', async () => {
      const { connector, http } = build();
      const numbers = ['CONF-1', 'CONF-2', 'CONF-3', 'CONF-4'];

      const results = await connector.track(numbers);

      expect(results).toHaveLength(numbers.length);
      expect(http.calls.length).toBeLessThanOrEqual(1);
    });

    it('gives every tracking event its own carrier code', async () => {
      const { connector } = build();
      const [result] = await connector.track(['CONF-TRK-1']);

      expect(result.events.length).toBeGreaterThan(0);
      for (const event of result.events) {
        expect(String(event.carrierStatusCode ?? '').trim()).not.toBe('');
      }

      // One event legitimately matches the shipment-level code. Several events
      // all carrying it means the mapper stamped the shipment code onto the
      // history: the stored events collapse onto one unique key and the whole
      // poll becomes a single row.
      if (result.events.length > 1) {
        expect(new Set(result.events.map((e) => e.carrierStatusCode)).size).toBeGreaterThan(1);
      }
    });

    it('reports a refused cancellation as a result, not an exception', async () => {
      const http = new RecordingHttpClient(() => {
        throw new CarrierHttpError(
          'conformance: iptal reddedildi',
          HttpStatus.BAD_GATEWAY,
          400,
          '{}',
        );
      });
      const connector = subject.create({
        credentials: subject.credentials,
        httpClient: http,
        rateLimiter: new RecordingRateLimiter(),
        isTestMode: true,
      });

      const result = await connector.cancelShipment('CONF-TRK-1');

      expect(result).toBeDefined();
      // A carrier that answered "no" must be reported as no. A connector that
      // never asked (simulation) may answer for itself.
      if (http.calls.length > 0) expect(result.success).toBe(false);
    });

    (subject.requiredCredentials.length > 0 ? it : it.skip)(
      'refuses a missing credential with BadRequestException before any call',
      async () => {
        const { connector, http } = build({ credentials: {} });

        await expect(connector.createShipment(conformanceShipmentRequest())).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(http.calls).toHaveLength(0);
      },
    );

    it('waits on the rate limiter instead of throwing past the limit', async () => {
      const { connector, limiter } = build();
      limiter.delayMs = 25;

      const startedAt = Date.now();
      await connector.createShipment(conformanceShipmentRequest());
      const elapsed = Date.now() - startedAt;

      expect(limiter.keys.length).toBeGreaterThan(0);
      // Proves the throttle was awaited. `this.throttle()` without `await` is
      // the bug this catches: the bucket fills, nothing ever waits, carrier 429s.
      expect(elapsed).toBeGreaterThanOrEqual(20);
    });

    (caps.simulationOnly ? it : it.skip)('refuses to run outside test mode', async () => {
      const { connector } = build({ isTestMode: false });

      await expect(connector.createShipment(conformanceShipmentRequest())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(connector.track(['CONF-TRK-1'])).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect((await connector.testConnection()).success).toBe(false);
    });

    it('masks recipient PII on everything it logs', async () => {
      const capture = captureLogs();
      let haystack: string;
      try {
        const { connector } = build();
        const created = await connector.createShipment(conformanceShipmentRequest());
        const tracked = await connector.track(['CONF-TRK-1']);
        // `raw` is documented as going to IntegrationLog, so it is a log line
        // that has not been written yet.
        haystack = [capture.lines(), safeJson(created.raw), safeJson(tracked)].join('\n');
      } finally {
        capture.restore();
      }

      expect(haystack).not.toContain(CONFORMANCE_PII.phone);
      expect(haystack).not.toContain(CONFORMANCE_PII.email);
      expect(haystack).not.toContain(CONFORMANCE_PII.line1);
    });

    describe('declared optional capabilities match the implementation', () => {
      for (const name of ['getRates', 'createReturn', 'findByReference'] as const) {
        it(`${name}: ${caps[name] ? 'implemented' : 'absent'}`, () => {
          const { connector } = build();
          expect(typeof (connector as any)[name] === 'function').toBe(Boolean(caps[name]));
        });
      }

      (caps.findByReference ? it : it.skip)(
        'findByReference answers null for an unknown reference instead of inventing one',
        async () => {
          const { connector } = build();
          await expect(connector.findByReference!('conformance-never-created')).resolves.toBeNull();
        },
      );
    });
  });
}
