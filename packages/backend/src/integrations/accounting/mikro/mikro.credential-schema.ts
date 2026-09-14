import { AccountingProviderSchema } from '../core/AccountingTypes';
import { MIKRO_DEFAULT_BASE_URL, MIKRO_DEFAULT_PORT_V17 } from './mikro.types';

/**
 * docs/mikro.agent.md §7.2. `FirmaKodu` ve `CalismaYili` CREDENTIAL DEĞİLDİR → AccountingCompany
 * satırıdır (companyNo ← FirmaKodu, periodNo ← CalismaYili, branchCode yok).
 * AGENT_LOCAL alanlar sunucuda persist edilmez (K2); `sifre` formda GÖSTERİLMEZ, Agent türetir (K8).
 */
export const MIKRO_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'MIKRO',
  name: 'Mikro ERP (Desktop API)',
  fields: [
    {
      key: 'baseUrl',
      label: 'Mikro Desktop API Adresi',
      type: 'url',
      required: false,
      storage: 'SERVER_ENCRYPTED',
      defaultValue: MIKRO_DEFAULT_BASE_URL,
      description: 'Agent, Mikro servisinin çalıştığı makineye kurulur ve localhost\'a bağlanır (K10). HTTPS desteği doğrulanmadı.',
    },
    {
      key: 'port',
      label: 'Port',
      type: 'number',
      required: false,
      storage: 'SERVER_ENCRYPTED',
      defaultValue: String(MIKRO_DEFAULT_PORT_V17),
      description: 'v17 → 8094, v16 → 8084 (registry: HKLM\\...\\MikroDesktopAPIContainer\\Parameters).',
    },
    {
      key: 'apiKey',
      label: 'API Anahtarı (ApiKey)',
      type: 'password',
      required: true,
      secret: true,
      storage: 'AGENT_LOCAL',
      description: 'API Başvuru Formu ile lisansa atanır. Yalnızca Agent\'ın yerel kasasında saklanır.',
    },
    {
      key: 'kullaniciKodu',
      label: 'Kullanıcı Kodu',
      type: 'text',
      required: true,
      storage: 'AGENT_LOCAL',
    },
    {
      key: 'password',
      label: 'Şifre',
      type: 'password',
      required: true,
      secret: true,
      storage: 'AGENT_LOCAL',
      description: 'Ham şifre Mikro\'ya ASLA gönderilmez; Agent her istekte tarihli MD5 türetir.',
    },
    {
      key: 'sifre',
      label: 'Türetilmiş Şifre (Sifre)',
      type: 'password',
      required: false,
      secret: true,
      storage: 'AGENT_LOCAL',
      derived: { from: ['password'], strategy: 'MIKRO_DATE_MD5' },
      description: '"Tarih + Şifre → MD5" — tam biçim DOĞRULANMADI (§12/1). Cache\'lenmez (K8).',
    },
  ],
};
