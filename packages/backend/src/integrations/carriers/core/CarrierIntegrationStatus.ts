import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * How far a carrier integration actually is, and how sure we are of each claim.
 *
 * Written down because "we built a connector" and "the carrier answers it" are
 * different facts that look identical in a code review. Every field a connector
 * declares carries one of these, so a reader can tell a measured value from a
 * value someone read in a PDF from a value nobody has ever checked.
 */

/** Whether a capability works at all, and if not, what is blocking it. */
export const CARRIER_SUPPORT_STATUSES = [
  /** Implemented and exercised against something real. */
  'SUPPORTED',
  /** The carrier does not offer it. Not a gap on our side. */
  'UNSUPPORTED',
  /** Nobody has established either way. */
  'UNKNOWN',
  /** We would implement it; the carrier's documentation is missing. */
  'DOCUMENTATION_REQUIRED',
  /** Documented, but gated behind a signed commercial agreement. */
  'CONTRACT_REQUIRED',
] as const;
export type CarrierSupportStatus = (typeof CARRIER_SUPPORT_STATUSES)[number];

/**
 * The confidence attached to one stated fact — an endpoint, a field name, a
 * status code, a required flag.
 *
 * There is deliberately no VERIFIED, LIVE or PRODUCTION_READY value here. Those
 * belong to a later step and adding them now would let a pre-integration mark
 * itself finished.
 */
export const CARRIER_VERIFICATION_STATUSES = [
  /** Stated somewhere, confirmed nowhere. The default for a pre-integration. */
  'UNVERIFIED',
  /** Blocked on the carrier's official integration documentation. */
  'DOCUMENTATION_REQUIRED',
  /** Blocked on real credentials for a carrier account. */
  'CREDENTIAL_REQUIRED',
  /** Documented and coded; waiting on a run against the carrier's test env. */
  'TEST_REQUIRED',
  /** No claim has been made at all. */
  'UNKNOWN',
  /** Established that the carrier does not provide it. */
  'NOT_SUPPORTED',
] as const;
export type CarrierVerificationStatus = (typeof CARRIER_VERIFICATION_STATUSES)[number];

/**
 * Overall readiness of one provider module. Ordered from least to most ready;
 * nothing above MOCK_READY may be set without evidence in the provider README.
 */
export const CARRIER_INTEGRATION_STATUSES = [
  'NOT_STARTED',
  /** Skeleton, mappers and a mock client exist. No upstream call is possible. */
  'MOCK_READY',
  /** Runs against the carrier's own test environment. */
  'TEST_READY',
  /** Runs in production for at least one tenant. */
  'PRODUCTION_READY',
] as const;
export type CarrierIntegrationStatus = (typeof CARRIER_INTEGRATION_STATUSES)[number];

/** Which client a connection talks to. Not the same as `isTestMode`. */
export const CARRIER_ENVIRONMENTS = ['MOCK', 'TEST', 'PRODUCTION'] as const;
export type CarrierEnvironment = (typeof CARRIER_ENVIRONMENTS)[number];

export function isCarrierEnvironment(value: unknown): value is CarrierEnvironment {
  return typeof value === 'string' && (CARRIER_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Thrown when something asks a connector to do work its provider has not been
 * verified for — a TEST or PRODUCTION client with no confirmed endpoint, or a
 * capability whose support status is not SUPPORTED.
 *
 * 503 rather than 500: nothing is broken, the integration is simply not
 * finished, and the operator's next step is to supply documentation or
 * credentials rather than to file a bug.
 */
export class IntegrationNotVerifiedError extends HttpException {
  constructor(
    readonly provider: string,
    readonly operation: string,
    readonly verificationStatus: CarrierVerificationStatus,
    message?: string,
  ) {
    super(
      message ??
        `${provider} entegrasyonu '${operation}' için doğrulanmadı (${verificationStatus}). ` +
          `Bu bağlantı yalnızca MOCK ortamında çalışır; canlı çağrı yapılmadı.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
