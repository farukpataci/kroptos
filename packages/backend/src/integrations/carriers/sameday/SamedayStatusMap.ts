import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeSamedayStatus(typeCode: string | number | undefined): ShipmentStatus {
  if (typeCode === undefined || typeCode === null) return 'in_transit';

  const code = String(typeCode).toUpperCase().trim();

  switch (code) {
    case '4':
    case 'DELIVERED':
    case 'DEL':
      return 'delivered';
    case '3':
    case 'OUT_FOR_DELIVERY':
    case 'OFD':
    case 'EASYBOX_DROPOFF':
      return 'out_for_delivery';
    case '1':
    case 'PICKUP':
    case 'PCH':
    case 'COLLECTED':
      return 'handed_over';
    case '2':
    case 'IN_TRANSIT':
    case 'SORTED':
    case 'HUB':
      return 'in_transit';
    case '0':
    case 'CREATED':
    case 'ANNOUNCED':
      return 'created';
    case '5':
    case 'RETURNED':
    case 'RTS':
      return 'returned';
    case '6':
    case 'CANCELLED':
    case 'CAN':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
