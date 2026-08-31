import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeDpdStatus(carrierStatusCode: string): ShipmentStatus {
  const code = (carrierStatusCode || '').trim().toUpperCase();

  switch (code) {
    case 'CREATED':
    case 'ORDER_REGISTERED':
    case 'MANIFESTED':
    case '10':
      return 'created';

    case 'LABEL_CREATED':
    case 'LABEL_PRINTED':
    case '15':
      return 'label_ready';

    case 'PICKED_UP':
    case 'RECEIVED_AT_HUB':
    case 'COLLECTED':
    case '20':
      return 'handed_over';

    case 'IN_TRANSIT':
    case 'HUB_SCAN':
    case 'DEPOT_SCAN':
    case 'SORTING':
    case '30':
      return 'in_transit';

    case 'OUT_FOR_DELIVERY':
    case 'WITH_DELIVERY_DRIVER':
    case '40':
      return 'out_for_delivery';

    case 'DELIVERED':
    case 'DELIVERY_SUCCESSFUL':
    case 'DELIVERED_TO_PARCELSHOP':
    case '50':
      return 'delivered';

    case 'UNDELIVERED':
    case 'ADDRESS_NOT_FOUND':
    case 'RECIPIENT_ABSENT':
    case '60':
      return 'undelivered';

    case 'RETURNING':
    case 'RETURN_IN_TRANSIT':
    case '70':
      return 'returning';

    case 'RETURNED':
    case 'RETURNED_TO_SENDER':
    case '80':
      return 'returned';

    case 'CANCELLED':
    case 'ORDER_CANCELLED':
    case '90':
      return 'cancelled';

    case 'LOST':
    case 'DAMAGED':
    case '99':
      return 'lost';

    default:
      // Never map an unknown status code to a terminal state like 'delivered' or 'returned'
      return 'in_transit';
  }
}
