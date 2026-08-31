import { CreateShipmentRequest } from '../core/CarrierTypes';
import { FedexCredentials, FedexShipmentRequest } from './FedexTypes';

export function mapFedexCreateShipmentData(
  request: CreateShipmentRequest,
  creds: FedexCredentials,
): FedexShipmentRequest {
  const recipient = request.recipient;
  const sender = request.sender;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? Number(rawWeight) : 1.0;

  const lengthCm = firstParcel?.lengthCm ? Number(firstParcel.lengthCm) : 10;
  const widthCm = firstParcel?.widthCm ? Number(firstParcel.widthCm) : 10;
  const heightCm = firstParcel?.heightCm ? Number(firstParcel.heightCm) : 10;

  return {
    labelResponseOptions: 'LABEL',
    accountNumber: {
      value: creds.accountNumber,
    },
    requestedShipment: {
      shipper: {
        contact: {
          personName: sender.fullName || 'Sender',
          phoneNumber: sender.phone || '0000000000',
          companyName: sender.fullName || 'Sender Company',
        },
        address: {
          streetLines: [sender.line1, sender.line2].filter(Boolean) as string[],
          city: sender.city || 'Istanbul',
          stateOrProvinceCode: sender.district || '',
          postalCode: sender.postalCode || '34000',
          countryCode: sender.countryCode || 'TR',
        },
      },
      recipients: [
        {
          contact: {
            personName: recipient.fullName || 'Recipient',
            phoneNumber: recipient.phone || '0000000000',
            companyName: recipient.fullName || 'Recipient Company',
          },
          address: {
            streetLines: [recipient.line1, recipient.line2].filter(Boolean) as string[],
            city: recipient.city || 'Istanbul',
            stateOrProvinceCode: recipient.district || '',
            postalCode: recipient.postalCode || '34000',
            countryCode: recipient.countryCode || 'TR',
          },
        },
      ],
      pickupType: 'USE_SCHEDULED_PICKUP',
      serviceType: 'FEDEX_EXPRESS_SAVER',
      packagingType: 'YOUR_PACKAGING',
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: {
          responsibleParty: {
            accountNumber: {
              value: creds.accountNumber,
            },
          },
        },
      },
      labelSpecification: {
        labelFormatType: 'COMMON2D',
        imageType: 'PDF',
        labelStockType: 'PAPER_4X6',
      },
      requestedPackageLineItems: [
        {
          weight: {
            units: 'KG',
            value: weightKg,
          },
          dimensions: {
            length: lengthCm,
            width: widthCm,
            height: heightCm,
            units: 'CM',
          },
        },
      ],
    },
  };
}

export function maskFedexPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['personName', 'phoneNumber', 'streetLines', 'companyName'];
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.includes(key)) {
          if (typeof obj[key] === 'string') {
            obj[key] = '***MASKED***';
          } else if (Array.isArray(obj[key])) {
            obj[key] = obj[key].map(() => '***MASKED***');
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
