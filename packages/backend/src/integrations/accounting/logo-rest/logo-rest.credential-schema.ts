import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * clientId/clientSecret/username/password: docs/logo.agent.md §5.5'e göre AGENT_LOCAL
 * olması hedeflenir; Agent yokken mevcut sunucu şifreleme yolundan (encryption.util) geçer.
 */
export const LOGO_REST_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'LOGO-REST',
  name: 'Logo Tiger REST Servis',
  fields: [
    {
      key: 'baseUrl',
      label: 'REST Servis Adresi',
      type: 'url',
      required: true,
      description: 'Logo REST Servisinin çalıştığı sunucu (örn. http://10.0.0.5:32001). Varsayılan port 32001.',
    },
    {
      key: 'clientId',
      label: 'Client ID',
      type: 'text',
      required: true,
      description: 'Logo Çözüm Ortağı üzerinden verilen istemci kimliği.',
    },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
      secret: true,
      description: 'Logo Çözüm Ortağı üzerinden verilen istemci sırrı.',
    },
    {
      key: 'username',
      label: 'Logo Kullanıcı Adı',
      type: 'text',
      required: true,
    },
    {
      key: 'password',
      label: 'Logo Şifresi',
      type: 'password',
      required: true,
      secret: true,
    },
    {
      key: 'companyId',
      label: 'Firma Numarası (firmno)',
      type: 'text',
      required: true,
      defaultValue: '1',
      description: 'Token bu firmaya kilitlenir; her firma için ayrı bağlantı/oturum tutulur.',
    },
    {
      key: 'periodNo',
      label: 'Dönem Numarası',
      type: 'text',
      required: false,
      description: 'Boş bırakılırsa aktif dönem. REST tarafında nasıl iletildiği henüz doğrulanmadı.',
    },
  ],
};
