import { ShipmentStatus } from '../core/CarrierTypes';

/**
 * Yurtiçi Kargo status code dictionary.
 *
 * CRITICAL RULE: Unrecognized or missing status codes MUST fall back to 'in_transit',
 * NEVER to a terminal status ('delivered', 'returned', 'cancelled', 'lost').
 * Falling back to a terminal status stops polling and closes the order permanently.
 */
export const YURTICI_STATUS_MAP: Record<string, ShipmentStatus> = {
  // Known official Yurtiçi operation codes can be mapped here as verified:
  // '1': 'created',
  // '2': 'handed_over',
  // '3': 'in_transit',
  // '4': 'out_for_delivery',
  // '5': 'delivered',
};

/**
 * Normalizes a raw Yurtiçi Kargo status code into KroptOS ShipmentStatus.
 * Returns 'in_transit' for any unknown or empty raw status code.
 */
export function normalizeYurticiStatus(rawCode?: string): ShipmentStatus {
  if (!rawCode) return 'in_transit';
  const trimmed = rawCode.trim();
  return YURTICI_STATUS_MAP[trimmed] ?? 'in_transit';
}
