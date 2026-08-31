import { ShipmentStatus } from '../core/CarrierTypes';

export function normalizeSuratStatus(codeOrText: string): ShipmentStatus {
  if (!codeOrText) return 'in_transit';

  const text = String(codeOrText).toUpperCase().trim();

  // Delivered status
  if (
    text.includes('TESLIM EDILDI') ||
    text.includes('TESLİM EDİLDİ') ||
    text.includes('DELIVERED') ||
    text === 'TESLIM'
  ) {
    return 'delivered';
  }

  // Out for delivery
  if (
    text.includes('DAGITIMDA') ||
    text.includes('DAĞITIMDA') ||
    text.includes('KURYE UZERINDE') ||
    text.includes('KURYEDE') ||
    text.includes('OUT_FOR_DELIVERY')
  ) {
    return 'out_for_delivery';
  }

  // Handed over / Received
  if (
    text.includes('TESLIM ALINDI') ||
    text.includes('TESLİM ALINDI') ||
    text.includes('SIPARIS ALINDI') ||
    text.includes('ÇIKIŞ ŞUBESİNDE') ||
    text.includes('CIKIS SUBESINDE') ||
    text === 'HANDED_OVER'
  ) {
    return 'handed_over';
  }

  // Returned / Returning
  if (
    text.includes('IADE EDILDI') ||
    text.includes('İADE EDİLDİ') ||
    text === 'IADE' ||
    text === 'İADE'
  ) {
    return 'returned';
  }

  if (
    text.includes('IADE YOLUNDA') ||
    text.includes('İADE YOLUNDA') ||
    text.includes('GERI DÖNÜYOR') ||
    text.includes('GERI DONUYOR')
  ) {
    return 'returning';
  }

  // Undelivered
  if (
    text.includes('TESLIM EDILEMEDI') ||
    text.includes('TESLİM EDİLEMEDİ') ||
    text.includes('ADRESTE YOK') ||
    text.includes('DEVİR') ||
    text.includes('DEVIR')
  ) {
    return 'undelivered';
  }

  // Cancelled
  if (
    text.includes('IPTAL') ||
    text.includes('İPTAL') ||
    text.includes('CANCELLED') ||
    text.includes('GERI CEKILDI')
  ) {
    return 'cancelled';
  }

  // Lost
  if (text.includes('KAYIP') || text.includes('ZAYI')) {
    return 'lost';
  }

  // Default fallback for active cargo movement
  return 'in_transit';
}
