import { BadRequestException } from '@nestjs/common';
import { CreateShipmentRequest } from '../core/CarrierTypes';
import { SendeoCredentials, SendeoSetCargoPayload } from './SendeoTypes';

export function normalizeSendeoPhone(phoneStr?: string): string {
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

export function mapSendeoCreateShipmentData(
  req: CreateShipmentRequest,
  creds: SendeoCredentials,
): SendeoSetCargoPayload {
  const recipientName = String(req.recipient?.fullName || '').trim();
  const letterCount = (recipientName.match(/[a-zA-ZÇğIıÖöŞşÜü]/g) || []).length;

  if (recipientName.length < 5 || letterCount < 4) {
    throw new BadRequestException(
      `Sendeo Kargo alıcı adı geçersiz (${recipientName}): en az 5 karakter ve en az 4 harf içermelidir.`,
    );
  }

  const fullAddress = [req.recipient?.line1, req.recipient?.line2].filter(Boolean).join(' ').trim();
  if (fullAddress.length < 10) {
    throw new BadRequestException(
      `Sendeo Kargo alıcı adresi geçersiz: adres uzunluğu en az 10 karakter olmalıdır.`,
    );
  }

  const city = String(req.recipient?.city || 'İstanbul').trim();
  const town = String(req.recipient?.district || 'Kadıköy').trim();
  const phone = normalizeSendeoPhone(req.recipient?.phone || '');

  const referenceNo = req.referenceCode || `SHIP-${Date.now()}`;
  const firstParcel = req.parcels?.[0];
  const weight = Number(firstParcel?.desi ?? firstParcel?.weightKg ?? 1);
  const desi = Math.max(0.1, Number(firstParcel?.desi ?? 1));

  return {
    referenceNo,
    customerCode: creds.customerCode,
    barcode: referenceNo,
    paymentType: 1, // 1: Gönderici Ödemeli
    receiver: {
      name: recipientName,
      phone,
      city,
      district: town,
      address: fullAddress,
    },
    packages: [
      {
        desi,
        weight,
        description: req.orderId ? `Sipariş No: ${req.orderId}` : 'Kargo gönderisi',
      },
    ],
  };
}

export function maskSendeoPii(text: string): string {
  if (!text) return '';
  return text
    .replace(/("name":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("address":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("phone":\s*")[^"]+(")/gi, '$1***MASKED***$2');
}
