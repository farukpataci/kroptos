/** Shared between the list and the drawer so the two cannot drift apart. */

/** Mirrors ShipmentService.toListItem — only the fields the UI renders. */
export interface Shipment {
  id: string;
  publicId: string;
  provider: string;
  status: string;
  trackingNumber: string | null;
  barcode: string | null;
  referenceCode: string | null;
  paymentType: string | null;
  codAmount: number | null;
  codCurrency: string | null;
  totalDesi: number | null;
  totalWeightKg: number | null;
  carrierCancelError: string | null;
  createdAt: string;
}

/** SHIPMENT_STATUSES from the backend's CarrierTypes, in the same order. */
export const STATUSES = [
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
];

/**
 * Only the states someone has to act on get a colour; anything still moving
 * stays neutral, so a coloured row in the list means work, not traffic.
 */
export function badgeType(status: string) {
  if (status === 'delivered') return 'active';
  if (status === 'undelivered' || status === 'lost' || status === 'cancelled') return 'error';
  if (status === 'returning' || status === 'returned') return 'warning';
  return 'syncing';
}
