import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * Logo Objects (COM) — GO3 / Go Plus / Tiger Plus. Oturum: Login(kullanıcı, şifre, firmaNo, dönemNo).
 * Kaynak: docs/logo.agent.md §1.2 (ikincil kaynak). Kimlik hedefte AGENT_LOCAL; Agent yokken sunucu şifrelemesi.
 */
export const LOGO_OBJECTS_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'LOGO-OBJECTS',
  name: 'Logo GO3 (Logo Objects)',
  fields: [
    { key: 'username', label: 'Logo Kullanıcı Adı', type: 'text', required: true },
    { key: 'password', label: 'Logo Şifresi', type: 'password', required: true, secret: true },
    {
      key: 'companyId',
      label: 'Firma Numarası',
      type: 'text',
      required: true,
      defaultValue: '1',
      description: 'Login çağrısındaki firma numarası; oturum bu firmaya kilitlenir.',
    },
    {
      key: 'periodNo',
      label: 'Dönem Numarası',
      type: 'text',
      required: true,
      defaultValue: '0',
      description: '0 = aktif dönem.',
    },
  ],
};
