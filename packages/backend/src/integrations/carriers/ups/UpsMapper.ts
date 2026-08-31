import { CreateShipmentRequest } from '../core/CarrierTypes';
import { UpsCredentials, UpsShipmentRequest } from './UpsTypes';

export function mapUpsCreateShipmentData(
  request: CreateShipmentRequest,
  creds: UpsCredentials,
): UpsShipmentRequest {
  const recipient = request.recipient;
  const sender = request.sender;

  const firstParcel = request.parcels?.[0];
  const rawWeight = firstParcel?.chargeableWeightKg ?? firstParcel?.weightKg ?? (request as any).weightKg;
  const weightKg = rawWeight && rawWeight > 0 ? String(rawWeight) : '1.0';
  const lengthCm = firstParcel?.lengthCm ? String(firstParcel.lengthCm) : '10';
  const widthCm = firstParcel?.widthCm ? String(firstParcel.widthCm) : '10';
  const heightCm = firstParcel?.heightCm ? String(firstParcel.heightCm) : '10';

  return {
    ShipmentRequest: {
      Request: {
        SubVersion: '1801',
        RequestOption: 'nonvalidate',
        TransactionReference: {
          CustomerContext: request.referenceCode || request.orderNumber || 'KROPTOS-REF',
        },
      },
      Shipment: {
        Description: request.notes || 'Ecommerce Shipment',
        Shipper: {
          Name: sender.fullName || 'Sender Company',
          AttentionName: sender.fullName || 'Sender',
          Phone: {
            Number: sender.phone || '0000000000',
          },
          ShipperNumber: creds.accountNumber,
          Address: {
            AddressLine: [sender.line1, sender.line2].filter(Boolean) as string[],
            City: sender.city || 'Istanbul',
            StateProvinceCode: sender.district || '',
            PostalCode: sender.postalCode || '34000',
            CountryCode: sender.countryCode || 'TR',
          },
        },
        ShipTo: {
          Name: recipient.fullName || 'Recipient',
          AttentionName: recipient.fullName || 'Recipient',
          Phone: {
            Number: recipient.phone || '0000000000',
          },
          Address: {
            AddressLine: [recipient.line1, recipient.line2].filter(Boolean) as string[],
            City: recipient.city || 'Istanbul',
            StateProvinceCode: recipient.district || '',
            PostalCode: recipient.postalCode || '34000',
            CountryCode: recipient.countryCode || 'TR',
          },
        },
        PaymentInformation: {
          ShipmentCharge: {
            Type: '01',
            BillShipper: {
              AccountNumber: creds.accountNumber,
            },
          },
        },
        Service: {
          Code: '11', // Standard International / Domestic service
          Description: 'UPS Standard',
        },
        Package: [
          {
            Description: 'Standard Package',
            Packaging: {
              Code: '02',
            },
            Dimensions: {
              UnitOfMeasurement: { Code: 'CM' },
              Length: lengthCm,
              Width: widthCm,
              Height: heightCm,
            },
            PackageWeight: {
              UnitOfMeasurement: { Code: 'KGS' },
              Weight: weightKg,
            },
          },
        ],
      },
      LabelSpecification: {
        LabelImageFormat: {
          Code: 'PDF',
        },
        LabelStockSize: {
          Height: '6',
          Width: '4',
        },
      },
    },
  };
}

export function maskUpsPii(rawJson: string): string {
  try {
    const data = JSON.parse(rawJson);

    const maskObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const sensitiveKeys = ['Name', 'AttentionName', 'AddressLine', 'Phone', 'Number', 'TaxIdentificationNumber'];
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
