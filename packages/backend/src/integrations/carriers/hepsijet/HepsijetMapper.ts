import { CarrierAddress, CreateShipmentRequest, Parcel } from '../core/CarrierTypes';
import {
  HepsijetRecipient,
  HepsijetSendAdvanceRequest,
  HepsijetSender,
} from './HepsijetTypes';

/**
 * Normalizes Turkish characters for HepsiJET city/district matching.
 */
export function normalizeTurkishCharacters(str: string): string {
  if (!str) return '';
  return str
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c');
}

/**
 * Maps KroptOS CarrierAddress recipient to HepsiJET recipient format.
 */
export function mapRecipient(address: CarrierAddress): HepsijetRecipient {
  return {
    name: address.fullName,
    phone: address.phone,
    email: address.email,
    city: normalizeTurkishCharacters(address.city),
    town: normalizeTurkishCharacters(address.district),
    district: address.district ? normalizeTurkishCharacters(address.district) : undefined,
    addressLine1: address.line1,
    addressLine2: address.line2,
  };
}

/**
 * Maps KroptOS CarrierAddress sender to HepsiJET sender format.
 */
export function mapSender(address: CarrierAddress, companyShortName: string): HepsijetSender {
  return {
    companyName: address.fullName,
    companyShortName,
    city: normalizeTurkishCharacters(address.city),
    town: normalizeTurkishCharacters(address.district),
    addressLine1: address.line1,
  };
}

/**
 * Converts CreateShipmentRequest into HepsijetSendAdvanceRequest.
 *
 * CRITICAL RULE: Desi MUST NOT be recalculated. `req.parcels[0].desi` (or sum of parcel.desi)
 * is passed directly to preserve custom tenant divisors.
 */
export function mapSendAdvanceRequest(
  req: CreateShipmentRequest,
  companyShortName: string,
): HepsijetSendAdvanceRequest {
  const customerOrderId = req.referenceCode || req.orderId || req.orderNumber;

  const totalDesi = req.parcels.reduce((sum, p) => sum + p.desi, 0);
  const totalWeight = req.parcels.reduce((sum, p) => sum + (p.weightKg || 0), 0);

  return {
    customerOrderId,
    orderNumber: req.orderNumber,
    companyShortName,
    sender: mapSender(req.sender, companyShortName),
    recipient: mapRecipient(req.recipient),
    parcels: req.parcels.map((p) => ({
      desi: p.desi,
      weightKg: p.weightKg,
      parcelCount: 1,
      description: p.contentDescription,
    })),
    desi: totalDesi,
    weightKg: totalWeight,
    paymentType: req.paymentType,
    codAmount: req.codAmount,
  };
}

/**
 * Masks recipient PII in raw payloads to prevent leaks in logs.
 */
export function maskRecipientPii(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;

  const clone = JSON.parse(JSON.stringify(payload));
  const maskObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.recipient && typeof obj.recipient === 'object') {
      if (obj.recipient.phone) obj.recipient.phone = '***MASKED***';
      if (obj.recipient.email) obj.recipient.email = '***MASKED***';
      if (obj.recipient.addressLine1) obj.recipient.addressLine1 = '***MASKED***';
      if (obj.recipient.addressLine2) obj.recipient.addressLine2 = '***MASKED***';
    }
  };

  maskObject(clone);
  if (clone.request) maskObject(clone.request);
  return clone;
}
