import { CreateShipmentRequest } from '../core/CarrierTypes';
import { RoyalmailOrderPayload } from './RoyalmailTypes';

export function mapRoyalmailCreateOrderData(request: CreateShipmentRequest): RoyalmailOrderPayload {
  const recipient = request.recipient;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;
  const weightInGrams = Math.round(weightKg * 1000);

  const lengthMm = firstParcel?.lengthCm ? Math.round(Number(firstParcel.lengthCm) * 10) : 100;
  const widthMm = firstParcel?.widthCm ? Math.round(Number(firstParcel.widthCm) * 10) : 100;
  const heightMm = firstParcel?.heightCm ? Math.round(Number(firstParcel.heightCm) * 10) : 100;

  return {
    orderReference: request.referenceCode || `RM-${Date.now()}`,
    orderDate: new Date().toISOString(),
    recipient: {
      address: {
        fullName: recipient.fullName || 'Recipient Name',
        companyName: recipient.fullName || undefined,
        addressLine1: recipient.line1 || 'Street 1',
        addressLine2: recipient.line2 || undefined,
        city: recipient.city || 'London',
        postcode: (recipient.postalCode || 'SW1A 1AA').toUpperCase(),
        countryCode: recipient.countryCode || 'GB',
        email: recipient.email || 'recipient@example.com',
        phoneNumber: recipient.phone || '07000000000',
      },
    },
    packages: [
      {
        weightInGrams,
        weightInKg: weightKg,
        packageFormatIdentifier: 'Parcel',
        dimensions: {
          heightInMms: heightMm,
          widthInMms: widthMm,
          depthInMms: lengthMm,
        },
      },
    ],
    postageDetails: {
      serviceCode: 'TPN', // Tracked 24
    },
  };
}

export function maskRoyalmailPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['fullName', 'companyName', 'addressLine1', 'addressLine2', 'email', 'phoneNumber'];
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
