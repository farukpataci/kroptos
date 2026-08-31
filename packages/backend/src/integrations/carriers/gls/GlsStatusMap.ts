import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeGlsStatus(carrierStatusCode: string): ShipmentStatus {
  const code = (carrierStatusCode || '').trim().toUpperCase();

  switch (code) {
    case 'CREATED':
    case 'REGISTERED':
    case '10':
      return 'created';

    case 'LABEL_CREATED':
    case 'LABEL_PRINTED':
    case '15':
      return 'label_ready';

    case 'PRE_NOTIFIED':
    case 'PICKED_UP':
    case 'RECEIVED_AT_HUB':
    case 'HANDED_OVER':
    case 'DEPOSIT':
    case '20':
      return 'handed_over';

    case 'IN_TRANSIT':
    case 'HUB_SCAN':
    case 'LINEHAUL':
    case 'DEPARTED':
    case '30':
      return 'in_transit';

    case 'OUT_FOR_DELIVERY':
    case 'IN_DELIVERY':
    case 'OUT_FOR_DELIV':
    case 'WITH_DRIVER':
    case '40':
      return 'out_for_delivery';

    case 'DELIVERED':
    case 'POD':
    case 'DELIVERY_OK':
    case 'DELIVERED_HUB':
    case '50':
      return 'delivered';

    case 'UNDELIVERED':
    case 'NOT_DELIVERED':
    case 'FAILED_ATTEMPT':
    case 'ADDRESS_ERROR':
    case '60':
      return 'undelivered';

    case 'RETURNING':
    case 'RETURN_IN_TRANSIT':
    case '70':
      return 'returning';

    case 'RETURNED':
    case 'RETURN_DELIVERED':
    case '80':
      return 'returned';

    case 'CANCELLED':
    case 'DELETED':
    case 'ORDER_CANCELLED':
    case '90':
      return 'cancelled';

    case 'LOST':
    case 'DAMAGED':
    case '99':
      return 'lost';

    default:
      // Unknown codes default safely to in_transit
      return 'in_transit';
  }
}
