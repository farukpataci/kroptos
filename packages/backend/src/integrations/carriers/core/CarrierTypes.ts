/**
 * Unified carrier vocabulary. Every connector translates its provider's own
 * spelling into these types; nothing below this line may leak a carrier's raw
 * status code into a column the UI reads.
 */

export const CARRIER_PROVIDERS = [
  'YURTICI',
  'MNG',
  'ARAS',
  'SURAT',
  'PTT',
  'UPS',
  'DHL',
  'TRENDYOL_EXPRESS',
  'HEPSIJET',
  'SENDEO',
  'KOLAY_GELSIN',
  'GELIVER',
  'NAVLUNGO',
  'KARGOIST',
  /** No upstream API: sample data for development and for the WMS flow. */
  'MOCK',
] as const;

export type CarrierProvider = (typeof CARRIER_PROVIDERS)[number];

export const LABEL_FORMATS = ['PDF', 'ZPL', 'PNG', 'HTML'] as const;
export type LabelFormat = (typeof LABEL_FORMATS)[number];

/**
 * The only values `Shipment.status` may hold. A carrier's own code lives in
 * `carrierStatusCode`, never here — status filters and automation read this
 * column and a raw provider code silently breaks both.
 */
export const SHIPMENT_STATUSES = [
  'created',
  'label_ready',
  'handed_over',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'undelivered',
  'returning',
  'returned',
  'cancelled',
  'lost',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/**
 * Runtime gate for the one column automation reads.
 *
 * The union above is a compile-time promise, and a mapper breaks it with a
 * single `as any` or an untyped JSON field. This is what actually keeps a
 * carrier's raw code out of `Shipment.status` — and, more to the point, keeps
 * an unrecognised code from being written to a terminal state like
 * 'delivered', which stops tracking and closes the order.
 */
export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return typeof value === 'string' && (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

/** Statuses that never change again, so tracking may stop polling them. */
export const TERMINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'delivered',
  'returned',
  'cancelled',
  'lost',
];

/**
 * What the scheduled sweep asks the carrier about: the parcel is with them and
 * still moving.
 *
 * Not the complement of TERMINAL — `created` and `label_ready` are left out on
 * purpose. Those parcels are still on our side of the counter, so the carrier
 * has nothing to report yet, and asking about a barcode that was never handed
 * over spends quota on a "not found" every half hour.
 *
 * `undelivered` and `returning` ARE in, and that is the return leg: the chain
 * undelivered -> returning -> returned runs entirely through these two. Leaving
 * them out froze a failed delivery at "undelivered" and nobody saw the parcel
 * come back to the warehouse.
 */
export const POLLABLE_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'handed_over',
  'in_transit',
  'out_for_delivery',
  'undelivered',
  'returning',
];

/**
 * The two states an operator has to chase by hand. Neither is an error the code
 * can resolve on its own, and both are invisible unless something asks for them
 * — which is why they are named here rather than left as an ad-hoc where clause
 * inside one report.
 *
 * `stuck_claim`           the row reserved a reference code and never came back
 *                         with a barcode. The carrier call may still have
 *                         bought one, so it is not cleaned up automatically.
 * `carrier_cancel_failed` we cancelled, the carrier did not. The barcode is
 *                         live at the carrier and will be invoiced.
 */
export const SHIPMENT_PROBLEMS = ['stuck_claim', 'carrier_cancel_failed'] as const;
export type ShipmentProblem = (typeof SHIPMENT_PROBLEMS)[number];

/**
 * How long a claim may sit without a barcode before it counts as stuck. Long
 * enough that a slow carrier call is not flagged, short enough that a packing
 * station notices within a shift.
 */
export const STUCK_CLAIM_MINUTES = 15;

export const PAYMENT_TYPES = ['sender_pays', 'recipient_pays', 'cod'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const SERVICE_LEVELS = ['standard', 'express', 'same_day', 'freight'] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

/** Raw measurements as they arrive from the caller — nothing derived yet. */
export interface ParcelInput {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  contentDescription?: string;
}

/**
 * What a connector actually receives. `desi` and `chargeableWeightKg` are
 * required, which is the point: a connector cannot recompute them, so it cannot
 * assume the 3000 divisor for a tenant billed at 5000. DesiCalculator fills
 * them once, before the request leaves the service.
 */
export interface Parcel extends ParcelInput {
  desi: number;
  chargeableWeightKg: number;
}

export interface CarrierAddress {
  fullName: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  /** ilçe */
  district: string;
  /** il */
  city: string;
  postalCode?: string;
  /** ISO-3166-1 alpha-2, 'TR' by default. */
  countryCode: string;
  /** Corporate / customs identifier. */
  taxId?: string;
}

export interface CreateShipmentRequest {
  orderId: string;
  orderNumber: string;
  sender: CarrierAddress;
  recipient: CarrierAddress;
  parcels: Parcel[];
  /**
   * The tenant's divisor, carried even though the parcels arrive measured:
   * carriers that reprice on their own side have to be told which tariff the
   * figures came from.
   */
  desiDivisor: number;
  paymentType: PaymentType;
  codAmount?: number;
  codCurrency?: string;
  serviceLevel?: ServiceLevel;
  isReturn?: boolean;
  /** Idempotency key on the Kroptos side. */
  referenceCode?: string;
  notes?: string;
}

export interface CarrierShipmentResult {
  trackingNumber: string;
  barcode?: string;
  carrierShipmentId?: string;
  labelUrl?: string;
  /** Raw upstream answer — masked before it reaches IntegrationLog. */
  raw?: unknown;
}

export interface CarrierLabel {
  format: LabelFormat;
  /** Base64 for binary formats (PDF/PNG), plain text for ZPL/HTML. */
  content: string;
  /** Set when the carrier hosts the label instead of returning bytes. */
  url?: string;
}

export interface CarrierTrackingEvent {
  at: Date;
  status: ShipmentStatus;
  /**
   * Per event, not per shipment. The stored event's unique key is built from
   * this, so copying the shipment-level code onto every event would collapse a
   * whole poll into one row and silently drop the rest.
   */
  carrierStatusCode: string;
  description: string;
  location?: string;
}

export interface CarrierTrackingResult {
  trackingNumber: string;
  /** Always normalised — never the carrier's own code. */
  status: ShipmentStatus;
  /** The carrier's own code, kept for support and for mapper regressions. */
  carrierStatusCode?: string;
  events: CarrierTrackingEvent[];
  deliveredAt?: Date;
  recipientName?: string;
}

export interface CancelResult {
  success: boolean;
  message?: string;
}

export interface RateQuoteRequest {
  sender: CarrierAddress;
  recipient: CarrierAddress;
  parcels: Parcel[];
  /** Same contract as CreateShipmentRequest: quote on the tenant's own tariff. */
  desiDivisor: number;
  paymentType?: PaymentType;
  /** Quoting standard for a parcel that ships express prices the wrong service. */
  serviceLevel?: ServiceLevel;
  codAmount?: number;
}

export interface RateQuote {
  provider: CarrierProvider;
  /** Which carrier an aggregator would actually hand the parcel to. */
  subCarrier?: string;
  serviceLevel: ServiceLevel;
  amount: number;
  currency: string;
  estimatedDeliveryDays?: number;
}

export interface CreateReturnRequest extends CreateShipmentRequest {
  /** Forward shipment this return belongs to, when the carrier links them. */
  originalTrackingNumber?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  durationMs: number;
}
