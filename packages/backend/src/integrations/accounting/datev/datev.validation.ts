import {
  DatevBookingEntry,
  DatevConfig,
  DatevHeaderInput,
} from './datev.types';

export class DatevValidationError extends Error {
  constructor(public readonly validationErrors: string[]) {
    super(`DATEV Doğrulama Hatası:\n- ${validationErrors.join('\n- ')}`);
    this.name = 'DatevValidationError';
  }
}

/**
 * Allowed characters in Belegfeld 1 according to DATEV Dok.-Nr. 1036228:
 * a-z, A-Z, 0-9 as well as $, &, %, *, +, -, /
 */
export const DATEV_BELEGFELD1_REGEX = /^[a-zA-Z0-9$&%*+\-\/]{1,36}$/;

export class DatevValidator {
  /**
   * Validates configuration provided by operator (received from Steuerberater) (§6.1)
   */
  static validateConfig(config?: Partial<DatevConfig> | null): string[] {
    const errors: string[] = [];

    if (!config) {
      return ['DATEV yapılandırması eksik. Lütfen mali müşavirinizden (Steuerberater) gerekli bilgileri alınız.'];
    }

    if (!config.beraterNummer || config.beraterNummer < 1001 || config.beraterNummer > 9999999) {
      errors.push('Berater-Nr (Danışman Numarası) 1001 - 9999999 arasında olmalıdır (Bu bilgiyi mali müşavirinizden alınız).');
    }

    if (!config.mandantenNummer || config.mandantenNummer < 1 || config.mandantenNummer > 99999) {
      errors.push('Mandanten-Nr (Müşteri Numarası) 1 - 99999 arasında olmalıdır (Bu bilgiyi mali müşavirinizden alınız).');
    }

    if (!config.wjBeginn) {
      errors.push('Wirtschaftsjahresbeginn (Mali Yıl Başlangıcı - WJ-Beginn) girilmelidir (Bu bilgiyi mali müşavirinizden alınız).');
    }

    if (!config.sachkontenLaenge || config.sachkontenLaenge < 4 || config.sachkontenLaenge > 8) {
      errors.push('Sachkontenlänge (Hesap Numarası Uzunluğu) 4 ile 8 hane arasında olmalıdır (Bu bilgiyi mali müşavirinizden alınız).');
    }

    if (!config.kontenrahmen || (config.kontenrahmen !== 'SKR03' && config.kontenrahmen !== 'SKR04')) {
      errors.push('Kontenrahmen (Hesap Planı: SKR03 veya SKR04) zorunludur ve seçilmelidir. Varsayılan bulunmamaktadır (Bu bilgiyi mali müşavirinizden alınız).');
    }

    return errors;
  }

  /**
   * Validates date range and header consistency (§5.4)
   */
  static validateHeader(header: DatevHeaderInput): string[] {
    const errors: string[] = [];

    const dateVon = new Date(header.datumVon);
    const dateBis = new Date(header.datumBis);

    if (isNaN(dateVon.getTime()) || isNaN(dateBis.getTime())) {
      errors.push('Dışa aktarım tarih aralığı geçersizdir.');
    } else if (dateVon.getTime() > dateBis.getTime()) {
      errors.push(`Başlangıç tarihi (${header.datumVon}) bitiş tarihinden (${header.datumBis}) sonra olamaz.`);
    }

    if (header.wjBeginn) {
      const wj = new Date(header.wjBeginn);
      if (!isNaN(wj.getTime())) {
        // Entries should not be before the start of the fiscal year
        if (dateVon.getTime() < wj.getTime()) {
          errors.push(
            `Dışa aktarım başlangıç tarihi (${header.datumVon}), mali yıl başlangıcından (${header.wjBeginn}) önce olamaz.`,
          );
        }
      }
    }

    return errors;
  }

  /**
   * Validates booking entries against DATEV rules (§5.3, §5.4, §5.5)
   */
  static validateEntries(
    entries: DatevBookingEntry[],
    sachkontenLaenge: number,
    datumVon: Date | string,
    datumBis: Date | string,
  ): string[] {
    const errors: string[] = [];
    const minDate = new Date(datumVon).getTime();
    const maxDate = new Date(datumBis).getTime();

    if (entries.length === 0) {
      errors.push('Dışa aktarılacak buchungssatz (muhasebe kaydı) bulunamadı.');
      return errors;
    }

    const debitorLaenge = sachkontenLaenge + 1;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rec = `Kayıt #${i + 1} (${entry.belegfeld1 || entry.buchungstext || 'İsimsiz'})`;

      // 1. Amount positivity (§5.3)
      if (entry.umsatz === undefined || entry.umsatz === null || isNaN(entry.umsatz) || entry.umsatz <= 0) {
        errors.push(`${rec}: Umsatz (${entry.umsatz}) sıfırdan büyük ve pozitif olmalıdır. Negatif tutar yasaktır.`);
      }

      // 2. Soll/Haben direction (§5.3)
      if (entry.sollHaben !== 'S' && entry.sollHaben !== 'H') {
        errors.push(`${rec}: Soll/Haben-Kennzeichen yalnızca 'S' veya 'H' olabilir (${entry.sollHaben}).`);
      }

      // 3. Accounts existence
      if (!entry.konto) {
        errors.push(`${rec}: Konto alanı zorunludur.`);
      }
      if (!entry.gegenkonto) {
        errors.push(`${rec}: Gegenkonto alanı zorunludur.`);
      }

      // 4. Account length consistency (§5.5)
      const validateAccountLength = (accNumber: number, fieldName: string) => {
        const len = String(accNumber).length;
        if (len !== sachkontenLaenge && len !== debitorLaenge) {
          errors.push(
            `${rec}: ${fieldName} (${accNumber}) uzunluğu (${len} hane), tanımlı Sachkontenlänge (${sachkontenLaenge}) veya Personenkontenlänge (${debitorLaenge}) ile uyuşmuyor.`,
          );
        }
      };

      if (entry.konto) validateAccountLength(entry.konto, 'Konto');
      if (entry.gegenkonto) validateAccountLength(entry.gegenkonto, 'Gegenkonto');

      // 5. Belegdatum presence and range (§5.4)
      if (!entry.belegdatum) {
        errors.push(`${rec}: Belegdatum zorunludur.`);
      } else {
        const entryDate = new Date(entry.belegdatum).getTime();
        if (!isNaN(entryDate)) {
          if (entryDate < minDate || entryDate > maxDate) {
            errors.push(
              `${rec}: Belegdatum (${entry.belegdatum}), dosya başlığındaki dönem aralığının (${datumVon} - ${datumBis}) dışındadır.`,
            );
          }
        }
      }

      // 6. Belegfeld 1 character and length constraints (§4.4)
      if (entry.belegfeld1) {
        if (entry.belegfeld1.length > 36) {
          errors.push(`${rec}: Belegfeld 1 azami 36 karakter olabilir (Mevcut: ${entry.belegfeld1.length}).`);
        }
        if (!DATEV_BELEGFELD1_REGEX.test(entry.belegfeld1)) {
          errors.push(
            `${rec}: Belegfeld 1 ('${entry.belegfeld1}') yalnızca [a-zA-Z0-9$&%*+-/] karakterlerini içerebilir. Boşluk, nokta, virgül ve özel karakterler yasaktır.`,
          );
        }
      }

      // 7. Buchungstext length constraint
      if (entry.buchungstext && entry.buchungstext.length > 60) {
        errors.push(`${rec}: Buchungstext azami 60 karakter olabilir (Mevcut: ${entry.buchungstext.length}).`);
      }
    }

    return errors;
  }
}
