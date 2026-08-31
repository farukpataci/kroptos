import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeMngStatus(carrierStatusCode: string): ShipmentStatus {
  const code = (carrierStatusCode || '').trim().toUpperCase();

  switch (code) {
    case 'SIPARIS_ALINDI':
    case 'CREATED':
    case 'KABUL_EDILDI':
    case 'SUBMITTED':
      return 'created';

    case 'ETIKET_BASILDI':
    case 'LABEL_READY':
      return 'label_ready';

    case 'TESLIM_ALINDI':
    case 'ARACA_YUKLENDI':
    case 'HANDED_OVER':
    case 'PL':
      return 'handed_over';

    case 'YOLDA':
    case 'TRANSFER_ASAMASINDA':
    case 'IN_TRANSIT':
    case 'HUB':
      return 'in_transit';

    case 'DAGITIMDA':
    case 'DAGITIMA_CIKTI':
    case 'OUT_FOR_DELIVERY':
      return 'out_for_delivery';

    case 'TESLIM_EDILDI':
    case 'DELIVERED':
    case 'OK':
      return 'delivered';

    case 'TESLIM_EDILEMEDI':
    case 'ADRESTE_YOK':
    case 'UNDELIVERED':
      return 'undelivered';

    case 'IADE_YOLUNDA':
    case 'RETURNING':
      return 'returning';

    case 'IADE_EDILDI':
    case 'RETURNED':
      return 'returned';

    case 'IPTAL_EDILDI':
    case 'CANCELLED':
      return 'cancelled';

    case 'KAYIP':
    case 'LOST':
      return 'lost';

    default:
      // Never map an unknown status code to a terminal state like 'delivered' or 'returned'
      return 'in_transit';
  }
}
