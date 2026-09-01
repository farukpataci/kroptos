import { CreateShipmentRequest } from '../core/CarrierTypes';
import { CargusAwbPayload, CargusCredentials } from './CargusTypes';

export function mapCargusAwbData(
  request: CreateShipmentRequest,
  creds: CargusCredentials,
): CargusAwbPayload {
  const recipient = request.recipient;
  const sender = request.sender;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;

  return {
    CustomString: request.referenceCode || `CARGUS-${Date.now()}`,
    ServiceId: 1, // Standard
    Parcels: request.parcels?.length || 1,
    Weight: weightKg,
    weightKg,
    Sender: {
      Name: sender.fullName || 'Sender Name',
      Phone: sender.phone || '0700000000',
      Email: sender.email || 'sender@example.com',
      CountyName: sender.city || 'Bucuresti',
      LocalityName: sender.district || sender.city || 'Bucuresti',
      StreetName: sender.line1 || 'Main Street 1',
      PostalCode: sender.postalCode || '010001',
    },
    Destination: {
      Name: recipient.fullName || 'Recipient Name',
      Phone: recipient.phone || '0700000000',
      Email: recipient.email || 'recipient@example.com',
      CountyName: recipient.city || 'Bucuresti',
      LocalityName: recipient.district || recipient.city || 'Bucuresti',
      StreetName: recipient.line1 || 'Strada Principală 10',
      PostalCode: recipient.postalCode || '010001',
    },
  };
}

export function maskCargusPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['Name', 'ContactPerson', 'Phone', 'Email', 'StreetName'];
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
