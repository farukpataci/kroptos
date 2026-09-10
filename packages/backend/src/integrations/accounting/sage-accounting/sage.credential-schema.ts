import { AccountingProviderSchema } from '../core/AccountingTypes';

export const SAGE_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'sage-accounting',
  name: 'Sage Business Cloud Accounting',
  fields: [
    {
      key: 'businessId',
      label: 'Sage Şirket / İşletme Kimliği (Business ID)',
      type: 'text',
      required: true,
      description: 'Sage üzerinde işlem yapılacak firma/işletme kimliği (GET /businesses ile listelenir).',
    },
    {
      key: 'defaultLedgerAccountId',
      label: 'Varsayılan Gelir Defteri Hesabı (Ledger Account ID)',
      type: 'text',
      required: false,
      description: 'Fatura satırlarında kullanılacak nominal gelir hesabı ID değeri (ör. 4000).',
    },
    {
      key: 'defaultTaxRateId',
      label: 'Varsayılan Vergi Oranı (Tax Rate ID)',
      type: 'text',
      required: false,
      description: 'Fatura satırlarında kullanılacak Sage vergi oranı ID değeri (ör. GB_STANDARD).',
    },
    {
      key: 'clientId',
      label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
      type: 'text',
      required: false,
      secret: false,
      description: 'Kendi özel Sage Developer uygulamanızı kullanmak isterseniz giriniz; boş bırakılırsa merkezi KroptOS uygulaması kullanılır.',
    },
    {
      key: 'clientSecret',
      label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
      type: 'password',
      required: false,
      secret: true,
      description: 'Özel Sage Developer uygulamanızın Client Secret değeri.',
    },
  ],
};
