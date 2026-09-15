import { AccountingProviderSchema } from '../core/AccountingTypes';
import { NEBIM_V3_DEFAULT_BASE_URL, NEBIM_V3_DEFAULT_SERVICE_PATH } from './nebim-v3.types';

/**
 * docs/nebim.v3.agent.md §7.3.
 * `databaseName` CREDENTIAL DEĞİLDİR → AccountingCompany.companyNo
 * `officeCode` CREDENTIAL DEĞİLDİR → AccountingCompany.branchCode
 * `derived` alan yoktur (Mikro'daki MD5 hash'in Nebim'de karşılığı bilinmiyor).
 */
export const NEBIM_V3_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'NEBIM-V3',
  name: 'Nebim V3 ERP',
  fields: [
    {
      key: 'baseUrl',
      label: 'Sunucu Adresi',
      type: 'url',
      required: true,
      defaultValue: NEBIM_V3_DEFAULT_BASE_URL,
      storage: 'SERVER_ENCRYPTED',
      description: 'Agent ile Integrator aynı makinede kurulmalıdır (varsayılan http://localhost).',
    },
    {
      key: 'port',
      label: 'Servis Portu',
      type: 'number',
      required: true,
      storage: 'SERVER_ENCRYPTED',
      description: 'Nebim V3 Integrator servis portu (örnek: 8080 veya bayinizin belirlediği port).',
    },
    {
      key: 'servicePath',
      label: 'Servis Yolu',
      type: 'text',
      required: true,
      defaultValue: NEBIM_V3_DEFAULT_SERVICE_PATH,
      storage: 'SERVER_ENCRYPTED',
      description: 'Integrator servis dizin yolu (varsayılan /IntegratorService).',
    },
    {
      key: 'userGroupCode',
      label: 'Kullanıcı Grubu Kodu',
      type: 'text',
      required: true,
      storage: 'AGENT_LOCAL',
      description: 'Nebim bayiniz tarafından tanımlanan User Group Code (sunucuda saklanmaz).',
    },
    {
      key: 'username',
      label: 'Kullanıcı Adı',
      type: 'text',
      required: true,
      storage: 'AGENT_LOCAL',
      description: 'Nebim Integrator API kullanıcı adı (sunucuda saklanmaz).',
    },
    {
      key: 'password',
      label: 'Şifre',
      type: 'password',
      required: true,
      secret: true,
      storage: 'AGENT_LOCAL',
      description: 'Nebim Integrator API kullanıcı şifresi (sunucuda saklanmaz).',
    },
    {
      key: 'maxSessions',
      label: 'Maksimum Eşzamanlı Oturum (Lisans Sınırı)',
      type: 'number',
      required: false,
      defaultValue: 1,
      storage: 'SERVER_ENCRYPTED',
      description: 'Nebim lisansınızdan tüketilecek en fazla eşzamanlı kullanıcı sayısı (varsayılan 1).',
    },
  ],
};
