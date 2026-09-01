import { CreateShipmentRequest } from '../core/CarrierTypes';
import { ChronopostCredentials, ChronopostShippingPayload } from './ChronopostTypes';

export function mapChronopostShippingData(
  request: CreateShipmentRequest,
  creds: ChronopostCredentials,
): ChronopostShippingPayload {
  const recipient = request.recipient;
  const sender = request.sender;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;

  const names = (recipient.fullName || 'Recipient Name').split(' ');
  const firstName = names[0];
  const lastName = names.slice(1).join(' ') || 'Recipient';

  const senderNames = (sender.fullName || 'Sender Name').split(' ');
  const senderFirstName = senderNames[0];
  const senderLastName = senderNames.slice(1).join(' ') || 'Sender';

  const today = new Date().toISOString().split('T')[0];

  return {
    headerValue: {
      accountNumber: creds.accountNumber,
      password: creds.password,
      subAccount: creds.subAccount || '',
      idEmitter: 'KROPT OS',
    },
    shipperValue: {
      nom: senderLastName,
      prenom: senderFirstName,
      adresse1: sender.line1 || 'Main Street 1',
      adresse2: sender.line2 || undefined,
      ville: sender.city || 'Paris',
      codePostal: sender.postalCode || '75001',
      codePays: sender.countryCode || 'FR',
      email: sender.email || 'sender@example.com',
      telephone: sender.phone || '0102030405',
    },
    recipientValue: {
      nom: lastName,
      prenom: firstName,
      adresse1: recipient.line1 || 'Rue de Rivoli 10',
      adresse2: recipient.line2 || undefined,
      ville: recipient.city || 'Paris',
      codePostal: recipient.postalCode || '75001',
      codePays: recipient.countryCode || 'FR',
      email: recipient.email || 'recipient@example.com',
      telephone: recipient.phone || '0601020304',
    },
    skybillValue: {
      productCode: recipient.countryCode === 'FR' ? '01' : '86', // 01: Chrono 13, 86: Chrono Express
      shipDate: today,
      weight: weightKg,
      weightKg,
      objectType: 'MAR',
    },
  };
}

export function maskChronopostPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['nom', 'prenom', 'adresse1', 'adresse2', 'email', 'telephone'];
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
