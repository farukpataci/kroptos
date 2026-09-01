import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizePocztexStatus(typeCode: string | number | undefined): ShipmentStatus {
  if (typeCode === undefined || typeCode === null) return 'in_transit';

  const code = String(typeCode).toUpperCase().trim();

  switch (code) {
    case '5':
    case 'DELIVERED':
    case 'DEL':
    case 'DORECZENIE':
      return 'delivered';
    case '3':
    case '4':
    case 'OUT_FOR_DELIVERY':
    case 'OFD':
    case 'AWIZO':
    case 'READY_FOR_PICKUP':
      return 'out_for_delivery';
    case '1':
    case 'POSTED':
    case 'PCH':
    case 'NADAWCA':
      return 'handed_over';
    case '2':
    case 'IN_TRANSIT':
    case 'SORTED':
    case 'HUB':
    case 'PRZETWARZANIE':
      return 'in_transit';
    case '0':
    case 'CREATED':
    case 'ANNOUNCED':
    case 'REJESTRACJA':
      return 'created';
    case '6':
    case 'RETURNED':
    case 'RTS':
    case 'ZWROT':
      return 'returned';
    case '7':
    case 'CANCELLED':
    case 'CAN':
    case 'ANULOWANO':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
