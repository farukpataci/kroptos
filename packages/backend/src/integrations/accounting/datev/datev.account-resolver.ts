import { DatevConfig, DatevKontenrahmen } from './datev.types';

/**
 * Standard DATEV Sachkonten for SKR03 and SKR04
 * Reference: DATEV Kontenrahmen 2024/2025/2026 (Dok.-Nr. 1036228 / 1003221)
 */
export const DATEV_STANDARD_ACCOUNTS = {
  SKR03: {
    revenue19: 8400, // Erlöse 19% USt (Automatik-Konto)
    revenue7: 8300,  // Erlöse 7% USt (Automatik-Konto)
    revenue0: 8120,  // Steuerfreie Umsätze (§ 4 Nr. 1a UStG / Drittland)
    revenue0Eu: 8125, // Innergemeinschaftliche Lieferungen (§ 4 Nr. 1b UStG)
    bank: 1200,      // Bank
    cash: 1000,      // Kasse
    receivables: 1400, // Forderungen aus Lieferungen und Leistungen (Sammelkonto)
  },
  SKR04: {
    revenue19: 4400, // Erlöse 19% USt (Automatik-Konto)
    revenue7: 4300,  // Erlöse 7% USt (Automatik-Konto)
    revenue0: 4120,  // Steuerfreie Umsätze (§ 4 Nr. 1a UStG)
    revenue0Eu: 4125, // Innergemeinschaftliche Lieferungen (§ 4 Nr. 1b UStG)
    bank: 1800,      // Bank
    cash: 1600,      // Kasse
    receivables: 1200, // Forderungen aus Lieferungen und Leistungen (Sammelkonto)
  },
};

export class DatevAccountResolver {
  /**
   * Pads a Sachkonto to the target sachkontenLaenge if necessary (§5.5).
   * In DATEV, when a client uses e.g. 5-digit accounts, standard 4-digit accounts
   * are extended by appending zeros (e.g. 8400 -> 84000).
   */
  static padSachkonto(account: number, targetLength: number): number {
    const accStr = String(account);
    if (accStr.length >= targetLength) {
      return account;
    }
    const padding = '0'.repeat(targetLength - accStr.length);
    return parseInt(`${accStr}${padding}`, 10);
  }

  /**
   * Resolves revenue account based on Kontenrahmen, tax rate, and target length (§6.1, §6.2)
   */
  static getRevenueAccount(
    kontenrahmen: DatevKontenrahmen,
    taxRate: number,
    sachkontenLaenge: number = 4,
    customRevenueAccounts?: DatevConfig['defaultRevenueAccounts'],
  ): number {
    let baseAccount: number;

    // 1. Check custom overrides first
    if (taxRate >= 18 && taxRate <= 20 && customRevenueAccounts?.standard19) {
      baseAccount = customRevenueAccounts.standard19;
    } else if (taxRate >= 6 && taxRate <= 8 && customRevenueAccounts?.reduced7) {
      baseAccount = customRevenueAccounts.reduced7;
    } else if (taxRate === 0 && customRevenueAccounts?.zero0) {
      baseAccount = customRevenueAccounts.zero0;
    } else {
      // 2. Standard accounts by Kontenrahmen
      const std = DATEV_STANDARD_ACCOUNTS[kontenrahmen];
      if (taxRate >= 18 && taxRate <= 20) {
        baseAccount = std.revenue19;
      } else if (taxRate >= 6 && taxRate <= 8) {
        baseAccount = std.revenue7;
      } else {
        baseAccount = std.revenue0;
      }
    }

    return this.padSachkonto(baseAccount, sachkontenLaenge);
  }

  /**
   * Resolves bank / counter-account for payments (§6.1)
   */
  static getBankAccount(
    kontenrahmen: DatevKontenrahmen,
    sachkontenLaenge: number = 4,
    customAccount?: number,
  ): number {
    const baseAccount = customAccount || DATEV_STANDARD_ACCOUNTS[kontenrahmen].bank;
    return this.padSachkonto(baseAccount, sachkontenLaenge);
  }

  /**
   * Resolves BU-Schlüssel (Steuer-/Berichtigungsschlüssel) (§5.3).
   * Standard Automatik-Konten (8400/8300 or 4400/4300) in DATEV do NOT require
   * a BU-Schlüssel, returning undefined so it remains empty in the EXTF line.
   * If a custom BU key is defined in the config, it is returned.
   */
  static getBuKey(
    taxRate: number,
    customBuKeys?: DatevConfig['defaultBuKeys'],
  ): number | undefined {
    if (taxRate >= 18 && taxRate <= 20 && customBuKeys?.standard19) {
      return customBuKeys.standard19;
    }
    if (taxRate >= 6 && taxRate <= 8 && customBuKeys?.reduced7) {
      return customBuKeys.reduced7;
    }
    return undefined;
  }

  /**
   * Resolves or generates a deterministic Debitor number (§5.5, §6.1).
   * Personenkonto length is strictly Sachkontenlänge + 1.
   * (e.g., Sachkontenlänge = 4 -> Debitor: 5 digits, range 10000 - 69999)
   */
  static resolveDebitorNumber(params: {
    customerId?: string;
    externalCustomerNumber?: string | number;
    sachkontenLaenge: number;
    rangeStart?: number;
    rangeEnd?: number;
  }): number {
    const { customerId, externalCustomerNumber, sachkontenLaenge } = params;
    const debitorLength = sachkontenLaenge + 1;

    const minValid = Math.pow(10, debitorLength - 1); // e.g. 10000 for 5 digits
    const maxValid = 7 * Math.pow(10, debitorLength - 1) - 1; // e.g. 69999 for 5 digits

    const rangeStart = params.rangeStart && String(params.rangeStart).length === debitorLength
      ? Math.max(params.rangeStart, minValid)
      : minValid;

    const rangeEnd = params.rangeEnd && String(params.rangeEnd).length === debitorLength
      ? Math.min(params.rangeEnd, maxValid)
      : maxValid;

    // 1. If external customer number is already a valid Debitor number
    if (externalCustomerNumber !== undefined && externalCustomerNumber !== null) {
      const num = typeof externalCustomerNumber === 'number'
        ? externalCustomerNumber
        : parseInt(String(externalCustomerNumber).replace(/\D/g, ''), 10);

      if (!isNaN(num) && String(num).length === debitorLength && num >= rangeStart && num <= rangeEnd) {
        return num;
      }
    }

    // 2. Generate deterministic Debitor number using customerId hash
    if (customerId) {
      const rangeSpan = Math.max(1, rangeEnd - rangeStart + 1);
      let hash = 0;
      for (let i = 0; i < customerId.length; i++) {
        hash = (hash << 5) - hash + customerId.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      const positiveHash = Math.abs(hash);
      const offset = positiveHash % rangeSpan;
      return rangeStart + offset;
    }

    // 3. Fallback to rangeStart (e.g. 10000 / Diverse Debitoren)
    return rangeStart;
  }
}
