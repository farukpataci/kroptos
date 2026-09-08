import { AccountingProviderSchema } from '../core/AccountingCredentialService';

export const PARASUT_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'PARASUT',
  name: 'Paraşüt',
  fields: [
    {
      key: 'clientId',
      label: 'Client ID (Uygulama Kimliği)',
      type: 'text',
      required: true,
      description: 'Paraşüt Geliştirici Portalından alınan Client ID',
    },
    {
      key: 'clientSecret',
      label: 'Client Secret (İstemci Gizli Anahtarı)',
      type: 'password',
      required: true,
      description: 'Paraşüt Geliştirici Portalından alınan Client Secret',
    },
    {
      key: 'username',
      label: 'Kullanıcı Adı (E-posta)',
      type: 'text',
      required: true,
      description: 'Paraşüt hesabınızın yetkili kullanıcı e-posta adresi',
    },
    {
      key: 'password',
      label: 'Şifre',
      type: 'password',
      required: true,
      description: 'Paraşüt hesabınızın şifresi',
    },
    {
      key: 'companyId',
      label: 'Firma ID (Company ID)',
      type: 'text',
      required: true,
      description: 'Paraşüt firma ID numarası (URL içinde görünen ID)',
    },
    {
      key: 'redirectUri',
      label: 'Redirect URI',
      type: 'text',
      required: false,
      description: 'Varsayılan: urn:ietf:wg:oauth:2.0:oob',
    },
  ],
};
