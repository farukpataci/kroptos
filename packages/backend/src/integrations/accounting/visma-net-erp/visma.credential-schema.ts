import { AccountingProviderSchema } from '../core/AccountingTypes';

export const VISMA_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'VISMA-NET-ERP',
  name: 'Visma.net ERP',
  fields: [
    {
      key: 'ippCompanyId',
      label: 'Şirket Tanımlayıcısı (ipp-company-id)',
      type: 'text',
      required: true,
      description:
        'Visma.net ERP şirket ID numarası (örn: 1113659). API çağrılarında ipp-company-id başlığı olarak gönderilir.',
    },
    {
      key: 'clientId',
      label: 'Visma Developer Portal Client ID',
      type: 'text',
      required: false,
      description: 'Visma Developer Portal üzerinde oluşturulmuş uygulama istemci kimliği.',
    },
    {
      key: 'clientSecret',
      label: 'Visma Developer Portal Client Secret',
      type: 'password',
      required: false,
      secret: true,
      description: 'Visma Developer Portal uygulama gizli anahtarı.',
    },
    {
      key: 'incomeAccount',
      label: 'Varsayılan Gelir Hesabı Kodu (Account Number)',
      type: 'text',
      required: false,
      description: 'Fatura satırlarında kullanılacak gelir hesabı (örn: işletme hesap planı gelir kodu).',
    },
    {
      key: 'vatCodeId',
      label: 'Varsayılan KDV / Vergi Kodu (VAT Code ID)',
      type: 'text',
      required: false,
      description: 'Nordics/AB vergi kodu (örn: 25, 15, 0).',
    },
    {
      key: 'branchNumber',
      label: 'Şube Numarası (Branch Number - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description: 'Çok şubeli işletmeler için Visma.net ERP şube kodu.',
    },
  ],
};
