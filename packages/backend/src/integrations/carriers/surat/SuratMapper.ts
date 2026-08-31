import { CreateShipmentRequest } from '../core/CarrierTypes';
import { SuratCreateShipmentInput } from './SuratTypes';

export function mapCreateShipmentData(req: CreateShipmentRequest): SuratCreateShipmentInput {
  const cargoKey = req.referenceCode || req.orderNumber || `SRT_${Date.now()}`;
  const totalDesi = req.parcels.reduce((sum, p) => sum + (p.desi || 1), 0);
  const totalWeight = req.parcels.reduce((sum, p) => sum + (p.weightKg || 1), 0);

  return {
    cargoKey,
    recipientName: req.recipient.fullName,
    recipientAddress: [req.recipient.line1, req.recipient.line2].filter(Boolean).join(' '),
    recipientCity: req.recipient.city,
    recipientDistrict: req.recipient.district,
    recipientPhone: req.recipient.phone,
    recipientEmail: req.recipient.email,
    recipientTaxId: req.recipient.taxId,
    weightKg: totalWeight,
    desi: totalDesi,
    parcelCount: req.parcels.length || 1,
    paymentType: req.paymentType,
    codAmount: req.codAmount,
    notes: req.notes,
  };
}

export function maskSuratPii(data: Record<string, any>): Record<string, any> {
  if (!data) return {};

  const clone = JSON.parse(JSON.stringify(data));

  if (clone.request) {
    if (clone.request.recipientName) clone.request.recipientName = '***';
    if (clone.request.recipientAddress) clone.request.recipientAddress = '***';
    if (clone.request.recipientPhone) clone.request.recipientPhone = '***';
    if (clone.request.recipientEmail) clone.request.recipientEmail = '***';
    if (clone.request.recipientTaxId) clone.request.recipientTaxId = '***';
  }

  return clone;
}
