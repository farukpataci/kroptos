import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeSendeoStatus(carrierStatusCode: string): ShipmentStatus {
  const code = (carrierStatusCode || '').trim().toUpperCase();

  switch (code) {
    case '100':
    case 'CREATED':
    case 'SIPARIS_ALINDI':
    case 'SUBMITTED':
      return 'created';

    case '150':
    case 'LABEL_READY':
    case 'ETIKET_BASILDI':
      return 'label_ready';

    case '200':
    case 'HANDED_OVER':
    case 'TESLIM_ALINDI':
    case 'PL':
      return 'handed_over';

    case '300':
    case 'IN_TRANSIT':
    case 'YOLDA':
    case 'SEVKEDILDI':
      return 'in_transit';

    case '400':
    case 'OUT_FOR_DELIVERY':
    case 'DAGITIMDA':
      return 'out_for_delivery';

    case '500':
    case 'DELIVERED':
    case 'TESLIM_EDILDI':
    case 'OK':
      return 'delivered';

    case '600':
    case 'UNDELIVERED':
    case 'ADRESTE_YOK':
      return 'undelivered';

    case '700':
    case 'RETURNING':
    case 'IADE_YOLUNDA':
      return 'returning';

    case '800':
    case 'RETURNED':
    case 'IADE_EDILDI':
      return 'returned';

    case '900':
    case 'CANCELLED':
    case 'IPTAL':
      return 'cancelled';

    case '999':
    case 'LOST':
    case 'KAYIP':
      return 'lost';

    default:
      // Never map an unknown status code to a terminal state like 'delivered' or 'returned'
      return 'in_transit';
  }
}
