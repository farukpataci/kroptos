import { AccountingProviderSchema } from '../core/AccountingTypes';

export const BIZIMHESAP_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'BIZIMHESAP',
  name: 'BizimHesap',
  fields: [
    {
      key: 'firmId',
      label: 'Firma ID (firmId)',
      type: 'password',
      required: true,
      secret: true,
      description: 'BizimHesap tarafından verilen tekil firma kimliği. Gövdede yetkilendirme amacıyla taşınır.',
    },
    {
      key: 'key',
      label: 'API Key (Key)',
      type: 'password',
      required: true,
      secret: true,
      description: 'BizimHesap B2B API Key başlığı.',
    },
    {
      key: 'token',
      label: 'API Token (Token)',
      type: 'password',
      required: true,
      secret: true,
      description: 'BizimHesap B2B API Token başlığı.',
    },
    {
      key: 'baseUrl',
      label: 'API Base URL',
      type: 'url',
      required: false,
      secret: false,
      defaultValue: 'https://bizimhesap.com',
      description: 'Varsayılan: https://bizimhesap.com. Güvenlik gereği düz HTTP desteklenmez.',
    },
  ],
};
