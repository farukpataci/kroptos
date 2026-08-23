import { Parcel, ParcelInput } from './CarrierTypes';

/**
 * Desi and chargeable weight — one source of truth.
 *
 * Turkish carriers price on `desi = (L × W × H) / divisor` and charge whichever
 * is larger, the desi or the actual weight. The divisor is not universal: 3000
 * is the domestic default, express and international tariffs use 5000. It stays
 * a parameter so a connector can pass its own instead of every provider growing
 * a private copy of this formula.
 */
export const DEFAULT_DESI_DIVISOR = 3000;

/** Carriers bill in whole or half desi; two decimals is enough to store. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function positive(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Geçersiz paket ölçüsü: ${field} pozitif bir sayı olmalı (alınan: ${value})`);
  }
  return value;
}

/** Volumetric weight of one parcel, in desi. */
export function calculateDesi(
  parcel: Pick<ParcelInput, 'lengthCm' | 'widthCm' | 'heightCm'>,
  divisor: number = DEFAULT_DESI_DIVISOR,
): number {
  positive(divisor, 'divisor');
  const length = positive(parcel.lengthCm, 'lengthCm');
  const width = positive(parcel.widthCm, 'widthCm');
  const height = positive(parcel.heightCm, 'heightCm');

  return round2((length * width * height) / divisor);
}

/** What the carrier actually bills for one parcel: the larger of the two. */
export function chargeableWeight(parcel: ParcelInput, divisor: number = DEFAULT_DESI_DIVISOR): number {
  const weight = positive(parcel.weightKg, 'weightKg');
  return round2(Math.max(weight, calculateDesi(parcel, divisor)));
}

/**
 * Turns raw input into the measured `Parcel` a connector is allowed to see, and
 * totals the shipment. Returns new objects: the caller's request is not mutated.
 * This is the only place desi is computed — see the Parcel/ParcelInput split.
 */
export function measureParcels(
  parcels: ParcelInput[],
  divisor: number = DEFAULT_DESI_DIVISOR,
): { parcels: Parcel[]; totalDesi: number; totalWeightKg: number; chargeableWeightKg: number } {
  if (!parcels?.length) {
    throw new Error('Gönderi en az bir paket içermeli');
  }

  const measured: Parcel[] = parcels.map((parcel) => ({
    ...parcel,
    desi: calculateDesi(parcel, divisor),
    chargeableWeightKg: chargeableWeight(parcel, divisor),
  }));

  return {
    parcels: measured,
    totalDesi: round2(measured.reduce((sum, p) => sum + p.desi, 0)),
    totalWeightKg: round2(measured.reduce((sum, p) => sum + p.weightKg, 0)),
    // Summed per parcel, not max-of-totals: the carrier prices each parcel on
    // its own, so a heavy small box and a light big box both bill at their own
    // larger figure.
    chargeableWeightKg: round2(measured.reduce((sum, p) => sum + p.chargeableWeightKg, 0)),
  };
}
