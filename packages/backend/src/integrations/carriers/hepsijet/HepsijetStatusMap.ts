import { ShipmentStatus } from '../core/CarrierTypes';

/**
 * HepsiJET status code dictionary.
 *
 * CRITICAL RULE: Unrecognized or missing status codes MUST fall back to 'in_transit',
 * NEVER to a terminal status ('delivered', 'returned', 'cancelled', 'lost').
 * Falling back to a terminal status stops polling and closes the order permanently.
 */
export const HEPSIJET_STATUS_MAP: Record<string, ShipmentStatus> = {
  // Known official status codes can be registered here once verified against HepsiJET docs.
  // Example entries:
  // 'CREATED': 'created',
  // 'IN_TRANSIT': 'in_transit',
  // 'DELIVERED': 'delivered',
};

/**
 * Normalizes a raw HepsiJET status code into KroptOS ShipmentStatus.
 * Returns 'in_transit' for any unknown or empty raw status code.
 */
export function normalizeHepsijetStatus(rawCode?: string): ShipmentStatus {
  if (!rawCode) return 'in_transit';
  const trimmed = rawCode.trim();
  return HEPSIJET_STATUS_MAP[trimmed] ?? 'in_transit';
}
