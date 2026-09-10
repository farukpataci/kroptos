import { AccountingProviderSchema } from '../core/AccountingTypes';

export const BC_ONLINE_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'MS_DYNAMICS_BC_ONLINE',
  name: 'Microsoft Dynamics 365 Business Central Online',
  fields: [
    {
      key: 'aadTenantId',
      label: 'Microsoft Entra (Azure AD) Kiracı Kimliği (Directory/Tenant ID)',
      type: 'text',
      required: true,
      description: 'Azure Portal / Entra ID genel bakışında yer alan Directory (tenant) ID GUID değeri.',
    },
    {
      key: 'environmentName',
      label: 'Ortam Adı (Environment Name)',
      type: 'text',
      required: true,
      defaultValue: 'production',
      description: 'Business Central ortamı: "production", "sandbox" veya şirketinizin özel ortam adı.',
    },
    {
      key: 'companyId',
      label: 'Şirket Kimliği (Company ID GUID)',
      type: 'text',
      required: true,
      description: 'İşlemlerin yürütüleceği Business Central Company GUID değeri.',
    },
    {
      key: 'userDomain',
      label: 'Kullanıcı Alan Adı (User Domain - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description: 'Doğrudan kiracı URL yapısı kullanılıyorsa (ör. sirketiniz.com), aksi halde boş bırakınız.',
    },
    {
      key: 'clientId',
      label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
      type: 'text',
      required: false,
      secret: false,
      description: 'Kendi özel Entra ID uygulamanızı kullanmak isterseniz giriniz; boş bırakılırsa merkezi KroptOS çok kiracılı uygulaması kullanılır.',
    },
    {
      key: 'clientSecret',
      label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
      type: 'password',
      required: false,
      secret: true,
      description: 'Özel Entra ID uygulamanızın istemci parolası (Client Secret).',
    },
  ],
};
