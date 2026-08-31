import { BadRequestException } from '@nestjs/common';
import { CreateShipmentRequest } from '../core/CarrierTypes';
import { PttCreateShipmentPayload, PttCredentials } from './PttTypes';

export function normalizePttPhone(phoneStr?: string): string {
  if (!phoneStr) return '';
  let digits = phoneStr.replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  return digits;
}

export function mapPttCreateShipmentData(
  req: CreateShipmentRequest,
  _creds: PttCredentials,
): PttCreateShipmentPayload {
  const recipientName = String(req.recipient?.fullName || '').trim();
  const letterCount = (recipientName.match(/[a-zA-ZÇğIıÖöŞşÜü]/g) || []).length;

  if (recipientName.length < 5 || letterCount < 4) {
    throw new BadRequestException(
      `PTT Kargo alıcı adı geçersiz (${recipientName}): en az 5 karakter ve en az 4 harf içermelidir.`,
    );
  }

  const fullAddress = [req.recipient?.line1, req.recipient?.line2].filter(Boolean).join(' ').trim();
  if (fullAddress.length < 10) {
    throw new BadRequestException(
      `PTT Kargo alıcı adresi geçersiz: adres uzunluğu en az 10 karakter olmalıdır.`,
    );
  }

  const city = String(req.recipient?.city || 'İstanbul').trim();
  const town = String(req.recipient?.district || 'Kadıköy').trim();
  const phone = normalizePttPhone(req.recipient?.phone || '');

  const referenceNo = req.referenceCode || `SHIP-${Date.now()}`;
  const barcode = referenceNo;

  const firstParcel = req.parcels?.[0];
  const weightKg = Number(firstParcel?.weightKg ?? firstParcel?.desi ?? 1);
  const desi = Math.max(0.1, Number(firstParcel?.desi ?? 1));

  return {
    barcode,
    referenceNo,
    recipientName,
    recipientAddress: fullAddress,
    recipientCity: city,
    recipientDistrict: town,
    recipientPhone: phone,
    desi,
    weightKg,
    pieceCount: req.parcels?.length || 1,
    description: req.orderId ? `Sipariş No: ${req.orderId}` : 'PTT Kargo gönderisi',
  };
}

export function maskPttPii(text: string): string {
  if (!text) return '';
  return text
    .replace(/(<aliciAdi>)[^<]+(<\/aliciAdi>)/gi, '$1***MASKED***$2')
    .replace(/(<aliciAdres>)[^<]+(<\/aliciAdres>)/gi, '$1***MASKED***$2')
    .replace(/(<aliciTel>)[^<]+(<\/aliciTel>)/gi, '$1***MASKED***$2')
    .replace(/("recipientName":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("recipientAddress":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("recipientPhone":\s*")[^"]+(")/gi, '$1***MASKED***$2');
}
