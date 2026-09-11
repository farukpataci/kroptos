import { AccountingProviderSchema } from '../core/AccountingTypes';

export const FORTNOX_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'fortnox',
  name: 'Fortnox',
  fields: [
    {
      key: 'clientId',
      label: 'Fortnox İstemci Kimliği (Client ID)',
      type: 'text',
      required: true,
      secret: false,
      description: 'Fortnox Developer Portal üzerinde oluşturulan uygulamanın Client ID değeri.',
    },
    {
      key: 'clientSecret',
      label: 'Fortnox İstemci Gizli Anahtarı (Client Secret)',
      type: 'password',
      required: true,
      secret: true,
      description: 'Fortnox Developer Portal üzerinde verilen Client Secret gizli anahtarı.',
    },
    {
      key: 'redirectUri',
      label: 'Geri Dönüş URL (Redirect URI)',
      type: 'text',
      required: true,
      secret: false,
      description: 'Fortnox Developer Portal üzerinde kayıtlı OAuth 2.0 callback adresi.',
    },
    {
      key: 'defaultSalesAccount',
      label: 'Varsayılan Satış Hesabı (Sales Account)',
      type: 'text',
      required: false,
      secret: false,
      description: 'İsveç BAS hesap planı gelir hesabı (varsayılan: 3001 - %25 KDV Satış).',
    },
    {
      key: 'defaultVATRate',
      label: 'Varsayılan KDV Oranı (%)',
      type: 'text',
      required: false,
      secret: false,
      description: 'Varsayılan İsveç KDV oranı (örn. 25, 12, 6, 0).',
    },
  ],
};
