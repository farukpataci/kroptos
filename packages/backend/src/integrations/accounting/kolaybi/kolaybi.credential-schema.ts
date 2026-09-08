import { AccountingProviderSchema } from '../core/AccountingTypes';

export const KOLAYBI_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'KOLAYBI',
  name: "KolayBi'",
  fields: [
    {
      key: 'apiKey',
      label: 'API Anahtarı (API Key)',
      type: 'password',
      required: true,
      secret: true,
      description: "KolayBi' panelinden alınan API Key anahtarı",
    },
    {
      key: 'channel',
      label: 'Kanal Kodu (Channel)',
      type: 'text',
      required: true,
      secret: false,
      description: "KolayBi' firma/kanal kodu (örn. firma_kodu). İstek başlığında (Channel) kullanılır.",
    },
    {
      key: 'baseUrl',
      label: 'API Base URL',
      type: 'url',
      required: false,
      secret: false,
      description: "Varsayılan: https://api.kolaybi.com",
    },
  ],
};
