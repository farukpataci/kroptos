import { AccountingProviderSchema } from '../core/AccountingTypes';

export const SEVDESK_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'sevdesk',
  name: 'sevDesk',
  fields: [
    {
      key: 'apiToken',
      label: 'API Belirteci (API Token)',
      type: 'password',
      required: true,
      secret: true,
      description:
        'sevDesk web panelinizde Ayarlar > Kullanıcı Yönetimi (Einstellungen > Benutzer) bölümünden aldığınız 32 haneli kullanıcı API token.',
    },
  ],
};
