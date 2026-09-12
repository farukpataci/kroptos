import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * Cegid XRP Flex Kimlik ve Bağlantı Şeması (§1.1, §2, §6.3)
 *
 * KRİTİK UYARI (§1.1):
 * Cegid Expert kolunun kimlik alanları (apiKey, subscriptionKey, consumerId, consumerSecret)
 * BURAYA KESİNLİKLE EKLENMEZ. Flex, Acumatica tabanlı OAuth2 Password Grant modeli kullanır.
 */
export const CEGID_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'CEGID-XRP-FLEX',
  name: 'Cegid XRP Flex',
  fields: [
    {
      key: 'instanceUrl',
      label: 'Cegid XRP Flex Örnek Adresi (Instance URL)',
      type: 'text',
      required: true,
      description:
        'Cegid XRP Flex sunucu adresi (örn: https://sirketiniz.cegid.cloud). Taban URL koda gömülmez, buradan üretilir.',
    },
    {
      key: 'clientId',
      label: 'OAuth 2.0 İstemci Kimliği (Client ID)',
      type: 'text',
      required: true,
      description: 'Cegid XRP Flex OAuth 2.0 Client ID değeri.',
    },
    {
      key: 'clientSecret',
      label: 'OAuth 2.0 Gizli Anahtarı (Client Secret)',
      type: 'password',
      required: true,
      secret: true,
      description: 'Cegid XRP Flex OAuth 2.0 Client Secret anahtarı.',
    },
    {
      key: 'username',
      label: 'Kullanıcı Adı (Username)',
      type: 'text',
      required: true,
      description: 'API erişimine yetkili Cegid XRP Flex kullanıcı adı.',
    },
    {
      key: 'password',
      label: 'Şifre (Password)',
      type: 'password',
      required: true,
      secret: true,
      description: 'API erişimine yetkili Cegid XRP Flex kullanıcı şifresi.',
    },
    {
      key: 'endpointName',
      label: 'Sözleşme Uç Adı (Endpoint Name)',
      type: 'text',
      required: false,
      description: 'Sözleşme tabanlı uç adı (varsayılan: Default).',
    },
    {
      key: 'endpointVersion',
      label: 'Sözleşme Sürümü (Endpoint Version)',
      type: 'text',
      required: false,
      description: 'Sözleşme uç sürümü (varsayılan: 22.200.001).',
    },
    {
      key: 'tokenUrl',
      label: 'Özel Belirteç Uç Noktası (Token URL - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description:
        'Özel bir OAuth 2.0 belirteç adresi gerekiyorsa belirtilir (varsayılan: {instanceUrl}/identity/connect/token).',
    },
    {
      key: 'scope',
      label: 'Yetki Kapsamı (Scope - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description: 'OAuth 2.0 kapsamı (varsayılan: api).',
    },
    {
      key: 'branchId',
      label: 'Şube Tanımlayıcısı (Branch ID - İsteğe Bağlı)',
      type: 'text',
      required: false,
      description: 'Çok şubeli kurulumlar için şube kodu (örn: PROD, HEAD).',
    },
    {
      key: 'defaultIncomeAccount',
      label: 'Varsayılan Gelir Hesabı Kodu',
      type: 'text',
      required: false,
      description:
        'Fransız hesap planına (PCG) uygun gelir hesabı (örn: 707000). Mali müşavirinizden alınız.',
    },
    {
      key: 'defaultVatCode',
      label: 'Varsayılan Vergi Kodu (TVA Code)',
      type: 'text',
      required: false,
      description:
        'Fransa KDV vergi kategorisi/kodu (örn: TVA20, TVA10). Mali müşavirinizden alınız.',
    },
  ],
};
