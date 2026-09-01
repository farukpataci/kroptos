import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizePostnlStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toUpperCase().trim();

  switch (code) {
    case '07':
    case '7':
    case '08':
    case '11':
    case 'DELIVERED':
      return 'delivered';
    case '05':
    case '5':
    case '06':
    case 'OUT_FOR_DELIVERY':
      return 'out_for_delivery';
    case '02':
    case '2':
    case 'COLLECTED':
      return 'handed_over';
    case '03':
    case '3':
    case '04':
    case 'IN_TRANSIT':
    case 'SORTING':
      return 'in_transit';
    case '01':
    case '1':
    case 'PRE_NOTIFIED':
    case 'ANNOUNCED':
      return 'created';
    case '09':
    case '10':
    case 'RETURNED':
      return 'returned';
    case '99':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
