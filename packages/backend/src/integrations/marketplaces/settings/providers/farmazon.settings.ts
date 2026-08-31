import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.farmazon.${key}`;

/**
 * Farmazon — eczaneler arası pazaryeri (yalnızca GLN sahibi eczanelere açık).
 *
 * DOĞRULANAMADI: kimlik alanları ve uç noktalar Farmazon'un resmi API
 * dokümanından alındı, gerçek bir hesapta denenmedi. Connector bu yüzden
 * simülasyon modunda başlar.
 */
export const farmazonOverride: ProviderSettingsOverride = {
  provider: 'farmazon',
  displayName: 'Farmazon',
  // FarmazonConnector'ın gerçekten istek attığı işlemler.
  //
  // Bilerek yok:
  //   - `categories.read` / `attributes.read` — doküman kategori uç noktası
  //     yayımlamıyor; connector bu iki metotta notImplemented atıyor.
  //   - `price.push` — UpdateListingsPriceOnly dokümanda var, connector'da yok.
  //   - `orders.updateStatus` / `invoice.upload` — ApproveOrder, SetShipmentInfos
  //     ve UploadInvoice bu tur kapsam dışı.
  capabilities: ['orders.read', 'products.read', 'stock.push'],
  credentials: [
    {
      key: 'username',
      type: 'text',
      labelKey: cred('username'),
      helpKey: cred('usernameHelp'),
      required: true,
    },
    {
      key: 'password',
      type: 'password',
      labelKey: cred('password'),
      required: true,
      secret: true,
    },
    {
      key: 'clientName',
      type: 'text',
      labelKey: cred('clientName'),
      helpKey: cred('clientNameHelp'),
      required: true,
    },
    {
      key: 'clientSecretKey',
      type: 'password',
      labelKey: cred('clientSecretKey'),
      required: true,
      secret: true,
    },
    {
      // Kimlik bilgisi değil, çalışma koşulu: staging kapalıyken bağlantı testi
      // doğru bilgilerle de başarısız olur. Satıcının forma baktığı tek an burası.
      key: 'farmazon.stagingHoursNotice',
      type: 'info',
      labelKey: cred('stagingHours'),
      helpKey: cred('stagingHoursHelp'),
      colSpan: 2,
    },
  ],
  // Kargoyu Farmazon tarafı düzenliyor; etiket kaynağı seçilecek bir şey değil.
  omitFields: ['fulfillment.labelSource'],
  patchFields: {
    'orders.numberPrefix': { default: 'FRM-' },
    // Doküman: dakikada en fazla 10 istek.
    'advanced.rateLimitPerMinute': { default: 10 },
  },
  docsUrl: 'https://yardim.farmazon.com.tr/tr/articles/3106355-farmazon-api-dokumani',
};
