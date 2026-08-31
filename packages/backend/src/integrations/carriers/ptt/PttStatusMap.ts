import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizePttStatus(carrierStatusCode: string): ShipmentStatus {
  const code = (carrierStatusCode || '').trim().toUpperCase();

  switch (code) {
    case 'VERI_YUKLENDI':
    case 'CREATED':
    case 'SUBMITTED':
    case 'KABUL_EDILDI':
    case '1':
      return 'created';

    case 'LABEL_READY':
    case 'ETIKET_BASILDI':
      return 'label_ready';

    case 'TORBAYA_EKLENDI':
    case 'HANDED_OVER':
    case 'PL':
      return 'handed_over';

    case 'SEVKEDILDI':
    case 'YOLDA':
    case 'TRANSFERDE':
    case 'IN_TRANSIT':
    case '2':
      return 'in_transit';

    case 'DAGITIMDA':
    case 'DAGITIMA_CIKTI':
    case 'OUT_FOR_DELIVERY':
    case '3':
      return 'out_for_delivery';

    case 'TESLIM_EDILDI':
    case 'DELIVERED':
    case 'OK':
    case '4':
      return 'delivered';

    case 'TESLIM_EDILEMEDI':
    case 'ADRESTE_YOK':
    case 'UNDELIVERED':
    case '5':
      return 'undelivered';

    case 'IADE_YOLUNDA':
    case 'RETURNING':
      return 'returning';

    case 'IADE_EDILDI':
    case 'RETURNED':
    case '6':
      return 'returned';

    case 'IPTAL':
    case 'CANCELLED':
    case '7':
      return 'cancelled';

    case 'KAYIP':
    case 'LOST':
      return 'lost';

    default:
      // Never map an unknown status code to a terminal state like 'delivered' or 'returned'
      return 'in_transit';
  }
}
