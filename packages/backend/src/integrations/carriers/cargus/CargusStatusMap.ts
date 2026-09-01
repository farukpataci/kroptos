import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeCargusStatus(typeCode: string | number | undefined): ShipmentStatus {
  if (typeCode === undefined || typeCode === null) return 'in_transit';

  const code = String(typeCode).toUpperCase().trim();

  switch (code) {
    case '5':
    case 'DELIVERED':
    case 'DEL':
      return 'delivered';
    case '4':
    case 'OUT_FOR_DELIVERY':
    case 'OFD':
      return 'out_for_delivery';
    case '1':
    case 'COLLECTED':
    case 'PICKED_UP':
    case 'PCH':
      return 'handed_over';
    case '2':
    case '3':
    case 'IN_TRANSIT':
    case 'IN_DEPOT':
    case 'HUB':
      return 'in_transit';
    case '0':
    case 'PREPARED':
    case 'CREATED':
    case 'ANNOUNCED':
      return 'created';
    case '6':
    case 'RETURNED':
    case 'RTS':
      return 'returned';
    case '7':
    case 'CANCELLED':
    case 'CAN':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
