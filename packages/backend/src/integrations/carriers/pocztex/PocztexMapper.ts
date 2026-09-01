import { CreateShipmentRequest } from '../core/CarrierTypes';
import { PocztexCredentials, PocztexPrzesylkaPayload } from './PocztexTypes';

export function mapPocztexPrzesylkaData(
  request: CreateShipmentRequest,
  creds: PocztexCredentials,
): PocztexPrzesylkaPayload {
  const recipient = request.recipient;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;
  const weightGrams = Math.round(weightKg * 1000);

  return {
    guid: request.referenceCode || `PX-${Date.now()}`,
    opakowanie: 'PACZKA',
    masa: weightGrams,
    weightKg,
    karta: creds.accountNumber,
    adresat: {
      nazwa: recipient.fullName || 'Recipient Name',
      ulica: recipient.line1 || 'Ulica Glowna',
      dom: '1',
      miejscowosc: recipient.city || 'Warszawa',
      kodPocztowy: recipient.postalCode || '00-001',
      telefon: recipient.phone || '48500000000',
      email: recipient.email || 'recipient@example.com',
    },
  };
}

export function maskPocztexPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['nazwa', 'ulica', 'dom', 'telefon', 'email'];
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
