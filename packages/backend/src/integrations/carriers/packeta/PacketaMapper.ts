import { CreateShipmentRequest } from '../core/CarrierTypes';
import { PacketaCredentials, PacketaPacketPayload } from './PacketaTypes';

export function mapPacketaPacketData(
  request: CreateShipmentRequest,
  creds: PacketaCredentials,
): PacketaPacketPayload {
  const recipient = request.recipient;
  const fullNameParts = (recipient.fullName || 'Recipient Name').trim().split(/\s+/);
  const name = fullNameParts[0] || 'Recipient';
  const surname = fullNameParts.slice(1).join(' ') || 'Customer';

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;

  return {
    number: request.referenceCode || `PACKETA-${Date.now()}`,
    name,
    surname,
    email: recipient.email || 'recipient@example.com',
    phone: recipient.phone || '+420700000000',
    addressId: (request as any).pickupPointId || 1, // 1 = Home Delivery / Z-Point Locker ID
    weight: weightKg,
    value: (request as any).declaredValue || 10,
    currency: (request as any).currency || 'CZK',
    eshop: creds.eshop,
    street: recipient.line1 || 'Main Street 1',
    city: recipient.city || 'Prague',
    zip: recipient.postalCode || '11000',
  };
}

export function maskPacketaPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['name', 'surname', 'phone', 'email', 'street'];
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
