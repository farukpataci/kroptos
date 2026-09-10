import { AccountingProviderSchema } from '../core/AccountingTypes';

export const QBO_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'QUICKBOOKS',
  name: 'QuickBooks Online',
  fields: [
    {
      key: 'realmId',
      label: 'QuickBooks Online Şirket Kimliği (realmId / Company ID)',
      type: 'text',
      required: true,
      description: 'QuickBooks Online şirket paneli veya OAuth callback ile dönen realmId değeri.',
    },
    {
      key: 'taxCodeRef',
      label: 'Varsayılan Vergi Kodu (TaxCodeRef)',
      type: 'text',
      required: false,
      defaultValue: 'NON',
      description: 'Otomatik Satış Vergisi (AST) kapalıysa veya uluslararası bölgelerde satır vergi kodu (ör. TAX, NON).',
    },
    {
      key: 'depositAccountId',
      label: 'Banka / Kasa Hesabı ID (Deposit Account Ref)',
      type: 'text',
      required: false,
      description: 'Müşteri tahsilatlarının aktarılacağı QuickBooks banka veya kasa hesap kimliği.',
    },
    {
      key: 'incomeAccountId',
      label: 'Satış Gelir Hesabı ID (Income Account Ref)',
      type: 'text',
      required: false,
      description: 'Fatura satırlarında yeni ürün oluşturulurken bağlanacak varsayılan gelir hesabı kimliği.',
    },
    {
      key: 'clientId',
      label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
      type: 'text',
      required: false,
      secret: false,
      description: 'Özel Intuit Developer uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.',
    },
    {
      key: 'clientSecret',
      label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
      type: 'password',
      required: false,
      secret: true,
      description: 'Özel Intuit Developer uygulamanızın istemci parolası (Client Secret).',
    },
  ],
};
