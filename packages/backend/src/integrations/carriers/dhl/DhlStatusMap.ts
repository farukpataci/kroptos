import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeDhlStatus(carrierStatusCode: string): ShipmentStatus {
  const code = (carrierStatusCode || '').trim().toUpperCase();

  switch (code) {
    case 'PRE-TRANSIT':
    case 'CREATED':
    case 'SUBMITTED':
    case 'SHIPMENT_CREATED':
      return 'created';

    case 'LABEL_READY':
    case 'DOCUMENT_READY':
    case 'PU':
      return 'label_ready';

    case 'PICKED_UP':
    case 'HANDED_OVER':
    case 'RECEIVED':
    case 'PL':
      return 'handed_over';

    case 'TRANSIT':
    case 'IN_TRANSIT':
    case 'DEPARTED':
    case 'ARRIVED':
    case 'TRANSIT_HUB':
    case 'DF':
    case 'AF':
      return 'in_transit';

    case 'OUT_FOR_DELIVERY':
    case 'ON_DELIVERY':
    case 'WC':
      return 'out_for_delivery';

    case 'DELIVERED':
    case 'DL':
    case 'OK':
      return 'delivered';

    case 'UNDELIVERED':
    case 'EXCEPTION':
    case 'DELIVERY_FAILED':
    case 'NH':
    case 'HN':
      return 'undelivered';

    case 'RETURNING':
    case 'RETURN_IN_TRANSIT':
    case 'RT':
      return 'returning';

    case 'RETURNED':
    case 'RETURN_COMPLETED':
      return 'returned';

    case 'CANCELLED':
    case 'VOID':
    case 'CA':
      return 'cancelled';

    case 'LOST':
    case 'DESTROYED':
      return 'lost';

    default:
      // Never map an unknown status code to a terminal state like 'delivered' or 'returned'
      return 'in_transit';
  }
}
