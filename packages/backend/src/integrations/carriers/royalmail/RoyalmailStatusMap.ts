import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeRoyalmailStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toLowerCase().trim();

  switch (code) {
    case 'delivered':
      return 'delivered';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'despatched':
    case 'dispatched':
    case 'collected':
    case 'manifested':
      return 'handed_over';
    case 'in_transit':
    case 'sorted':
      return 'in_transit';
    case 'new':
    case 'created':
    case 'open':
      return 'created';
    case 'returned':
    case 'failed':
      return 'returned';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
