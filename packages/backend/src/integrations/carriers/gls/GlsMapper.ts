import { CreateShipmentRequest } from '../core/CarrierTypes';
import { GlsCreateShipmentPayload, GlsCredentials } from './GlsTypes';

export function mapGlsCreateShipmentData(
  creds: GlsCredentials,
  req: CreateShipmentRequest,
): GlsCreateShipmentPayload & { desi?: number } {
  const refCode = req.referenceCode || req.orderNumber || `GLS_${Date.now()}`;
  const totalDesi = req.parcels.reduce((sum, p) => sum + (p.desi || 0), 0);

  const parcels = req.parcels.map((p) => ({
    weight: p.chargeableWeightKg || p.weightKg || 1,
    desi: p.desi,
    comment: p.contentDescription,
  }));

  return {
    shipperId: creds.shipperId,
    shipmentReference: refCode,
    desi: totalDesi,
    consignee: {
      name1: req.recipient.fullName,
      street1: req.recipient.line1,
      street2: req.recipient.line2,
      country: req.recipient.countryCode || 'DE',
      zipCode: req.recipient.postalCode || '10115',
      city: req.recipient.city,
      phone: req.recipient.phone,
      email: req.recipient.email,
    },
    parcels: parcels.length > 0 ? parcels : [{ weight: 1 }],
  };
}

export function maskGlsPii(data: Record<string, any>): Record<string, any> {
  if (!data) return {};
  const clone = JSON.parse(JSON.stringify(data));

  if (clone.payload?.consignee) {
    if (clone.payload.consignee.name1) clone.payload.consignee.name1 = '***';
    if (clone.payload.consignee.street1) clone.payload.consignee.street1 = '***';
    if (clone.payload.consignee.phone) clone.payload.consignee.phone = '***';
    if (clone.payload.consignee.email) clone.payload.consignee.email = '***';
  }

  return clone;
}
