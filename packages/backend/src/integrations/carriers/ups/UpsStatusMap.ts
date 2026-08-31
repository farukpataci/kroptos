import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeUpsStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toUpperCase().trim();

  switch (code) {
    case 'D':
      return 'delivered';
    case 'P':
      return 'handed_over';
    case 'O':
      return 'out_for_delivery';
    case 'I':
      return 'in_transit';
    case 'X':
      return 'undelivered';
    case 'M':
      return 'created';
    case 'V':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
