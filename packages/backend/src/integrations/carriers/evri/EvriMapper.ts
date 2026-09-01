import { CreateShipmentRequest } from '../core/CarrierTypes';
import { EvriCredentials, EvriShipmentPayload } from './EvriTypes';

export function mapEvriCreateShipmentData(
  request: CreateShipmentRequest,
  creds: EvriCredentials,
): EvriShipmentPayload {
  const recipient = request.recipient;
  const sender = request.sender;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;
  const weightInGrams = Math.round(weightKg * 1000);

  const lengthMm = firstParcel?.lengthCm ? Math.round(Number(firstParcel.lengthCm) * 10) : 100;
  const widthMm = firstParcel?.widthCm ? Math.round(Number(firstParcel.widthCm) * 10) : 100;
  const heightMm = firstParcel?.heightCm ? Math.round(Number(firstParcel.heightCm) * 10) : 100;

  const names = (recipient.fullName || 'Recipient Name').split(' ');
  const firstName = names[0];
  const lastName = names.slice(1).join(' ') || 'Recipient';

  const senderNames = (sender.fullName || 'Sender Name').split(' ');
  const senderFirstName = senderNames[0];
  const senderLastName = senderNames.slice(1).join(' ') || 'Sender';

  return {
    clientId: creds.clientId,
    clientReference: request.referenceCode || `EVRI-${Date.now()}`,
    serviceType: 'standard_delivery',
    deliveryAddress: {
      firstName,
      lastName,
      companyName: recipient.fullName || undefined,
      addressLine1: recipient.line1 || 'Street 1',
      addressLine2: recipient.line2 || undefined,
      city: recipient.city || 'London',
      postcode: (recipient.postalCode || 'E1 6AN').toUpperCase(),
      countryCode: recipient.countryCode || 'GB',
      email: recipient.email || 'recipient@example.com',
      phone: recipient.phone || '07111111111',
    },
    senderAddress: {
      firstName: senderFirstName,
      lastName: senderLastName,
      companyName: sender.fullName || undefined,
      addressLine1: sender.line1 || 'Main Street',
      addressLine2: sender.line2 || undefined,
      city: sender.city || 'London',
      postcode: (sender.postalCode || 'E1 6AN').toUpperCase(),
      countryCode: sender.countryCode || 'GB',
      email: sender.email || 'sender@example.com',
      phone: sender.phone || '07222222222',
    },
    parcel: {
      weightInGrams,
      weightKg,
      lengthInMm: lengthMm,
      widthInMm: widthMm,
      heightInMm: heightMm,
    },
  };
}

export function maskEvriPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['firstName', 'lastName', 'companyName', 'addressLine1', 'addressLine2', 'email', 'phone'];
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.includes(key)) {
          if (typeof obj[key] === 'string') {
            obj[key] = '***MASKED***';
          }
        } else if (typeof obj[key] === 'object') {
          maskObject(obj[key]);
        }
      }
    };

    maskObject(data);
    return JSON.stringify(data);
  } catch {
    return '{"masked": true}';
  }
}
