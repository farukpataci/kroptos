import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * NetSuite Credential Şeması (§5.2, §6)
 *
 * KRİTİK GÜVENLİK KURALI (§5.2):
 * NetSuite RSA Özel Anahtarı (private key) bu şemada KESİNLİKLE yer almaz!
 * Yalnızca sunucu ortamındaki referansı (`keyReference`) tutulur.
 */
export const NETSUITE_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'netsuite',
  name: 'Oracle NetSuite',
  fields: [
    {
      key: 'accountId',
      label: 'NetSuite Hesap Kimliği (Account ID)',
      type: 'text',
      required: true,
      description:
        'NetSuite hesap numaranız (Setup > Company > Company Information). Örn: "1234567" veya Sandbox için "1234567_SB1".',
    },
    {
      key: 'clientId',
      label: 'İstemci Kimliği (Client ID / Consumer Key)',
      type: 'text',
      required: true,
      description:
        'OAuth 2.0 Entegrasyon kaydındaki Consumer Key (Setup > Integration > Manage Integrations).',
    },
    {
      key: 'certificateId',
      label: 'Sertifika Kimliği (Certificate ID / kid)',
      type: 'text',
      required: true,
      description:
        'OAuth 2.0 Client Credentials kurulumunda sertifikaya atanan kimlik (kid) değeri.',
    },
    {
      key: 'keyReference',
      label: 'Özel Anahtar Referansı (Key Reference)',
      type: 'text',
      required: true,
      description:
        'Sunucu ortamında/KMS\'te saklanan RSA özel anahtarının ortam değişkeni adı (örn: "NETSUITE_PRIVATE_KEY"). Özel anahtar doğrudan formdan girilmez.',
    },
    {
      key: 'subsidiaryId',
      label: 'Subsidiary ID (OneWorld)',
      type: 'text',
      required: false,
      description:
        'OneWorld hesaplarında kayıtların bağlanacağı iştirak/subsidiary dahili numarası (§5.9).',
    },
    {
      key: 'certificateExpiresAt',
      label: 'Sertifika Bitiş Tarihi (YYYY-MM-DD)',
      type: 'text',
      required: false,
      description:
        'Yüklenen açık anahtar sertifikasının son geçerlilik tarihi. 30 ve 7 gün kala uyarı üretilir (§5.2).',
    },
    {
      key: 'concurrencyLimit',
      label: 'Eşzamanlı İstek Limiti',
      type: 'number',
      required: false,
      description:
        'NetSuite hesap genelinde paylaşılan eşzamanlılık havuzundan bu bağlantı için ayrılan tavan (varsayılan: 1) (§5.3).',
    },
  ],
};
