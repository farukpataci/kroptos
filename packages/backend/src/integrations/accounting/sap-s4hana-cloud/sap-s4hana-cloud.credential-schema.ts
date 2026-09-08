import { AccountingProviderSchema } from '../core/AccountingTypes';

export const SAP_S4HANA_CLOUD_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'SAP_S4HANA_CLOUD',
  name: 'SAP S/4HANA Cloud (Public Edition)',
  fields: [
    {
      key: 'apiKey',
      label: 'Sandbox API Anahtarı (APIKey)',
      type: 'password',
      required: false,
      secret: true,
      description: 'SAP Business Accelerator Hub Sandbox (sandbox.api.sap.com) için API anahtarı',
    },
    {
      key: 'baseUrl',
      label: 'Kiracı API Base URL',
      type: 'url',
      required: false,
      secret: false,
      description: 'Müşteri S/4HANA Cloud kiracı adresi (örn: https://myXXXXXX-api.s4hana.ondemand.com)',
    },
    {
      key: 'username',
      label: 'İletişim Kullanıcısı (Communication User)',
      type: 'text',
      required: false,
      secret: true,
      description: 'Müşteri sisteminde SAP_COM_0008 için tanımlanmış teknik kullanıcı',
    },
    {
      key: 'password',
      label: 'İletişim Kullanıcı Şifresi',
      type: 'password',
      required: false,
      secret: true,
    },
  ],
};
