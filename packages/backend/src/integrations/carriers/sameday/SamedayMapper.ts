import { CreateShipmentRequest } from '../core/CarrierTypes';
import { SamedayAwbPayload, SamedayCredentials } from './SamedayTypes';

export function mapSamedayAwbData(
  request: CreateShipmentRequest,
  creds: SamedayCredentials,
): SamedayAwbPayload {
  const recipient = request.recipient;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;

  return {
    pickupPoint: creds.pickupPointId || 1,
    packageType: 0, // parcel
    packageWeight: weightKg,
    weightKg,
    serviceId: 1, // 24H standard
    clientInternalReference: request.referenceCode || `SMD-${Date.now()}`,
    awbRecipient: {
      name: recipient.fullName || 'Recipient Name',
      personType: 0, // individual
      phone: recipient.phone || '0700000000',
      email: recipient.email || 'recipient@example.com',
      address: {
        county: recipient.city || 'Bucharest',
        city: recipient.city || 'Bucharest',
        address: recipient.line1 || 'Main Street 1',
        postalCode: recipient.postalCode || '010001',
      },
    },
  };
}

export function maskSamedayPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['name', 'phone', 'email', 'address', 'adresse1'];
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
