import { BadRequestException } from '@nestjs/common';
import { CreateShipmentRequest } from '../core/CarrierTypes';
import { DpdCredentials, DpdShipmentPayload } from './DpdTypes';

export function normalizeDpdPhone(phoneStr?: string): string {
  if (!phoneStr) return '';
  return phoneStr.replace(/[^\d+]/g, '');
}

export function mapDpdCreateShipmentData(
  req: CreateShipmentRequest,
  _creds: DpdCredentials,
): DpdShipmentPayload {
  const recipientName = String(req.recipient?.fullName || '').trim();
  const letterCount = (recipientName.match(/[a-zA-ZÇğIıÖöŞşÜüäöüÄÖÜß]/g) || []).length;

  if (recipientName.length < 5 || letterCount < 4) {
    throw new BadRequestException(
      `DPD alıcı adı geçersiz (${recipientName}): en az 5 karakter ve en az 4 harf içermelidir.`,
    );
  }

  const fullAddress = [req.recipient?.line1, req.recipient?.line2].filter(Boolean).join(' ').trim();
  if (fullAddress.length < 10) {
    throw new BadRequestException(
      `DPD alıcı adresi geçersiz: adres uzunluğu en az 10 karakter olmalıdır.`,
    );
  }

  const city = String(req.recipient?.city || 'Frankfurt').trim();
  const zipCode = String(req.recipient?.postalCode || '60311').trim();
  const country = String(req.recipient?.countryCode || 'DE').trim().toUpperCase();
  const phone = normalizeDpdPhone(req.recipient?.phone || '');

  const senderName = String(req.sender?.fullName || 'Kroptos Logistics').trim();
  const senderStreet = String(req.sender?.line1 || 'Hauptstrasse 1').trim();
  const senderCity = String(req.sender?.city || 'Frankfurt').trim();
  const senderZip = String(req.sender?.postalCode || '60311').trim();
  const senderCountry = String(req.sender?.countryCode || 'DE').trim().toUpperCase();

  const referenceNo = req.referenceCode || `SHIP-${Date.now()}`;
  const firstParcel = req.parcels?.[0];
  const weight = Number(firstParcel?.weightKg ?? firstParcel?.desi ?? 1);
  const desi = Math.max(0.1, Number(firstParcel?.desi ?? 1));

  return {
    printOptions: {
      printerLanguage: 'PDF',
      paperFormat: 'A6',
    },
    orderData: {
      customerReference: referenceNo,
      sender: {
        name: senderName,
        street: senderStreet,
        country: senderCountry,
        zipCode: senderZip,
        city: senderCity,
      },
      recipient: {
        name: recipientName,
        street: fullAddress,
        country,
        zipCode,
        city,
        phone,
        email: req.recipient?.email,
      },
      parcels: [
        {
          weight,
          desi,
        },
      ],
    },
  };
}

export function maskDpdPii(text: string): string {
  if (!text) return '';
  return text
    .replace(/("name":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("street":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("phone":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("email":\s*")[^"]+(")/gi, '$1***MASKED***$2');
}
