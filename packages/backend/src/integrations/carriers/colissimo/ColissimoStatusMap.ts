import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeColissimoStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toUpperCase().trim();

  switch (code) {
    case 'LIV':
    case 'DELIVERED':
    case 'DEL':
      return 'delivered';
    case 'PC1':
    case 'PC2':
    case 'DR1':
    case 'DR2':
    case 'OUT_FOR_DELIVERY':
      return 'out_for_delivery';
    case 'PCH':
    case 'COLLECTED':
    case 'COL':
    case 'DEPOT_RECEIPT':
      return 'handed_over';
    case 'IN_TRANSIT':
    case 'SORTED':
    case 'HUB_SCAN':
    case 'EXP':
      return 'in_transit';
    case 'PRE':
    case 'ANNOUNCED':
    case 'CREATED':
      return 'created';
    case 'RTO':
    case 'RETURNED':
    case 'RETOUR':
      return 'returned';
    case 'ANN':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
