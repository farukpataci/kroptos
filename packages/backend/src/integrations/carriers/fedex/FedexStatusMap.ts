import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeFedexStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toUpperCase().trim();

  switch (code) {
    case 'DL':
      return 'delivered';
    case 'PU':
      return 'handed_over';
    case 'OD':
      return 'out_for_delivery';
    case 'IT':
    case 'AR':
    case 'DP':
      return 'in_transit';
    case 'OC':
      return 'created';
    case 'CA':
      return 'cancelled';
    case 'DE':
    case 'SE':
      return 'undelivered';
    default:
      return 'in_transit';
  }
}
