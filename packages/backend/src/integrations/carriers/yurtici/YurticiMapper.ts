import { BadRequestException } from '@nestjs/common';
import { CreateShipmentRequest } from '../core/CarrierTypes';
import { YurticiCreateShipmentData } from './YurticiTypes';

/**
 * Normalizes Turkish recipient phone number into exactly 10 digits without leading 0 or +90.
 * Examples: "+90 555 111 22 33" -> "5551112233", "05551112233" -> "5551112233"
 */
export function normalizeYurticiPhone(phoneStr?: string): string {
  if (!phoneStr) return '';
  let digits = phoneStr.replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Validates and maps KroptOS CreateShipmentRequest into YurticiCreateShipmentData.
 * Throws BadRequestException on validation failure before sending over the wire.
 */
export function mapCreateShipmentData(req: CreateShipmentRequest): YurticiCreateShipmentData {
  const recipientName = String(req.recipient.fullName || '').trim();
  const letterCount = (recipientName.match(/[a-zA-ZÇğIıÖöŞşÜü]/g) || []).length;

  if (recipientName.length < 5 || letterCount < 4) {
    throw new BadRequestException(
      `Yurtiçi Kargo alıcı adı geçersiz (${recipientName}): en az 5 karakter ve en az 4 harf içermelidir.`,
    );
  }

  const fullAddress = [req.recipient.line1, req.recipient.line2].filter(Boolean).join(' ').trim();
  if (fullAddress.length < 10 || fullAddress.length > 200) {
    throw new BadRequestException(
      `Yurtiçi Kargo alıcı adresi geçersiz: adres uzunluğu 10 ile 200 karakter arasında olmalıdır.`,
    );
  }

  const phone1 = normalizeYurticiPhone(req.recipient.phone);
  if (phone1.length !== 10) {
    throw new BadRequestException(
      `Yurtiçi Kargo alıcı telefonu geçersiz (${req.recipient.phone}): alan koduyla birlikte tam 10 rakam olmalıdır.`,
    );
  }

  const cargoKey = req.referenceCode || req.orderId || req.orderNumber;
  const totalDesi = req.parcels.reduce((sum, p) => sum + p.desi, 0);
  const totalWeight = req.parcels.reduce((sum, p) => sum + (p.weightKg || 0), 0);

  return {
    cargoKey,
    invoiceKey: req.orderNumber || cargoKey,
    receiverCustName: recipientName,
    receiverAddress: fullAddress,
    receiverPhone1: phone1,
    cityName: req.recipient.city,
    townName: req.recipient.district,
    emailAddress: req.recipient.email,
    desi: totalDesi,
    kg: totalWeight,
    cargoCount: req.parcels.length || 1,
    description: req.notes || req.parcels[0]?.contentDescription,
  };
}

/**
 * Masks recipient PII in raw logged objects to prevent leaks.
 */
export function maskYurticiPii(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;

  const clone = JSON.parse(JSON.stringify(payload));
  const maskObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.receiverCustName) obj.receiverCustName = '***MASKED***';
    if (obj.receiverAddress) obj.receiverAddress = '***MASKED***';
    if (obj.receiverPhone1) obj.receiverPhone1 = '***MASKED***';
    if (obj.receiverPhone2) obj.receiverPhone2 = '***MASKED***';
    if (obj.emailAddress) obj.emailAddress = '***MASKED***';

    if (obj.recipient && typeof obj.recipient === 'object') {
      if (obj.recipient.phone) obj.recipient.phone = '***MASKED***';
      if (obj.recipient.email) obj.recipient.email = '***MASKED***';
      if (obj.recipient.line1) obj.recipient.line1 = '***MASKED***';
    }
  };

  maskObject(clone);
  if (clone.request) maskObject(clone.request);
  return clone;
}
