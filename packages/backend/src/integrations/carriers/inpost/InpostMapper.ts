import { CreateShipmentRequest } from '../core/CarrierTypes';
import { InpostShipmentPayload } from './InpostTypes';

export function mapInpostCreateShipmentData(request: CreateShipmentRequest): InpostShipmentPayload {
  const recipient = request.recipient;
  const sender = request.sender;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;

  const lengthCm = firstParcel?.lengthCm ? Number(firstParcel.lengthCm) : 10;
  const widthCm = firstParcel?.widthCm ? Number(firstParcel.widthCm) : 10;
  const heightCm = firstParcel?.heightCm ? Number(firstParcel.heightCm) : 10;

  // Determine InPost box size template if target point is present (A: small, B: medium, C: large)
  let template = 'small';
  if (heightCm > 19 || lengthCm > 38 || widthCm > 38) {
    template = 'large';
  } else if (heightCm > 8) {
    template = 'medium';
  }

  const targetPoint = (request as any).targetPoint || (request as any).customAttributes?.targetPoint;
  const service = targetPoint ? 'inpost_locker_standard' : 'inpost_courier_standard';

  const payload: InpostShipmentPayload = {
    service,
    reference: request.referenceCode || `KROP-${Date.now()}`,
    receiver: {
      name: recipient.fullName || 'Recipient Name',
      email: recipient.email || 'recipient@example.com',
      phone: recipient.phone || '500000000',
      address: {
        street: recipient.line1 || 'Street 1',
        building_number: recipient.line2 || '1',
        city: recipient.city || 'Warsaw',
        post_code: (recipient.postalCode || '00-001').replace(/\s+/g, ''),
        country_code: recipient.countryCode || 'PL',
      },
    },
    sender: {
      name: sender.fullName || 'Sender Name',
      email: sender.email || 'sender@example.com',
      phone: sender.phone || '600000000',
      address: {
        street: sender.line1 || 'Main Street',
        building_number: sender.line2 || '10',
        city: sender.city || 'Warsaw',
        post_code: (sender.postalCode || '00-001').replace(/\s+/g, ''),
        country_code: sender.countryCode || 'PL',
      },
    },
    parcels: [
      {
        template,
        dimensions: {
          length: lengthCm,
          width: widthCm,
          height: heightCm,
          unit: 'mm',
        },
        weight: {
          amount: weightKg,
          unit: 'kg',
        },
      },
    ],
  };

  if (targetPoint) {
    payload.custom_attributes = {
      target_point: targetPoint,
    };
  }

  return payload;
}

export function maskInpostPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['name', 'email', 'phone', 'street', 'company_name', 'first_name', 'last_name'];
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
