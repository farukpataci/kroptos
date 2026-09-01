import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizePacketaStatus(typeCode: string | number | undefined): ShipmentStatus {
  if (typeCode === undefined || typeCode === null) return 'in_transit';

  const code = String(typeCode).toUpperCase().trim();

  switch (code) {
    case '6':
    case 'DELIVERED':
    case 'DEL':
      return 'delivered';
    case '5':
    case 'READY_FOR_PICKUP':
    case 'OFD':
    case 'PICKUP':
      return 'out_for_delivery';
    case '2':
    case 'SUBMITTED':
    case 'PCH':
    case 'COLLECTED':
      return 'handed_over';
    case '3':
    case '4':
    case 'ARRIVED_AT_HUB':
    case 'IN_TRANSIT':
    case 'SORTED':
    case 'HUB':
      return 'in_transit';
    case '1':
    case 'RECEIVED_DATA':
    case 'CREATED':
    case 'ANNOUNCED':
      return 'created';
    case '7':
    case 'RETURNED':
    case 'RTS':
      return 'returned';
    case '8':
    case 'CANCELLED':
    case 'CAN':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
