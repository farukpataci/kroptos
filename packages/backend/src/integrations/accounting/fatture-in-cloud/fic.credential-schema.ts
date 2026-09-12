import { AccountingProviderSchema } from '../core/AccountingTypes';
import { FIC_PROVIDER_NAME } from './fic.types';

export const FATTURE_IN_CLOUD_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: FIC_PROVIDER_NAME,
  name: 'Fatture in Cloud (TeamSystem)',
  fields: [
    {
      key: 'companyId',
      label: 'Şirket Kimliği (Company ID)',
      type: 'text',
      required: true,
      description:
        'Fatture in Cloud firma kimliği (sayısal). GET /user/companies ucuyla listelenen kimliktir. Tüm istekler /c/{company_id}/ altına kapsamlanır.',
    },
    {
      key: 'paymentAccountId',
      label: 'Varsayılan Ödeme / Kasa-Banka Hesabı ID (Payment Account ID)',
      type: 'text',
      required: false,
      description:
        'Tahsil edilmiş ("paid") belgeler için FIC tarafında zorunlu olan kasa/banka hesap ID değeri (§5.6). Boş bırakılırsa tahsilat "not_paid" olarak işaretlenir.',
    },
    {
      key: 'useGrossPrices',
      label: 'Fiyatlar Brüt Olarak Gönderilsin (use_gross_prices)',
      type: 'select',
      required: false,
      defaultValue: 'false',
      description:
        'Kalem fiyatlarının net mi brüt mü gönderileceğini belirler (§5.4). Varsayılan: false (net fiyat).',
    },
    {
      key: 'defaultVatId',
      label: 'Varsayılan FIC KDV ID (Default VAT ID)',
      type: 'text',
      required: false,
      defaultValue: '0',
      description:
        'Kalemlerde özel bir KDV eşleşmesi yoksa kullanılacak Fatture in Cloud KDV ID değeri (örn. Standart %22 KDV için FIC ID).',
    },
    {
      key: 'clientId',
      label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description:
        'Özel bir Fatture in Cloud Developer uygulamanız varsa girin; boşsa merkezi KroptOS OAuth kimliği kullanılır.',
    },
    {
      key: 'clientSecret',
      label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
      type: 'password',
      required: false,
      secret: true,
      description: 'Özel uygulamanızın istemci gizli parolası.',
    },
  ],
};
