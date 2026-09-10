import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * Lexware Office Credential Schema (§3.1, §7)
 *
 * Single organization-scoped static API key generated from the Lexware Office app settings.
 */
export const LEXWARE_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'lexware-office',
  name: 'Lexware Office',
  fields: [
    {
      key: 'apiKey',
      label: 'API Anahtarı (API Key)',
      type: 'password',
      required: true,
      secret: true,
      description:
        'Lexware Office web uygulamasından üretilen süresiz organizasyon API anahtarı (Ayarlar > Genel > API).',
    },
  ],
};
