import * as assert from 'assert';
import { calculateDesi, chargeableWeight, measureParcels } from './DesiCalculator';

const box = { weightKg: 1, lengthCm: 30, widthCm: 20, heightCm: 10 };

describe('DesiCalculator', () => {
  it('divides volume by the divisor, which is per tariff not universal', () => {
    assert.strictEqual(calculateDesi(box), 2); // 30*20*10 / 3000
    assert.strictEqual(calculateDesi(box, 5000), 1.2);
  });

  it('bills the larger of actual and volumetric weight', () => {
    assert.strictEqual(chargeableWeight(box), 2); // desi 2 > 1 kg
    assert.strictEqual(chargeableWeight({ ...box, weightKg: 7.5 }), 7.5);
  });

  it('rejects a zero or missing dimension instead of quoting desi 0', () => {
    assert.throws(() => calculateDesi({ ...box, heightCm: 0 }), /heightCm/);
    assert.throws(() => chargeableWeight({ ...box, weightKg: NaN }), /weightKg/);
  });

  it('measures each parcel on its own and leaves the input untouched', () => {
    const input = [box, { weightKg: 9, lengthCm: 10, widthCm: 10, heightCm: 10 }];
    const result = measureParcels(input);

    assert.deepStrictEqual(
      result.parcels.map((p) => p.desi),
      [2, 0.33],
    );
    assert.strictEqual(result.totalDesi, 2.33);
    assert.strictEqual(result.totalWeightKg, 10);
    // 2 (desi wins) + 9 (weight wins) — not max(10, 2.33).
    assert.strictEqual(result.chargeableWeightKg, 11);
    assert.strictEqual((input[0] as any).desi, undefined);
  });

  it('refuses a shipment with no parcels', () => {
    assert.throws(() => measureParcels([]), /en az bir paket/);
  });
});
