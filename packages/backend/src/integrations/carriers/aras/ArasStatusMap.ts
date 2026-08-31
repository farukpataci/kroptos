import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeArasStatus(carrierStatusCode: string): ShipmentStatus {
  const code = (carrierStatusCode || '').trim().toUpperCase();

  switch (code) {
    case '0':
    case '1':
    case 'CREATED':
    case 'SIPARIS_ALINDI':
    case 'SIPARIŞ ALINDI':
    case 'NEW':
      return 'created';

    case '2':
    case 'LABEL_READY':
    case 'BARKOD_BASILDI':
      return 'label_ready';

    case '3':
    case 'HANDED_OVER':
    case 'TESLIM_ALINDI':
    case 'KURYEDE':
    case 'ÇIKIŞ AMBARINDA':
      return 'handed_over';

    case '4':
    case 'IN_TRANSIT':
    case 'YOLDA':
    case 'YOLDA / AKTARMADA':
    case 'TRANSFER MERKEZİNDE':
      return 'in_transit';

    case '5':
    case 'OUT_FOR_DELIVERY':
    case 'DAGITIMDA':
    case 'DAĞITIMDA':
    case 'DAĞITIMA ÇIKARILDI':
    case 'VARIS SUBESINDE':
    case 'VARIŞ ŞUBESİNDE':
      return 'out_for_delivery';

    case '6':
    case 'DELIVERED':
    case 'TESLIM EDILDI':
    case 'TESLİM EDİLDİ':
      return 'delivered';

    case '7':
    case 'UNDELIVERED':
    case 'TESLIM EDILEMEDI':
    case 'TESLİM EDİLEMEDİ':
      return 'undelivered';

    case '8':
    case 'RETURNING':
    case 'IADE YOLDA':
    case 'İADE YOLDA':
      return 'returning';

    case '9':
    case 'RETURNED':
    case 'IADE EDILDI':
    case 'İADE EDİLDİ':
      return 'returned';

    case '10':
    case 'CANCELLED':
    case 'IPTAL':
    case 'İPTAL EDİLDİ':
      return 'cancelled';

    case '11':
    case 'LOST':
    case 'KAYIP':
      return 'lost';

    default:
      // Never map an unknown status code to a terminal state like 'delivered' or 'returned'
      return 'in_transit';
  }
}
