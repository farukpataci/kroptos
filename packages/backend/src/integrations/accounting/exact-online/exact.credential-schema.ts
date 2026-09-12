import { AccountingProviderSchema } from '../core/AccountingTypes';

export const EXACT_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'EXACT-ONLINE',
  name: 'Exact Online',
  fields: [
    {
      key: 'country',
      label: 'Ülke / Bölge Ortamı',
      type: 'select',
      required: true,
      defaultValue: 'NL',
      description:
        'Exact Online veri merkezi ve ülke ortamı: NL (Hollanda), BE (Belçika), DE (Almanya), UK (Birleşik Krallık), US (ABD), ES (İspanya).',
    },
    {
      key: 'division',
      label: 'Bölüm Kodu (Division)',
      type: 'text',
      required: false,
      description:
        'Exact Online şirket bölüm kodu (sayısal). Boş bırakılırsa OAuth sonrası /current/Me üzerinden otomatik keşfedilir.',
    },
    {
      key: 'journalCode',
      label: 'Satış Günlüğü Kodu (Sales Journal Code)',
      type: 'text',
      required: false,
      defaultValue: '70',
      description: 'Satış faturalarının kaydedileceği satış günlüğü kodu (örn. 70).',
    },
    {
      key: 'clientId',
      label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description:
        'Özel bir Exact Online App Center uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.',
    },
    {
      key: 'clientSecret',
      label: 'Özel İstemci Parolası (Client Secret - İsteğe Bağlı)',
      type: 'password',
      required: false,
      secret: true,
      description: 'Özel uygulamanızın istemci parolası.',
    },
  ],
};
