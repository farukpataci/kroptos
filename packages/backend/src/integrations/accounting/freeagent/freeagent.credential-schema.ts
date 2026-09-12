import { AccountingProviderSchema } from '../core/AccountingTypes';

export const FREEAGENT_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'freeagent',
  name: 'FreeAgent',
  fields: [
    {
      key: 'companyUrl',
      label: 'FreeAgent Şirket URI (Company URI)',
      type: 'text',
      required: false,
      description: 'Bağlı FreeAgent şirketinin URI adresi (ör. https://api.freeagent.com/v2/company).',
    },
    {
      key: 'defaultCategoryUrl',
      label: 'Varsayılan Gelir Kategorisi URI (Default Category URI)',
      type: 'text',
      required: false,
      description: 'Fatura kalemlerinde kullanılacak varsayılan muhasebe gelir kategorisi URI adresi.',
    },
    {
      key: 'bankAccountUrl',
      label: 'Banka Hesabı URI (Bank Account URI)',
      type: 'text',
      required: false,
      description: 'Tahsilat açıklamalarında (Bank Transaction Explanations) kullanılacak banka hesabı URI adresi.',
    },
    {
      key: 'clientId',
      label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description: 'Kendi özel FreeAgent uygulamanızı kullanmak isterseniz giriniz; boşsa ortam değişkenlerindeki merkezi KroptOS uygulaması kullanılır.',
    },
    {
      key: 'clientSecret',
      label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
      type: 'password',
      required: false,
      secret: true,
      description: 'Özel FreeAgent uygulamanızın istemci parolası (Client Secret).',
    },
  ],
};
