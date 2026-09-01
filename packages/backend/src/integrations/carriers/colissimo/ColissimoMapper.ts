import { CreateShipmentRequest } from '../core/CarrierTypes';
import { ColissimoCredentials, ColissimoGenerateLabelPayload } from './ColissimoTypes';

export function mapColissimoGenerateLabelData(
  request: CreateShipmentRequest,
  creds: ColissimoCredentials,
): ColissimoGenerateLabelPayload {
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
    outputFormat: {
      outputPrintingType: 'PDF_10x15_300dpi',
    },
    letter: {
      service: {
        contractNumber: creds.contractNumber,
        password: creds.password,
        commercialName: 'KROPT OS',
        productCode: recipient.countryCode === 'FR' ? 'DOM' : 'DOS',
        depositDate: today,
      },
      parcel: {
        weight: weightKg,
        weightKg,
      },
      sender: {
        address: {
          companyName: sender.fullName || undefined,
          lastName: senderLastName,
          firstName: senderFirstName,
          line1: sender.line1 || 'Main Street 1',
          line2: sender.line2 || undefined,
          city: sender.city || 'Paris',
          zipCode: sender.postalCode || '75001',
          countryCode: sender.countryCode || 'FR',
          email: sender.email || 'sender@example.com',
          phoneNumber: sender.phone || '0102030405',
        },
      },
      addressee: {
        address: {
          companyName: recipient.fullName || undefined,
          lastName,
          firstName,
          line1: recipient.line1 || 'Rue de Rivoli 10',
          line2: recipient.line2 || undefined,
          city: recipient.city || 'Paris',
          zipCode: recipient.postalCode || '75001',
          countryCode: recipient.countryCode || 'FR',
          email: recipient.email || 'recipient@example.com',
          phoneNumber: recipient.phone || '0601020304',
        },
      },
    },
  };
}

export function maskColissimoPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['firstName', 'lastName', 'companyName', 'line1', 'line2', 'email', 'phoneNumber'];
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
