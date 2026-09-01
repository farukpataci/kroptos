import { CreateShipmentRequest } from '../core/CarrierTypes';
import { FanCourierAwbPayload, FanCourierCredentials } from './FanCourierTypes';

export function mapFanCourierAwbData(
  request: CreateShipmentRequest,
  creds: FanCourierCredentials,
): FanCourierAwbPayload {
  const recipient = request.recipient;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;

  return {
    service: 'Standard',
    paymentType: 'sender',
    packages: request.parcels?.length || 1,
    weight: weightKg,
    weightKg,
    clientReference: request.referenceCode || `FAN-${Date.now()}`,
    recipient: {
      name: recipient.fullName || 'Recipient Name',
      phone: recipient.phone || '0700000000',
      email: recipient.email || 'recipient@example.com',
      county: recipient.city || 'Bucuresti',
      locality: recipient.district || recipient.city || 'Bucuresti',
      street: recipient.line1 || 'Strada Principală 10',
      postalCode: recipient.postalCode || '010001',
    },
  };
}

export function maskFanCourierPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['name', 'phone', 'email', 'street', 'locality'];
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
