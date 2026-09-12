import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * Pennylane API v2 Kimlik ve Bağlantı Şeması (§2, §7)
 *
 * Pennylane Company API v2 Bearer Token mimarisini kullanır.
 * Her token şirkete özeldir ve 25 istek / 5 saniye bağımsız rate limit kotasına sahiptir (§5.3).
 */
export const PENNYLANE_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'PENNYLANE',
  name: 'Pennylane',
  fields: [
    {
      key: 'apiToken',
      label: 'Pennylane API Belirteci (Company API Key / Bearer Token)',
      type: 'password',
      required: true,
      secret: true,
      description:
        'Pennylane şirket panelinden (Ayarlar -> Entegrasyonlar -> API / Erişim Belirteçleri) oluşturulan API v2 anahtarı.',
    },
    {
      key: 'baseUrl',
      label: 'API Temel Adresi (Base URL - İsteğe Bağlı)',
      type: 'url',
      required: false,
      defaultValue: 'https://app.pennylane.com/api/external/v2/',
      description:
        'Pennylane API v2 temel adresi. Varsayılan: https://app.pennylane.com/api/external/v2/',
    },
    {
      key: 'companyId',
      label: 'Pennylane Şirket Adı / Tanımlayıcısı (İsteğe Bağlı)',
      type: 'text',
      required: false,
      description:
        'Çok şirketli yönetimlerde kayıt amaçlı şirket adı veya kodu.',
    },
    {
      key: 'defaultVatRate',
      label: 'Varsayılan KDV Oranı Kodu (Default VAT Rate)',
      type: 'select',
      required: false,
      defaultValue: 'FR_200',
      description:
        'Fransa standart KDV oranı kodu. FR_200 (%20), FR_100 (%10), FR_055 (%5.5), FR_021 (%2.1), exempt (%0).',
    },
  ],
};
