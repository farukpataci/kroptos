import { BadRequestException } from '@nestjs/common';
import { CreateShipmentRequest } from '../core/CarrierTypes';
import { ArasOrderShipmentPayload } from './ArasTypes';

export function normalizeArasPhone(phoneStr?: string): string {
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

export function mapArasCreateShipmentData(req: CreateShipmentRequest): ArasOrderShipmentPayload {
  const recipientName = String(req.recipient?.fullName || '').trim();
  const letterCount = (recipientName.match(/[a-zA-ZÇğIıÖöŞşÜü]/g) || []).length;

  if (recipientName.length < 5 || letterCount < 4) {
    throw new BadRequestException(
      `Aras Kargo alıcı adı geçersiz (${recipientName}): en az 5 karakter ve en az 4 harf içermelidir.`,
    );
  }

  const fullAddress = [req.recipient?.line1, req.recipient?.line2].filter(Boolean).join(' ').trim();
  if (fullAddress.length < 10) {
    throw new BadRequestException(
      `Aras Kargo alıcı adresi geçersiz: adres uzunluğu en az 10 karakter olmalıdır.`,
    );
  }

  const city = String(req.recipient?.city || 'İstanbul').trim();
  const town = String(req.recipient?.district || 'Kadıköy').trim();
  const phone = normalizeArasPhone(req.recipient?.phone || '');

  const integrationCode = req.referenceCode || `SHIP-${Date.now()}`;
  const firstParcel = req.parcels?.[0];
  const desi = Math.max(0.1, Number(firstParcel?.desi ?? 1));
  const weight = Math.max(0.1, Number(firstParcel?.weightKg || firstParcel?.desi || 1));

  return {
    integrationCode,
    tradingWaybillNumber: req.referenceCode || integrationCode,
    invoiceNumber: req.orderId || '',
    receiverName: recipientName,
    receiverAddress: fullAddress,
    receiverPhone: phone,
    cityName: city,
    townName: town,
    payorTypeCode: 1, // 1: Gönderici Ödemeli
    pieceCount: Math.max(1, req.parcels?.length || 1),
    weight,
    desi,
    description: req.orderId ? `Sipariş No: ${req.orderId}` : 'Kargo gönderisi',
  };
}

export function maskArasPii(text: string): string {
  if (!text) return '';
  return text
    .replace(/(<ReceiverName>)[^<]+(<\/ReceiverName>)/gi, '$1***MASKED***$2')
    .replace(/(<ReceiverAddress>)[^<]+(<\/ReceiverAddress>)/gi, '$1***MASKED***$2')
    .replace(/(<ReceiverPhone1>)[^<]+(<\/ReceiverPhone1>)/gi, '$1***MASKED***$2');
}
