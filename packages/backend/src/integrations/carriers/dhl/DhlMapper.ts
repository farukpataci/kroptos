import { BadRequestException } from '@nestjs/common';
import { CreateShipmentRequest } from '../core/CarrierTypes';
import { DhlCredentials, DhlCreateShipmentPayload } from './DhlTypes';

export function normalizeDhlPhone(phoneStr?: string): string {
  if (!phoneStr) return '+905551112233';
  let digits = phoneStr.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) {
    if (digits.startsWith('90')) {
      digits = `+${digits}`;
    } else if (digits.startsWith('0')) {
      digits = `+90${digits.slice(1)}`;
    } else {
      digits = `+90${digits}`;
    }
  }
  return digits;
}

export function mapDhlCreateShipmentData(
  req: CreateShipmentRequest,
  creds: DhlCredentials,
): DhlCreateShipmentPayload {
  const recipientName = String(req.recipient?.fullName || '').trim();
  const letterCount = (recipientName.match(/[a-zA-ZÇğIıÖöŞşÜü]/g) || []).length;

  if (recipientName.length < 5 || letterCount < 4) {
    throw new BadRequestException(
      `DHL Express alıcı adı geçersiz (${recipientName}): en az 5 karakter ve en az 4 harf içermelidir.`,
    );
  }

  const fullAddress = [req.recipient?.line1, req.recipient?.line2].filter(Boolean).join(' ').trim();
  if (fullAddress.length < 10) {
    throw new BadRequestException(
      `DHL Express alıcı adresi geçersiz: adres uzunluğu en az 10 karakter olmalıdır.`,
    );
  }

  const countryCode = (req.recipient?.countryCode || 'TR').toUpperCase().slice(0, 2);
  const city = String(req.recipient?.city || 'İstanbul').trim();
  const phone = normalizeDhlPhone(req.recipient?.phone);

  const firstParcel = req.parcels?.[0];
  const weightKg = Number(firstParcel?.desi ?? firstParcel?.weightKg ?? 1);

  const plannedDate = new Date();
  plannedDate.setHours(plannedDate.getHours() + 2);
  const plannedShippingDateAndTime = plannedDate.toISOString();

  return {
    plannedShippingDateAndTime,
    pickup: {
      isRequested: false,
    },
    productCode: countryCode === 'TR' ? 'N' : 'P',
    accounts: [
      {
        typeCode: 'shipper',
        number: creds.accountNumber,
      },
    ],
    customerDetails: {
      shipperDetails: {
        postalAddress: {
          postalCode: '34000',
          cityName: 'İstanbul',
          countryCode: 'TR',
          addressLine1: 'Merkez Depo Maslak Mah. Buyukdere Cad.',
        },
        contactInformation: {
          personName: 'KroptOS Depo Yetkilisi',
          phone: '+902125550000',
          email: 'depo@kroptos.com',
        },
      },
      receiverDetails: {
        postalAddress: {
          postalCode: req.recipient?.postalCode || '34000',
          cityName: city,
          countryCode,
          addressLine1: fullAddress.slice(0, 45),
          addressLine2: fullAddress.length > 45 ? fullAddress.slice(45, 90) : undefined,
        },
        contactInformation: {
          personName: recipientName,
          phone,
          email: req.recipient?.email || undefined,
        },
      },
    },
    content: {
      packages: [
        {
          weight: weightKg,
          dimensions: {
            length: Math.max(1, Math.round(firstParcel?.lengthCm || 10)),
            width: Math.max(1, Math.round(firstParcel?.widthCm || 10)),
            height: Math.max(1, Math.round(firstParcel?.heightCm || 10)),
          },
          description: req.orderId ? `Order ${req.orderId}` : 'Express parcel',
        },
      ],
      isCustomsDeclarable: countryCode !== 'TR',
      description: req.orderId ? `Order ${req.orderId}` : 'Express parcel',
    },
  };
}

export function maskDhlPii(text: string): string {
  if (!text) return '';
  return text
    .replace(/("personName":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("addressLine1":\s*")[^"]+(")/gi, '$1***MASKED***$2')
    .replace(/("phone":\s*")[^"]+(")/gi, '$1***MASKED***$2');
}
