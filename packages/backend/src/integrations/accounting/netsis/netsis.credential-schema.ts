import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * Logo Netsis — NetOpenX (COM, NetOpenX50.dll) ve/veya NOX REST. docs/logo.agent.md §1.3, §5.5.
 * Login şeması (şube/firma/kullanıcı) ve DB kimliğinin gerekip gerekmediği DOĞRULANMADI.
 * Hedefte AGENT_LOCAL; Agent yokken sunucu şifrelemesi.
 */
export const NETSIS_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'NETSIS',
  name: 'Logo Netsis (NetOpenX)',
  fields: [
    { key: 'username', label: 'Netsis Kullanıcı Adı', type: 'text', required: true },
    { key: 'password', label: 'Netsis Şifresi', type: 'password', required: true, secret: true },
    {
      key: 'companyId',
      label: 'Firma Kodu',
      type: 'text',
      required: true,
      description: 'Oturum bu firmaya kilitlenir; her firma için ayrı bağlantı tutulur.',
    },
    {
      key: 'branchCode',
      label: 'Şube Kodu',
      type: 'text',
      required: false,
      defaultValue: '0',
      description: 'Oturum anahtarının parçasıdır (firma + şube). Zorunluluğu henüz doğrulanmadı.',
    },
    {
      key: 'dbUser',
      label: 'Veritabanı Kullanıcısı',
      type: 'text',
      required: false,
      description: 'NetOpenX bağlantısı için gerekiyorsa SQL kullanıcı adı.',
    },
    {
      key: 'dbPassword',
      label: 'Veritabanı Şifresi',
      type: 'password',
      required: false,
      secret: true,
    },
  ],
};
