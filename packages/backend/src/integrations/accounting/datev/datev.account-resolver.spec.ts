import { DatevAccountResolver, DATEV_STANDARD_ACCOUNTS } from './datev.account-resolver';

describe('DatevAccountResolver', () => {
  describe('Revenue Accounts & Padding (§6.1, §6.2)', () => {
    it('returns correct SKR03 standard accounts for 4-digit Sachkonten', () => {
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 19, 4)).toBe(8400);
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 7, 4)).toBe(8300);
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 0, 4)).toBe(8120);
    });

    it('returns correct SKR04 standard accounts for 4-digit Sachkonten', () => {
      expect(DatevAccountResolver.getRevenueAccount('SKR04', 19, 4)).toBe(4400);
      expect(DatevAccountResolver.getRevenueAccount('SKR04', 7, 4)).toBe(4300);
      expect(DatevAccountResolver.getRevenueAccount('SKR04', 0, 4)).toBe(4120);
    });

    it('correctly pads accounts for 5-digit and 6-digit Sachkontenlänge (§5.5)', () => {
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 19, 5)).toBe(84000);
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 19, 6)).toBe(840000);
      expect(DatevAccountResolver.getRevenueAccount('SKR04', 19, 5)).toBe(44000);
      expect(DatevAccountResolver.getRevenueAccount('SKR04', 7, 6)).toBe(430000);
    });

    it('respects custom revenue account overrides', () => {
      const custom = {
        standard19: 8410,
        reduced7: 8310,
        zero0: 8150,
      };
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 19, 4, custom)).toBe(8410);
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 7, 4, custom)).toBe(8310);
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 0, 4, custom)).toBe(8150);
      // Padded custom account
      expect(DatevAccountResolver.getRevenueAccount('SKR03', 19, 5, custom)).toBe(84100);
    });
  });

  describe('Bank Accounts', () => {
    it('returns standard bank accounts by Kontenrahmen', () => {
      expect(DatevAccountResolver.getBankAccount('SKR03', 4)).toBe(1200);
      expect(DatevAccountResolver.getBankAccount('SKR04', 4)).toBe(1800);
    });

    it('pads bank accounts when sachkontenLaenge > 4', () => {
      expect(DatevAccountResolver.getBankAccount('SKR03', 5)).toBe(12000);
      expect(DatevAccountResolver.getBankAccount('SKR04', 6)).toBe(180000);
    });

    it('respects custom bank account override', () => {
      expect(DatevAccountResolver.getBankAccount('SKR03', 4, 1210)).toBe(1210);
      expect(DatevAccountResolver.getBankAccount('SKR03', 5, 1210)).toBe(12100);
    });
  });

  describe('BU-Schlüssel (§5.3)', () => {
    it('returns undefined for standard automatic accounts (no BU needed)', () => {
      expect(DatevAccountResolver.getBuKey(19)).toBeUndefined();
      expect(DatevAccountResolver.getBuKey(7)).toBeUndefined();
      expect(DatevAccountResolver.getBuKey(0)).toBeUndefined();
    });

    it('returns custom BU key if explicitly configured', () => {
      const customBu = { standard19: 3, reduced7: 2 };
      expect(DatevAccountResolver.getBuKey(19, customBu)).toBe(3);
      expect(DatevAccountResolver.getBuKey(7, customBu)).toBe(2);
    });
  });

  describe('Debitor Account Allocation (§5.5, §6.1)', () => {
    it('preserves valid existing external customer number matching length and range', () => {
      const debitor = DatevAccountResolver.resolveDebitorNumber({
        externalCustomerNumber: 10542,
        sachkontenLaenge: 4,
      });
      expect(debitor).toBe(10542);
      expect(String(debitor).length).toBe(5);
    });

    it('allocates deterministic Debitor number within allowed range for customerId', () => {
      const deb1 = DatevAccountResolver.resolveDebitorNumber({
        customerId: 'cust_abc_123',
        sachkontenLaenge: 4,
      });
      const deb2 = DatevAccountResolver.resolveDebitorNumber({
        customerId: 'cust_abc_123',
        sachkontenLaenge: 4,
      });
      const deb3 = DatevAccountResolver.resolveDebitorNumber({
        customerId: 'cust_xyz_789',
        sachkontenLaenge: 4,
      });

      // Deterministic: same customer gives same debitor number
      expect(deb1).toBe(deb2);
      // Valid 5 digits (sachkontenLaenge 4 + 1)
      expect(String(deb1).length).toBe(5);
      expect(deb1).toBeGreaterThanOrEqual(10000);
      expect(deb1).toBeLessThanOrEqual(69999);

      expect(String(deb3).length).toBe(5);
      expect(deb3).toBeGreaterThanOrEqual(10000);
      expect(deb3).toBeLessThanOrEqual(69999);
    });

    it('respects 5-digit Sachkontenlänge giving 6-digit Debitor numbers', () => {
      const debitor = DatevAccountResolver.resolveDebitorNumber({
        customerId: 'cust_5digit_sachkonto',
        sachkontenLaenge: 5,
      });
      expect(String(debitor).length).toBe(6);
      expect(debitor).toBeGreaterThanOrEqual(100000);
      expect(debitor).toBeLessThanOrEqual(699999);
    });

    it('falls back to range start if no customer info is provided', () => {
      const fallback = DatevAccountResolver.resolveDebitorNumber({
        sachkontenLaenge: 4,
      });
      expect(fallback).toBe(10000);
    });
  });
});
