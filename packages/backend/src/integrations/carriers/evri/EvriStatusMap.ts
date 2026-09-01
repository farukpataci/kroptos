import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeEvriStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toUpperCase().trim();

  switch (code) {
    case 'DELIVERED':
    case 'DEL':
      return 'delivered';
    case 'OUT_FOR_DELIVERY':
    case 'OFD':
    case 'PARCELSHOP_DROPOFF':
      return 'out_for_delivery';
    case 'COLLECTED':
    case 'COL':
    case 'HUB_SCAN':
      return 'handed_over';
    case 'IN_TRANSIT':
    case 'SORTED':
    case 'DEPOT_RECEIPT':
      return 'in_transit';
    case 'CREATED':
    case 'ANNOUNCED':
      return 'created';
    case 'RETURNED':
    case 'RTS':
    case 'AVIZO':
      return 'returned';
    case 'CANCELLED':
    case 'CAN':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
