import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeFanCourierStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toUpperCase().trim();

  switch (code) {
    case 'S9':
    case 'DELIVERED':
    case 'DEL':
      return 'delivered';
    case 'S4':
    case 'OUT_FOR_DELIVERY':
    case 'OFD':
      return 'out_for_delivery';
    case 'S2':
    case 'PICKED_UP':
    case 'PCH':
    case 'COLLECTED':
      return 'handed_over';
    case 'S3':
    case 'IN_TRANSIT':
    case 'SORTED':
    case 'HUB':
      return 'in_transit';
    case 'S1':
    case 'PREPARED':
    case 'CREATED':
    case 'ANNOUNCED':
      return 'created';
    case 'S10':
    case 'RETURNED':
    case 'RTS':
      return 'returned';
    case 'S99':
    case 'CANCELLED':
    case 'CAN':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
