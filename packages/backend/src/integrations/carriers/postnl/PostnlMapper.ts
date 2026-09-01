import { CreateShipmentRequest } from '../core/CarrierTypes';
import { PostnlCredentials, PostnlShipmentPayload } from './PostnlTypes';

export function mapPostnlCreateShipmentData(
  request: CreateShipmentRequest,
  creds: PostnlCredentials,
  barcode: string,
): PostnlShipmentPayload {
  const recipient = request.recipient;
  const sender = request.sender;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;
  const weightGrams = Math.round(weightKg * 1000);

  const lengthMm = firstParcel?.lengthCm ? Math.round(Number(firstParcel.lengthCm) * 10) : 100;
  const widthMm = firstParcel?.widthCm ? Math.round(Number(firstParcel.widthCm) * 10) : 100;
  const heightMm = firstParcel?.heightCm ? Math.round(Number(firstParcel.heightCm) * 10) : 100;

  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);

  return {
    Customer: {
      CustomerCode: creds.customerCode,
      CustomerNumber: creds.customerNumber,
    },
    Message: {
      MessageTimeStamp: dateStr,
      Printertype: 'GraphicFile|PDF',
    },
    Shipments: [
      {
        Barcode: barcode,
        Reference: request.referenceCode || `KROP-${Date.now()}`,
        ProductCodeDelivery: '3085', // Standard PostNL parcel delivery
        Dimension: {
          Weight: weightGrams,
          weightKg,
          Length: lengthMm,
          Width: widthMm,
          Height: heightMm,
        },
        Addresses: [
          {
            AddressType: '01', // Receiver
            CompanyName: recipient.fullName || 'Recipient Company',
            FirstName: (recipient.fullName || 'Recipient').split(' ')[0],
            LastName: (recipient.fullName || 'Recipient').split(' ').slice(1).join(' ') || 'Recipient',
            Street: recipient.line1 || 'Street',
            HouseNr: recipient.line2 || '1',
            Zipcode: (recipient.postalCode || '1000AA').replace(/\s+/g, ''),
            City: recipient.city || 'Amsterdam',
            Countrycode: recipient.countryCode || 'NL',
            Email: recipient.email || 'recipient@example.com',
          },
          {
            AddressType: '02', // Sender
            CompanyName: sender.fullName || 'Sender Company',
            FirstName: (sender.fullName || 'Sender').split(' ')[0],
            LastName: (sender.fullName || 'Sender').split(' ').slice(1).join(' ') || 'Sender',
            Street: sender.line1 || 'Main Street',
            HouseNr: sender.line2 || '10',
            Zipcode: (sender.postalCode || '1000AA').replace(/\s+/g, ''),
            City: sender.city || 'Amsterdam',
            Countrycode: sender.countryCode || 'NL',
            Email: sender.email || 'sender@example.com',
          },
        ],
      },
    ],
  };
}

export function maskPostnlPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['CompanyName', 'FirstName', 'LastName', 'Street', 'HouseNr', 'Email'];
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
