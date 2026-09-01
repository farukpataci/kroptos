import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeChronopostStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toUpperCase().trim();

  switch (code) {
    case 'D':
    case 'DELIVERED':
    case 'DEL':
      return 'delivered';
    case 'E':
    case 'OUT_FOR_DELIVERY':
    case 'OFD':
      return 'out_for_delivery';
    case 'PC':
    case 'COLLECTED':
    case 'COL':
    case 'PCH':
      return 'handed_over';
    case 'TA':
    case 'DC':
    case 'TS':
    case 'IN_TRANSIT':
    case 'SORTED':
      return 'in_transit';
    case 'PRE':
    case 'ANNOUNCED':
    case 'CREATED':
      return 'created';
    case 'RB':
    case 'RTO':
    case 'RETURNED':
      return 'returned';
    case 'AN':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
