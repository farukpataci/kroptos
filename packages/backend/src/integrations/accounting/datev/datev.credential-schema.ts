import { AccountingProviderSchema } from '../core/AccountingTypes';

export const DATEV_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'DATEV',
  name: 'DATEV EXTF Buchungsstapel',
  fields: [
    {
      key: 'beraterNummer',
      label: 'Berater-Nr (Danışman No: 1001-9999999)',
      type: 'number',
      required: true,
      defaultValue: '1001',
      description: 'Mali müşavirinizin DATEV danışman numarası',
    },
    {
      key: 'mandantenNummer',
      label: 'Mandanten-Nr (Müşteri No: 1-99999)',
      type: 'number',
      required: true,
      defaultValue: '1',
      description: 'DATEV sistemindeki müşteri / firma numaranız',
    },
    {
      key: 'wjBeginn',
      label: 'WJ-Beginn (Mali Yıl Başlangıcı: YYYY-MM-DD)',
      type: 'text',
      required: true,
      defaultValue: '2026-01-01',
      description: 'Mevcut mali yıl başlangıç tarihi',
    },
    {
      key: 'sachkontenLaenge',
      label: 'Sachkontenlänge (Hesap Uzunluğu: 4-8)',
      type: 'number',
      required: true,
      defaultValue: '4',
      description: 'Standart Sachkonto uzunluğu (Standart: 4)',
    },
    {
      key: 'kontenrahmen',
      label: 'Kontenrahmen (SKR03 veya SKR04)',
      type: 'text',
      required: true,
      defaultValue: 'SKR03',
      description: 'Hesap planı (SKR03 veya SKR04)',
    },
    {
      key: 'encoding',
      label: 'Karakter Kodlaması (WINDOWS-1252 veya UTF-8)',
      type: 'text',
      required: false,
      defaultValue: 'WINDOWS-1252',
      description: 'Dosya kodlaması (Varsayılan: WINDOWS-1252)',
    },
    {
      key: 'festschreibung',
      label: 'Festschreibung (0 = Taslak, 1 = Kilitli)',
      type: 'number',
      required: false,
      defaultValue: '0',
      description: 'Kayıt kilitleme (0: Taslak, 1: Kesin)',
    },
  ],
};
