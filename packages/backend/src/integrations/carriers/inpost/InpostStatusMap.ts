import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeInpostStatus(typeCode: string | undefined): ShipmentStatus {
  if (!typeCode) return 'in_transit';

  const code = typeCode.toLowerCase().trim();

  switch (code) {
    case 'delivered':
      return 'delivered';
    case 'ready_for_pickup':
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'dispatched_by_sender':
    case 'collected_from_sender':
    case 'taken_by_courier':
      return 'handed_over';
    case 'adopted_at_source_hub':
    case 'adopted_at_sorting_center':
    case 'sent_from_source_hub':
    case 'in_transit':
      return 'in_transit';
    case 'created':
    case 'confirmed':
    case 'offers_prepared':
      return 'created';
    case 'returned_to_sender':
    case 'avizo':
      return 'returned';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'in_transit';
  }
}
