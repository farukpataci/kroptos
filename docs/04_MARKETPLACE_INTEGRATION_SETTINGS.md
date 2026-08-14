# KroptOS — Pazaryeri Entegrasyon Ayarları Sistemi (Spesifikasyon)

> **Amaç:** Bir pazaryeri entegrasyonu eklenip API bilgileri girildikten sonra, kullanıcıdan
> o entegrasyonun **çalışma davranışını** (stok kaynağı, fiyat kuralı, sipariş çekme aralığı,
> kargo, fatura, hata politikası…) yapılandırmasını isteyen; **tek bir şema (manifest) motoruyla
> tüm pazaryerlerine uyan** ayarlar altyapısı.
>
> **Kapsam:** Yalnızca `providerType = 'marketplace'`. ERP / kargo / ödeme entegrasyonları bu
> spesifikasyonun dışındadır (ancak aynı motor ileride onlara da genişletilebilir — bkz. §14).
>
> Konvansiyonlar için: `00_PROJECT_CONTEXT.md`, `01_FRONTEND_PAGE_ANATOMY.md`,
> `02_BACKEND_MODULE_ANATOMY.md`. Bu doküman o kalıpların **üzerine** yazılmıştır, yenisini icat etmez.

---

## 1. Mevcut Durum ve Boşluk

### Bugün var olan

| Katman | Durum |
|---|---|
| `prisma/schema.prisma` | `Integration` modeli var (`credentialsEncrypted`, `status`, `lastSyncAt`, soft delete) |
| `modules/integration/` | `create / update / delete / testConnection / triggerSync` + kategori-nitelik eşleme |
| `integrations/marketplaces/` | `MarketplaceConnector` (abstract), `ConnectorFactory`, `CredentialService`, 5 sağlayıcı |
| `MarketplaceCredentialService.validate()` | Sağlayıcı bazlı **zorunlu credential anahtarları** if/else ile kodlanmış |
| Frontend `integrations/marketplace/page.tsx` | Liste + `renderCredentialsFields()` içinde **provider bazlı if/else form alanları** |
| `IntegrationSettings` (Prisma) | Ajans seviyesinde `config Json` — entegrasyon **örneği** bazlı değil, kullanılmıyor sayılır |

### Boşluk (bu doküman bunu çözüyor)

1. Credential girildikten sonra **davranışsal ayar yok** — entegrasyon "aktif" oluyor ama neyi,
   nereden, hangi kuralla senkronize edeceği tanımsız.
2. Provider bazlı alanlar **frontend ve backend'de iki ayrı yerde if/else** ile duplike ediliyor.
   Yeni pazaryeri = 4+ dosyada elle düzenleme.
3. Ayar yapılmadan `triggerSync` çalışabiliyor → yanlış stok/fiyat push riski.

### Çözümün özü

> **Tek kaynak (single source of truth): sağlayıcı başına bir `ProviderSettingsManifest`.**
> Backend doğrulaması, frontend formu, sihirbaz adımları, i18n anahtarları ve varsayılan
> değerler bu manifest'ten türetilir. Frontend'de **hiçbir yerde `if (provider === 'trendyol')` olmaz.**

---

## 2. Mimari Genel Bakış

```
packages/shared/src/integration-settings/
  ├── types.ts                     # SettingsField, SettingsSection, ProviderSettingsManifest, ...
  └── index.ts

packages/backend/src/integrations/marketplaces/settings/
  ├── base.settings.ts             # TÜM pazaryerleri için ortak sekme/bölüm/alan tanımı
  ├── manifest.registry.ts         # provider -> override; merge(base, override) => manifest
  ├── manifest.merge.ts            # deep-merge + omitFields + capability filtresi
  ├── settings.validator.ts        # manifest'e göre generic doğrulama
  └── providers/
      ├── trendyol.settings.ts
      ├── hepsiburada.settings.ts
      ├── n11.settings.ts
      ├── amazon.settings.ts
      └── ciceksepeti.settings.ts

packages/backend/src/modules/integration-settings/   # yeni NestJS modülü
  ├── integration-settings.module.ts
  ├── integration-settings.controller.ts
  ├── integration-settings.service.ts
  ├── integration-settings.service.spec.ts
  └── dto/integration-settings.dto.ts

packages/frontend/src/app/t/[tenantPublicId]/integrations/marketplace/
  ├── hooks/useIntegrationSettings.ts
  └── components/
      ├── IntegrationSettingsDrawer.tsx
      ├── IntegrationSetupWizard.tsx
      ├── SettingsSchemaRenderer.tsx
      └── fields/ (FIELD_REGISTRY)
```

Akış:

```
 [Manifest Registry]  ──resolve(provider, capabilities, tenant)──►  Resolved Manifest
          │                                                              │
          │                                                     GET /settings/schema
          ▼                                                              ▼
 [Validator]  ◄──PUT /settings──  [Service]  ──►  IntegrationSetting.values (Json)
                                       │                    │
                                       │                    └──► Revision + AuditLog
                                       ▼
                            [Connector / Worker]  ──► settings.get('stock.bufferQuantity')
```

---

## 3. Veri Modeli (Prisma)

`packages/backend/prisma/schema.prisma` içine eklenecek. `Integration` modeline iki ilişki eklenir.

```prisma
model IntegrationSetting {
  id             String   @id @default(cuid())
  integrationId  String   @unique
  integration    Integration @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  // Tenant izolasyonu (Integration'dan kopyalanır; sorgu filtresi için denormalize)
  agencyId       String
  clientId       String?
  storeId        String?

  provider       String   // 'trendyol' | 'hepsiburada' | ... (manifest çözümlemesi için)
  schemaVersion  Int      @default(1)

  values         Json     @default("{}")   // { "stock.bufferQuantity": 5, "orders.autoImport": true }
  secretsEncrypted String?                 // secret:true işaretli ayar alanları (AES-256, encryption.util)

  isConfigured   Boolean  @default(false)  // zorunlu adımlar tamamlandı mı
  completedSteps String[] @default([])     // wizard adım id'leri
  lastAppliedAt  DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  revisions      IntegrationSettingRevision[]

  @@index([agencyId])
  @@index([clientId])
  @@index([storeId])
  @@index([provider])
  @@index([deletedAt])
}

model IntegrationSettingRevision {
  id                    String   @id @default(cuid())
  integrationSettingId  String
  integrationSetting    IntegrationSetting @relation(fields: [integrationSettingId], references: [id], onDelete: Cascade)
  version               Int
  values                Json
  diff                  Json?    // { "stock.bufferQuantity": { before: 0, after: 5 } }
  changedByUserId       String?
  changedByName         String?
  note                  String?
  createdAt             DateTime @default(now())

  @@unique([integrationSettingId, version])
  @@index([integrationSettingId])
}
```

`Integration` modeline eklenecek satırlar:

```prisma
model Integration {
  // ... mevcut alanlar
  setting   IntegrationSetting?
}
```

### Kararlar

- **Değerler düz (flat) JSON:** anahtar `"<section>.<field>"` biçiminde nokta ile ayrılır
  (`orders.autoImport`). Bu, `visibleWhen` koşullarını ve diff üretimini basitleştirir.
- **Varsayılanlar DB'ye yazılmaz.** `values` yalnızca kullanıcının **açıkça değiştirdiği** alanları
  tutar; okuma sırasında `{ ...manifestDefaults, ...values }` şeklinde birleştirilir.
  Böylece manifest'te bir varsayılan güncellenince mevcut kayıtlar da otomatik güncellenir.
- **Sırlar `values` içine yazılmaz.** `secret: true` alanları `secretsEncrypted` blob'una gider
  (mevcut `common/utils/encryption.util`). API'den asla ham dönmez → `"••••4821"` maskesi.
- **Credential'lar burada tutulmaz.** API anahtarları mevcut yerinde kalır:
  `Integration.credentialsEncrypted`. Manifest sadece o alanların *tanımını* taşır (§5).

> Migration: `pnpm db:migrate` (dev) — `add_integration_settings` adıyla.

---

## 4. Şema (Manifest) Tip Tanımları

`packages/shared/src/integration-settings/types.ts`:

```ts
// ---------- Alan tipleri ----------
export type SettingsFieldType =
  | 'text' | 'textarea' | 'password' | 'number' | 'percent' | 'money'
  | 'toggle' | 'select' | 'multiselect' | 'radioGroup'
  | 'time' | 'duration' | 'weekdays'
  | 'tags' | 'keyValue'
  | 'resourceSelect'   // uzak kaynaktan seçim (depo, fiyat listesi, ERP entegrasyonu, kargo)
  | 'mappingTable'     // sol: pazaryeri değeri, sağ: KroptOS değeri
  | 'info';            // yalnız-okunur bilgi/uyarı kutusu

export type ConditionOp = 'eq' | 'neq' | 'in' | 'notIn' | 'truthy' | 'falsy' | 'gt' | 'lt';

export interface SettingsCondition {
  field: string;                 // 'stock.source'
  op: ConditionOp;
  value?: unknown;
}

export interface SettingsFieldOption {
  value: string;
  labelKey: string;              // i18n anahtarı
  descriptionKey?: string;
  disabled?: boolean;
}

/** Dinamik seçenek kaynağı — frontend apiFetch ile çeker, sonuç cache'lenir. */
export interface SettingsOptionSource {
  endpoint: string;              // '/warehouses'  |  '/integrations?providerType=erp'
  valueField: string;            // 'id'
  labelField: string;            // 'name'
  params?: Record<string, string>;
  dependsOn?: string;            // başka bir alanın değeri değişince yeniden çek
}

export interface SettingsField {
  key: string;                   // 'stock.bufferQuantity'  (section.field)
  type: SettingsFieldType;
  labelKey: string;
  helpKey?: string;              // alan altındaki açıklama
  placeholderKey?: string;
  default?: unknown;
  required?: boolean;            // wizard'ın "zorunlu" saydığı alanlar
  readOnly?: boolean;
  secret?: boolean;              // secretsEncrypted'e yazılır, maskelenerek döner

  options?: SettingsFieldOption[];
  optionsSource?: SettingsOptionSource;

  min?: number; max?: number; step?: number;
  unitKey?: string;              // 'adet' | 'dakika' | '%' | '₺'
  pattern?: string;              // regex (string)
  maxLength?: number;

  visibleWhen?: SettingsCondition | SettingsCondition[];   // dizi = AND
  disabledWhen?: SettingsCondition | SettingsCondition[];

  /** mappingTable için */
  mapping?: {
    leftLabelKey: string;
    rightLabelKey: string;
    leftSource: SettingsOptionSource | SettingsFieldOption[];   // pazaryeri tarafı
    rightSource: SettingsOptionSource | SettingsFieldOption[];  // KroptOS tarafı
    allowUnmapped?: boolean;
  };

  colSpan?: 1 | 2;               // 2 kolonlu grid içinde
  badgeKey?: string;             // 'beta' | 'providerOnly' | 'advanced'
  /** Bu alanın etkin olması için gereken connector yeteneği */
  requiresCapability?: MarketplaceCapability;
}

export interface SettingsSection {
  id: string;                    // 'stock'
  titleKey: string;
  descriptionKey?: string;
  icon?: string;                 // heroicon adı (ör. 'CubeIcon')
  fields: SettingsField[];
  visibleWhen?: SettingsCondition | SettingsCondition[];
  collapsedByDefault?: boolean;
}

export interface SettingsTab {
  id: string;                    // 'orders'
  titleKey: string;
  icon?: string;
  sections: SettingsSection[];
}

export type MarketplaceCapability =
  | 'orders.read' | 'orders.updateStatus' | 'orders.cancel'
  | 'products.push' | 'products.read'
  | 'stock.push' | 'price.push'
  | 'categories.read' | 'attributes.read'
  | 'shipment.label' | 'shipment.track'
  | 'returns.read' | 'invoice.upload'
  | 'commission.read' | 'buybox.read';

export interface SettingsWizardStep {
  id: string;                    // 'stock'
  titleKey: string;
  descriptionKey?: string;
  tabId?: string;                // tüm sekme
  sectionIds?: string[];         // ya da belirli bölümler
  required: boolean;             // false = "Şimdilik atla" görünür
}

export interface ProviderSettingsManifest {
  provider: string;              // 'trendyol'
  displayName: string;
  version: number;               // schemaVersion
  capabilities: MarketplaceCapability[];
  credentials: SettingsField[];  // API bilgileri formu (Adım 1)
  tabs: SettingsTab[];
  wizard: SettingsWizardStep[];
  docsUrl?: string;              // "Nasıl alınır?" bağlantısı
}

/** Provider dosyalarının base üzerine yazdığı fark */
export interface ProviderSettingsOverride {
  provider: string;
  displayName: string;
  version?: number;
  capabilities: MarketplaceCapability[];
  credentials: SettingsField[];
  /** base'den kaldırılacak alan/bölüm anahtarları */
  omitFields?: string[];
  omitSections?: string[];
  /** base alanlarının üzerine yazılacak kısmi tanımlar: { 'stock.source': { default: 'warehouse' } } */
  patchFields?: Record<string, Partial<SettingsField>>;
  /** base sekmelerine eklenecek yeni bölümler */
  addSections?: Array<{ tabId: string; section: SettingsSection; position?: 'start' | 'end' }>;
  /** tamamen yeni sekme (ör. Trendyol'a özel) */
  addTabs?: SettingsTab[];
  wizardPatch?: Partial<Record<string, Partial<SettingsWizardStep>>>;
  docsUrl?: string;
}
```

---

## 5. Ortak (Base) Şema — Tüm Pazaryerleri İçin

`base.settings.ts`. Aşağıdaki tablo, **her pazaryerinde görünen** ortak sekme/bölüm/alan setidir.
Bir sağlayıcı ilgili yeteneğe sahip değilse (`requiresCapability`) alan otomatik gizlenir.

### Sekme 1 — Genel (`general`)

| Bölüm | Alan (`key`) | Tip | Varsayılan | Not |
|---|---|---|---|---|
| `general.connection` | `general.displayName` | text | — | Panelde görünen ad |
| | `general.isActive` | toggle | `true` | Kapalıysa hiçbir senkron çalışmaz |
| | `general.environment` | select | `production` | `production` / `sandbox` |
| | `general.storeScope` | resourceSelect (`/stores`) | aktif store | Entegrasyonun bağlı olduğu mağaza |
| | `general.currency` | select | `TRY` | |
| | `general.timezone` | select | `Europe/Istanbul` | Cron/cutoff hesapları için |
| `general.health` | `general.autoDisableOnErrorCount` | number | `10` | Ardışık hata sonrası pasife al |
| | `general.healthCheckIntervalMinutes` | number | `60` | |

### Sekme 2 — Siparişler (`orders`) · `requiresCapability: orders.read`

| Bölüm | Alan | Tip | Varsayılan | Not |
|---|---|---|---|---|
| `orders.import` | `orders.autoImport` | toggle | `true` | |
| | `orders.intervalMinutes` | select | `15` | 5/10/15/30/60 |
| | `orders.backfillDays` | number | `7` | İlk kurulumda geriye dönük çekim |
| | `orders.importStatuses` | multiselect | provider'a göre | Hangi durumlar çekilsin |
| | `orders.numberPrefix` | text | `TY-` | Dahili sipariş no ön eki |
| | `orders.skipTestOrders` | toggle | `true` | |
| `orders.statusMapping` | `orders.statusMap` | mappingTable | provider varsayılanı | Pazaryeri durumu → KroptOS durumu |
| `orders.automation` | `orders.autoAccept` | toggle | `false` | `requiresCapability: orders.updateStatus` |
| | `orders.autoCreateShipment` | toggle | `true` | |
| | `orders.splitByWarehouse` | toggle | `false` | Çok depolu ayrıştırma |
| | `orders.onCancelAction` | radioGroup | `restock` | `restock` / `keep` / `manual` |
| `orders.customer` | `orders.createCustomerRecord` | toggle | `true` | |
| | `orders.maskPII` | toggle | `true` | KVKK: adres/telefon maskesi |

### Sekme 3 — Ürün & Katalog (`catalog`) · `products.push`

| Bölüm | Alan | Tip | Varsayılan | Not |
|---|---|---|---|---|
| `catalog.push` | `catalog.autoPushNew` | toggle | `false` | Yeni ürün otomatik gönderilsin mi |
| | `catalog.updateMode` | radioGroup | `partial` | `full` / `partial` (yalnız değişen alan) |
| | `catalog.requireApproval` | toggle | `true` | Gönderim öncesi onay |
| `catalog.content` | `catalog.titleTemplate` | text | `{brand} {name}` | Şablon değişkenleri |
| | `catalog.descriptionSource` | select | `long` | `long` / `short` / `custom` |
| | `catalog.stripHtml` | toggle | `false` | |
| | `catalog.barcodeSource` | select | `barcode` | `barcode` / `sku` / `gtin` |
| | `catalog.imageOrder` | select | `default` | `default` / `mainFirst` / `custom` |
| | `catalog.maxImages` | number | `8` | |
| `catalog.defaults` | `catalog.defaultBrandId` | resourceSelect (`/brands`) | — | Markası olmayan ürünler için |
| | `catalog.defaultCategoryId` | resourceSelect | — | Eşleşmeyen kategori fallback'i |
| | `catalog.missingAttributePolicy` | radioGroup | `warn` | `block` / `warn` / `useDefault` |

### Sekme 4 — Stok (`stock`) · `stock.push`

| Bölüm | Alan | Tip | Varsayılan | Not |
|---|---|---|---|---|
| `stock.source` | `stock.source` | radioGroup | `allWarehouses` | `allWarehouses` / `selected` / `allocationRule` |
| | `stock.warehouseIds` | multiselect (`/warehouses`) | — | `visibleWhen: stock.source = selected` |
| | `stock.allocationRuleId` | resourceSelect | — | `visibleWhen: stock.source = allocationRule` |
| `stock.policy` | `stock.bufferQuantity` | number | `0` | Güvenlik payı (adet) |
| | `stock.bufferPercent` | percent | `0` | Alternatif yüzdesel pay |
| | `stock.maxCap` | number | — | Pazaryerine gönderilecek üst sınır |
| | `stock.minThreshold` | number | `1` | Altına düşünce 0 gönder |
| | `stock.oversellProtection` | toggle | `true` | |
| `stock.timing` | `stock.pushIntervalMinutes` | select | `15` | |
| | `stock.realtimeOnOrder` | toggle | `true` | Sipariş sonrası anlık güncelle |
| | `stock.batchSize` | number | `200` | |
| `stock.zero` | `stock.onZeroAction` | radioGroup | `sendZero` | `sendZero` / `deactivateListing` / `ignore` |

### Sekme 5 — Fiyatlandırma (`pricing`) · `price.push`

| Bölüm | Alan | Tip | Varsayılan | Not |
|---|---|---|---|---|
| `pricing.source` | `pricing.priceListId` | resourceSelect | — | |
| | `pricing.basePriceField` | select | `salePrice` | `salePrice` / `listPrice` / `campaignPrice` |
| | `pricing.vatIncluded` | toggle | `true` | |
| `pricing.markup` | `pricing.markupType` | radioGroup | `none` | `none` / `percent` / `fixed` |
| | `pricing.markupValue` | number | `0` | `visibleWhen: markupType != none` |
| | `pricing.rounding` | select | `none` | `none` / `x.99` / `x.90` / `nearest1` / `nearest5` |
| | `pricing.floorPrice` | money | — | Alt sınır |
| | `pricing.ceilPrice` | money | — | Üst sınır |
| `pricing.margin` | `pricing.commissionRate` | percent | — | `requiresCapability: commission.read` (bilgi amaçlı) |
| | `pricing.minMarginPercent` | percent | `0` | |
| | `pricing.blockBelowMargin` | toggle | `true` | Marj altına düşen fiyat gönderilmez |
| `pricing.timing` | `pricing.pushIntervalMinutes` | select | `60` | |
| | `pricing.requireApprovalOnDrop` | toggle | `true` | %X üzeri düşüşte onay iste |
| | `pricing.approvalDropPercent` | percent | `20` | |

### Sekme 6 — Kargo & Teslimat (`fulfillment`)

| Bölüm | Alan | Tip | Varsayılan | Not |
|---|---|---|---|---|
| `fulfillment.model` | `fulfillment.model` | radioGroup | `seller` | `seller` / `marketplace` (FBA, TYD vb.) |
| `fulfillment.carrier` | `fulfillment.carrierMap` | mappingTable | — | Pazaryeri kargo → KroptOS kargo |
| | `fulfillment.defaultCarrierId` | resourceSelect | — | |
| `fulfillment.timing` | `fulfillment.handlingDays` | number | `1` | Hazırlama süresi |
| | `fulfillment.cutoffTime` | time | `16:00` | |
| | `fulfillment.workingDays` | weekdays | Pzt–Cmt | |
| `fulfillment.label` | `fulfillment.labelSource` | radioGroup | `marketplace` | `requiresCapability: shipment.label` |
| | `fulfillment.autoPrintLabel` | toggle | `false` | |
| | `fulfillment.packageWeightSource` | select | `product` | `product` / `fixed` / `calculated` |

### Sekme 7 — İade & İptal (`returns`) · `returns.read`

| Alan | Tip | Varsayılan |
|---|---|---|
| `returns.autoImport` | toggle | `true` |
| `returns.intervalMinutes` | select | `60` |
| `returns.autoApproveUnderAmount` | money | `0` (kapalı) |
| `returns.restockOnApproval` | toggle | `true` |
| `returns.restockWarehouseId` | resourceSelect (`/warehouses`) | — |
| `returns.refundMode` | radioGroup (`auto`/`manual`) | `manual` |

### Sekme 8 — Fatura & Muhasebe (`invoicing`)

| Alan | Tip | Varsayılan | Not |
|---|---|---|---|
| `invoicing.autoInvoice` | toggle | `false` | |
| `invoicing.erpIntegrationId` | resourceSelect (`/integrations?providerType=erp`) | — | `visibleWhen: autoInvoice = true` |
| `invoicing.invoiceType` | select | `e-archive` | `e-archive` / `e-invoice` |
| `invoicing.trigger` | radioGroup | `onShip` | `onOrder` / `onShip` / `onDeliver` |
| `invoicing.uploadToMarketplace` | toggle | `true` | `requiresCapability: invoice.upload` |
| `invoicing.seriesPrefix` | text | — | |

### Sekme 9 — Bildirim & Hata Yönetimi (`notifications`)

| Bölüm | Alan | Tip | Varsayılan |
|---|---|---|---|
| `notifications.channels` | `notifications.channels` | multiselect (`inApp`,`email`,`slack`,`webhook`) | `['inApp']` |
| | `notifications.emails` | tags | — |
| | `notifications.webhookUrl` | text | — |
| | `notifications.webhookSecret` | password (**secret**) | — |
| `notifications.events` | `notifications.events` | multiselect | `syncFailed`, `authFailed`, `stockMismatch`, `priceBlocked`, `newOrder` |
| `notifications.retry` | `notifications.maxRetry` | number | `3` |
| | `notifications.backoffStrategy` | select | `exponential` |
| | `notifications.pauseOnCritical` | toggle | `true` |

### Sekme 10 — Gelişmiş (`advanced`)

| Alan | Tip | Varsayılan | Not |
|---|---|---|---|
| `advanced.dryRun` | toggle | `false` | Yazma işlemleri simüle edilir, log'a yazılır |
| `advanced.rateLimitPerMinute` | number | provider varsayılanı | `MarketplaceRateLimiter`'a beslenir |
| `advanced.requestTimeoutMs` | number | `30000` | |
| `advanced.concurrency` | number | `3` | BullMQ worker eşzamanlılığı |
| `advanced.logLevel` | select | `info` | `debug`/`info`/`warn`/`error` |
| `advanced.logRetentionDays` | number | `30` | |
| `advanced.customHeaders` | keyValue | — | `badgeKey: 'advanced'` |

> **Not:** `advanced.rateLimitPerMinute` mevcut `MarketplaceRateLimiter.throttle(provider, limit, window)`
> çağrısındaki sabit değerin (ör. Trendyol `100`) yerine geçer.

---

## 6. Sağlayıcıya Özel Katmanlar

Her provider dosyası yalnızca **farkı** yazar. Aşağıdaki `credentials` tanımları,
`MarketplaceCredentialService.validate()` içindeki mevcut zorunlu anahtarlarla birebir eşleşir.

### `trendyol.settings.ts`

```ts
export const trendyolOverride: ProviderSettingsOverride = {
  provider: 'trendyol',
  displayName: 'Trendyol',
  capabilities: [
    'orders.read', 'orders.updateStatus', 'products.push', 'products.read',
    'stock.push', 'price.push', 'categories.read', 'attributes.read',
    'shipment.label', 'returns.read', 'commission.read', 'buybox.read',
  ],
  credentials: [
    { key: 'apiKey',    type: 'password', labelKey: '...apiKey',    required: true, secret: true },
    { key: 'apiSecret', type: 'password', labelKey: '...apiSecret', required: true, secret: true },
    { key: 'sellerId',  type: 'text',     labelKey: '...sellerId',  required: true,
      helpKey: '...sellerIdHelp', pattern: '^[0-9]+$' },
  ],
  addSections: [{
    tabId: 'fulfillment',
    section: {
      id: 'trendyol.shipment',
      titleKey: 'integrations.settings.sections.trendyolShipment.title',
      fields: [
        { key: 'trendyol.shipmentAddressId', type: 'resourceSelect', labelKey: '...',
          optionsSource: { endpoint: '/integrations/{id}/trendyol/addresses', valueField: 'id', labelField: 'label' },
          required: true },
        { key: 'trendyol.returnAddressId', type: 'resourceSelect', labelKey: '...', required: true,
          optionsSource: { endpoint: '/integrations/{id}/trendyol/addresses', valueField: 'id', labelField: 'label' } },
        { key: 'trendyol.fastDelivery', type: 'toggle', labelKey: '...', default: false },
        { key: 'trendyol.buyboxStrategy', type: 'select', labelKey: '...', default: 'off',
          requiresCapability: 'buybox.read',
          options: [{ value: 'off', labelKey: '...' }, { value: 'matchLowest', labelKey: '...' },
                    { value: 'minMargin', labelKey: '...' }] },
      ],
    },
  }],
  patchFields: {
    'orders.numberPrefix': { default: 'TY-' },
    'advanced.rateLimitPerMinute': { default: 100 },
  },
  docsUrl: 'https://developers.trendyol.com',
};
```

### Diğer sağlayıcılar — özet fark tablosu

| Provider | `credentials` (mevcut validate ile aynı) | Özel alanlar | Kapatılan (`omit`) |
|---|---|---|---|
| **Hepsiburada** | `merchantId`, `apiKey`, `apiSecret` | `hb.listingMode` (`listing`/`product`), `hb.deliveryProfileId` (zorunlu), `hb.fastDelivery`, `hb.cargoCompanyCode` | — |
| **N11** | `apiKey`, `apiSecret` | `n11.shipmentTemplate` (**zorunlu**), `n11.preparingDay` (1–7), `n11.catalogMatch` (toggle) | `fulfillment.labelSource` (etiket yok) |
| **Amazon** | `sellerId`, `awsAccessKey`, `awsSecretKey`, `refreshToken` | `amazon.region` (`eu`/`na`/`fe`), `amazon.marketplaceIds` (multiselect), `amazon.fulfillmentChannel` (`FBA`/`FBM`), `amazon.feedType`, `amazon.mfnShippingTemplate` | `invoicing.uploadToMarketplace` |
| **ÇiçekSepeti** | `apiKey` | `cs.deliveryType` (`sameDay`/`standard`), `cs.deliveryCities` (multiselect), `cs.messageCardSupport`, `cs.preparationHours` | `catalog.maxImages` (5 sabit), `buybox` alanları |

> **Kural:** Provider'a özel bir alanın anahtarı **daima `<provider>.` ön ekiyle** başlar
> (`trendyol.fastDelivery`). Böylece base alanlarıyla çakışma imkânsızdır.

### Manifest çözümleme (resolve) sırası

```
1. BASE_MANIFEST (derin kopya)
2. + override.patchFields          (base alanların üzerine kısmi yazma)
3. − override.omitFields / omitSections
4. + override.addSections / addTabs
5. − requiresCapability ∉ override.capabilities olan alanlar
6. − boş kalan bölümler ve sekmeler
7. + override.credentials, wizardPatch, docsUrl
=> ResolvedManifest (schemaVersion = override.version ?? base.version)
```

`manifest.merge.ts` bu adımları **saf fonksiyon** olarak uygular ve birim testi yazılır.

---

## 7. Backend Modülü

`packages/backend/src/modules/integration-settings/` — `02_BACKEND_MODULE_ANATOMY.md` iskeleti birebir.

### 7.1 Endpoint'ler

Controller: `@Controller('/api/integrations')`, guard zinciri
`AuthGuard('jwt') + TenantGuard + PermissionGuard`.

| Method | Path | İzin | Açıklama |
|---|---|---|---|
| `GET` | `/:id/settings/schema` | `integrations.read` | Çözümlenmiş manifest (dinamik seçenekler dahil) |
| `GET` | `/:id/settings` | `integrations.read` | `{ values, defaults, effective, isConfigured, completedSteps, schemaVersion, missingRequired[] }` |
| `PUT` | `/:id/settings` | `integrations.settings.update` | Tam kaydet (doğrulama + revizyon + audit) |
| `PATCH` | `/:id/settings` | `integrations.settings.update` | Bölüm/kısmi kaydet |
| `POST` | `/:id/settings/validate` | `integrations.read` | Kaydetmeden doğrula → `{ valid, errors[] }` |
| `POST` | `/:id/settings/reset` | `integrations.settings.update` | `{ sectionId? }` → varsayılana dön |
| `GET` | `/:id/settings/revisions` | `integrations.read` | Son N revizyon |
| `POST` | `/:id/settings/revisions/:version/restore` | `integrations.settings.update` | Geri al |
| `POST` | `/:id/settings/wizard/complete` | `integrations.settings.update` | `{ stepId }` → `completedSteps` güncelle, hepsi bitince `isConfigured = true` |
| `GET` | `/settings/providers` | `integrations.read` | Desteklenen pazaryerleri + `displayName`, `docsUrl`, `capabilities` |
| `GET` | `/settings/providers/:provider/schema` | `integrations.read` | **Entegrasyon oluşturulmadan önce** credential formu için |

HTTP kodları: `GET/PUT/PATCH/POST(aksiyon)` → `200`, hata → `422` (alan hataları), `404`, `403`.

### 7.2 Service sözleşmesi

```ts
@Injectable()
export class IntegrationSettingsService {
  constructor(
    private prisma: PrismaService,
    private integrationService: IntegrationService,      // get() ile tenant doğrulaması yeniden kullanılır
    private registry: MarketplaceSettingsRegistry,
    private validator: SettingsValidator,
  ) {}

  /** Manifest + kayıtlı değerler + varsayılanlar */
  async getEffective(integrationId: string, ctx: TenantCtx): Promise<EffectiveSettings>;

  /** Worker/connector'ın kullandığı hızlı okuma — Redis'te 60 sn cache */
  async resolveForRuntime(integrationId: string): Promise<Record<string, unknown>>;

  async save(integrationId: string, values: Record<string, unknown>, userId: string, ctx, ip): Promise<EffectiveSettings>;
  async validateOnly(integrationId: string, values: Record<string, unknown>, ctx): Promise<ValidationResult>;
  async reset(integrationId: string, sectionId: string | undefined, userId: string, ctx, ip): Promise<EffectiveSettings>;
  async completeWizardStep(integrationId: string, stepId: string, userId: string, ctx): Promise<EffectiveSettings>;
}
```

Zorunlu davranışlar (`02_BACKEND_MODULE_ANATOMY.md` §5 ile aynı):

- Her sorguda `agencyId/clientId/storeId` filtresi + `deletedAt: null`.
- Her mutasyonda `AuditLog` (`action: 'integration.settings.update'`, `oldValue`/`newValue` diff).
- Kayıt `$transaction` içinde: `IntegrationSetting.upsert` + `IntegrationSettingRevision.create`.
- **Bilinmeyen anahtarlar reddedilir** (manifest'te olmayan `key` → `422`).
- `secret: true` alanları ayrıştırılıp `secretsEncrypted`'e; okumada `maskSecret()`.
- Değer değişince `resolveForRuntime` Redis cache'i invalidate edilir.

### 7.3 Doğrulama (`settings.validator.ts`)

Manifest'i gezerek generic doğrulama yapar; provider bazlı `if` yoktur.

```ts
interface ValidationError { key: string; messageKey: string; params?: Record<string, unknown>; }

// Sırayla:
// 1. visibleWhen değerlendir  → görünmeyen alan doğrulanmaz, değeri temizlenir
// 2. required && boş          → 'validation.required'
// 3. type kontrolü            → number/percent/money sayısal, toggle boolean, ...
// 4. min/max/step, maxLength, pattern
// 5. select/multiselect       → değer options içinde mi
// 6. resourceSelect           → ilgili kayıt tenant kapsamında var mı (DB kontrolü)
// 7. mappingTable             → allowUnmapped=false ise tüm sol değerler eşlenmiş mi
// 8. Çapraz kurallar (cross-field, aşağıya bak)
```

**Çapraz kurallar** (base'de sabit, `crossRules` dizisi olarak tanımlı):

| Kural | Mesaj |
|---|---|
| `stock.source = 'selected'` → `stock.warehouseIds` boş olamaz | `validation.warehouseRequired` |
| `pricing.floorPrice` ≤ `pricing.ceilPrice` | `validation.floorAboveCeil` |
| `pricing.markupType != 'none'` → `markupValue > 0` | `validation.markupValueRequired` |
| `invoicing.autoInvoice = true` → `erpIntegrationId` zorunlu | `validation.erpRequired` |
| `notifications.channels` içinde `webhook` → `webhookUrl` zorunlu ve `https://` | `validation.webhookUrlRequired` |
| `orders.autoImport = true` → `orders.importStatuses` en az 1 | `validation.statusRequired` |

### 7.4 Mevcut kodda yapılacak değişiklikler

| Dosya | Değişiklik |
|---|---|
| `MarketplaceCredentialService.validate()` | if/else zinciri kaldırılır; `registry.getManifest(provider).credentials` üzerinden `required` alanlar kontrol edilir. **Davranış birebir korunur.** |
| `MarketplaceConnector` (abstract) | Constructor'a `protected readonly settings: Record<string, unknown>` eklenir |
| `MarketplaceConnectorFactory.create()` | 3. parametre `settings` alır; her connector'a geçirir |
| `IntegrationService.triggerSync()` | **Guard:** `isConfigured === false` ise `BadRequestException('integration.settings.notConfigured')` |
| `IntegrationService.create()` | Oluşturmadan sonra varsayılanlarla `IntegrationSetting` kaydı açar (`isConfigured: false`) |
| `IntegrationService.delete()` | Soft delete → `IntegrationSetting.deletedAt` da işaretlenir |
| `integration-queue` / worker | Job payload'a `settings` eklenir (`resolveForRuntime`); rate limit ve batch size oradan okunur |
| `app.module.ts` | `IntegrationSettingsModule` imports'a eklenir |
| `prisma/seed.ts` | Yeni RBAC izinleri: `integrations.settings.read`, `integrations.settings.update` |

---

## 8. Frontend

### 8.1 Dosya yapısı

```
src/app/t/[tenantPublicId]/integrations/marketplace/
├── page.tsx                              # mevcut liste — satıra "Ayarlar" aksiyonu + rozet eklenir
├── hooks/
│   ├── useMarketplaceIntegrations.ts     # (mevcut page.tsx mantığı hook'a taşınır — konvansiyon §3)
│   └── useIntegrationSettings.ts         # şema + değer + dirty + kaydet
└── components/
    ├── IntegrationSettingsDrawer.tsx     # sağdan geniş drawer: sol dikey sekme + sağ içerik
    ├── IntegrationSetupWizard.tsx        # ilk kurulum sihirbazı (modal, adım göstergeli)
    ├── SettingsSchemaRenderer.tsx        # manifest → bölüm/alan render
    ├── SettingsSectionCard.tsx
    ├── SettingsDirtyBar.tsx              # yapışkan "Kaydet / Vazgeç" barı
    ├── SettingsCompletenessBadge.tsx     # "Yapılandırılmadı" / "3 zorunlu alan eksik"
    └── fields/
        ├── index.ts                      # FIELD_REGISTRY
        ├── TextField.tsx  NumberField.tsx  PasswordField.tsx  ToggleField.tsx
        ├── SelectField.tsx  MultiSelectField.tsx  RadioGroupField.tsx
        ├── TimeField.tsx  WeekdaysField.tsx  TagsField.tsx  KeyValueField.tsx
        ├── ResourceSelectField.tsx        # optionsSource'tan apiFetch ile çeker
        ├── MappingTableField.tsx
        └── InfoField.tsx
```

### 8.2 `FIELD_REGISTRY` — motorun kalbi

```tsx
// components/fields/index.ts
import type { SettingsFieldType } from '@kroptos/shared';

export interface FieldProps<T = unknown> {
  field: SettingsField;
  value: T;
  error?: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}

export const FIELD_REGISTRY: Record<SettingsFieldType, React.FC<FieldProps<any>>> = {
  text: TextField,       textarea: TextareaField,   password: PasswordField,
  number: NumberField,   percent: PercentField,     money: MoneyField,
  toggle: ToggleField,   select: SelectField,       multiselect: MultiSelectField,
  radioGroup: RadioGroupField,
  time: TimeField,       duration: DurationField,   weekdays: WeekdaysField,
  tags: TagsField,       keyValue: KeyValueField,
  resourceSelect: ResourceSelectField,
  mappingTable: MappingTableField,
  info: InfoField,
};
```

> **Yeni bir alan tipi eklemek = 1 bileşen + 1 registry satırı.** Sayfa kodu değişmez.

### 8.3 `SettingsSchemaRenderer` sözleşmesi

```tsx
'use client';

interface Props {
  manifest: ResolvedManifest;
  activeTabId: string;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
}
```

Davranış:

1. `manifest.tabs.find(t => t.id === activeTabId)` → bölümleri sırayla `SettingsSectionCard` ile basar.
2. Her alan için `visibleWhen` / `disabledWhen` koşulunu `values` üzerinden değerlendirir
   (paylaşılan saf fonksiyon: `evaluateCondition(cond, values)` — `packages/shared` içinde,
   backend validator ile **aynı** fonksiyon).
3. Görünür alanı `FIELD_REGISTRY[field.type]` ile render eder; bilinmeyen tip → `console.warn` + atla.
4. Etiket/yardım metni `useTranslations()` ile `field.labelKey`'den okunur.
5. Grid: `grid grid-cols-1 md:grid-cols-2 gap-4`; `colSpan: 2` → `md:col-span-2`.
6. Stil yalnızca `kp-*` token'ları, ikonlar `@heroicons/react/24/outline` (konvansiyon §6/§5).

### 8.4 `useIntegrationSettings` hook'u

```tsx
export function useIntegrationSettings(integrationId: string | null) {
  // apiFetch<ResolvedManifest>(`/integrations/${id}/settings/schema`)
  // apiFetch<EffectiveSettings>(`/integrations/${id}/settings`)
  return {
    manifest, values, defaults, errors,
    isLoading, isSaving, error,
    isDirty, dirtyKeys,
    activeTabId, setActiveTabId,
    setValue,            // (key, value) => void — dirty işaretler, o alanın hatasını temizler
    save,                // PUT — 422 gelirse errors'a maplenir ve ilk hatalı sekmeye atlar
    saveSection,         // PATCH
    resetSection,
    validate,            // POST /validate — sihirbaz adım geçişinde
    completeStep,
    missingRequired,     // string[] — rozet ve sync guard'ı için
    reload,
  };
}
```

Kurallar: veri erişimi **yalnız `apiFetch`** ile; `tenantContext` `useAuth()`'tan;
sayfa mantığı hook'ta, `page.tsx` sadece kompozisyon (konvansiyon §2/§3).

### 8.5 Drawer düzeni

```
┌─ IntegrationSettingsDrawer ────────────────────────────────────────────────┐
│ ⚙ Trendyol – Ana Mağaza          [● Bağlı]  [Bağlantıyı Test Et]     ✕     │
├──────────────┬─────────────────────────────────────────────────────────────┤
│ Genel        │  Stok                                                        │
│ Siparişler   │  ┌ Stok Kaynağı ─────────────────────────────────────────┐  │
│ Ürün&Katalog │  │ ( ) Tüm depolar   (•) Seçili depolar   ( ) Kural      │  │
│ ▸ Stok    ●  │  │ Depolar: [İstanbul Ana ×] [İzmir ×]              (+)  │  │
│ Fiyatlandırma│  └───────────────────────────────────────────────────────┘  │
│ Kargo     ⚠  │  ┌ Stok Politikası ──────────────────────────────────────┐  │
│ İade         │  │ Güvenlik Payı [ 5 ] adet    Üst Sınır [    ]          │  │
│ Fatura       │  │ Aşırı Satış Koruması  [ON ]                           │  │
│ Bildirimler  │  └───────────────────────────────────────────────────────┘  │
│ Gelişmiş     │                                                              │
├──────────────┴─────────────────────────────────────────────────────────────┤
│ ● 3 değişiklik kaydedilmedi          [ Vazgeç ]  [ Değişiklikleri Kaydet ]  │
└────────────────────────────────────────────────────────────────────────────┘
```

- `●` = o sekmede kaydedilmemiş değişiklik, `⚠` = o sekmede doğrulama hatası / eksik zorunlu alan.
- Alt bar (`SettingsDirtyBar`) yalnız `isDirty` iken görünür (`animate-fade-in-up`).
- Drawer kapatılırken `isDirty` ise onay sorulur.

---

## 9. Kurulum Akışı (Sihirbaz)

Kullanıcının talebindeki "API bilgileri girildikten sonra ayarları yapmasını isteyebileceğimiz" akış:

```
[+ Entegrasyon Ekle]
      │
      ▼
Adım 1 · Pazaryeri Seç       GET /integrations/settings/providers
      │                       (kart listesi: logo, displayName, capabilities)
      ▼
Adım 2 · API Bilgileri       GET /settings/providers/:provider/schema → manifest.credentials
      │                       aynı SettingsSchemaRenderer ile render edilir
      │                       "Nasıl alınır?" → docsUrl
      ▼
Adım 3 · Bağlantı Testi      POST /integrations           (kayıt oluşur, isConfigured=false)
      │                       POST /integrations/:id/test-connection
      │                       ✗ başarısız → Adım 2'ye dön, hata mesajı alan altında
      ▼
Adım 4 · Yapılandırma        manifest.wizard adımları sırayla:
      │                        1. Stok Kaynağı      (zorunlu)
      │                        2. Fiyatlandırma     (zorunlu)
      │                        3. Sipariş Akışı     (zorunlu)
      │                        4. Kargo & Teslimat  (zorunlu)
      │                        5. Fatura            (atlanabilir)
      │                        6. Bildirimler       (atlanabilir)
      │                       her "İleri" → POST /settings/validate (o adımın alanları)
      │                       her adım sonunda → POST /settings/wizard/complete { stepId }
      ▼
Adım 5 · Özet & Aktifleştir  tüm zorunlu adımlar ✓ → isConfigured = true
                              [İlk Senkronizasyonu Başlat] → POST /integrations/:id/sync
```

### Yapılandırılmamış entegrasyonun görünümü

- Liste satırında turuncu rozet: **"Yapılandırma Bekliyor"** + eksik alan sayısı.
- `Senkronize Et` butonu **disabled**, tooltip: `"Önce entegrasyon ayarlarını tamamlayın"`.
- Backend `triggerSync` ayrıca sunucu tarafında `422` döner (UI'a güvenilmez).
- `IntegrationTree` bileşeninde ilgili düğüm uyarı rengiyle işaretlenir.
- Sihirbaz yarıda bırakılırsa durum korunur; satırdaki **"Kuruluma Devam Et"** aksiyonu
  `completedSteps`'in bittiği adımdan açar.

---

## 10. Güvenlik, İzin ve Denetim

### RBAC

| İzin | Kim | Kapsam |
|---|---|---|
| `integrations.read` | Operatör+ | Ayarları görüntüleme (sırlar maskeli) |
| `integrations.settings.update` | Yönetici+ | Ayar kaydetme / sıfırlama / geri alma |
| `integrations.create` | Yönetici+ | Entegrasyon ekleme, credential değiştirme |

`advanced` sekmesi ve `secret` alanları yalnızca `integrations.settings.update` iznine sahip
kullanıcılara **render edilir**; backend de aynı kontrolü tekrarlar.

### Sır yönetimi

- `secret: true` alanları API yanıtında **asla ham dönmez** → `"••••4821"` (son 4 hane).
- Kullanıcı alanı boş bırakırsa mevcut değer korunur (mevcut `update()` merge davranışıyla aynı).
- `values` JSON'ı log'lara, `ApiLog.requestBody`'ye ve audit `newValue`'ya yazılırken
  `redactSecrets(manifest, values)` uygulanır → `'[REDACTED]'`.
- KVKK: `orders.maskPII` açıkken müşteri adres/telefonu log ve dışa aktarımlarda maskelenir.

### Denetim

Her kayıtta `AuditLog`:

```json
{
  "action": "integration.settings.update",
  "module": "integration",
  "entityType": "integration",
  "entityId": "<integrationId>",
  "entityDisplayName": "Trendyol – Ana Mağaza",
  "oldValue": { "stock.bufferQuantity": 0 },
  "newValue": { "stock.bufferQuantity": 5 },
  "severity": "info"
}
```

Kritik alanlar (`stock.source`, `pricing.markupType`, `pricing.floorPrice`, `general.isActive`,
`advanced.dryRun`) değiştiğinde `severity: "warning"` yazılır.

---

## 11. i18n

Anahtar şeması — `messages/tr.json` ve `messages/en.json`'a **eş zamanlı** eklenir
(konvansiyon §7). Diğer 10 dil `en` fallback'iyle çalışır.

```
integrations.settings.tabs.<tabId>.title
integrations.settings.sections.<sectionId>.title
integrations.settings.sections.<sectionId>.description
integrations.settings.fields.<key>.label
integrations.settings.fields.<key>.help
integrations.settings.fields.<key>.placeholder
integrations.settings.options.<key>.<value>
integrations.settings.validation.<code>
integrations.settings.wizard.steps.<stepId>.title
integrations.settings.providers.<provider>.displayName
```

> `key` içindeki nokta i18n'de korunur: `integrations.settings.fields.stock.bufferQuantity.label`.
> Manifest'te `labelKey` **tam yol** olarak yazılır; renderer kısaltma/tahmin yapmaz.

---

## 12. Test Planı

### Backend

| Dosya | Kapsam |
|---|---|
| `manifest.merge.spec.ts` | patch/omit/add/capability filtresi; boş bölüm temizliği; base mutasyona uğramaz |
| `settings.validator.spec.ts` | required, tip, min/max, pattern, options, `visibleWhen` ile atlanan alan, 6 çapraz kural |
| `integration-settings.service.spec.ts` | tenant izolasyonu (`ForbiddenException`), bilinmeyen anahtar `422`, upsert+revision transaction, secret redaction, defaults merge, cache invalidation |
| `integration.service.spec.ts` (güncelle) | `triggerSync` → `isConfigured=false` ise `BadRequestException` |

### Frontend

- `SettingsSchemaRenderer`: sahte manifest ile tüm alan tipleri render olur; `visibleWhen`
  değişince alan görünür/gizlenir; bilinmeyen tip çökertmez.
- `useIntegrationSettings`: dirty takibi, `422` → `errors` map'i, ilk hatalı sekmeye atlama.
- Sihirbaz: zorunlu adım doğrulanmadan "İleri" çalışmaz; yarıda çıkış → devam edilebilir.

---

## 13. Uygulama Sırası (PR Planı)

| PR | İçerik | Bağımlılık |
|---|---|---|
| **1** | `packages/shared` tip tanımları + `evaluateCondition` saf fonksiyonu | — |
| **2** | `base.settings.ts`, `manifest.merge.ts`, `manifest.registry.ts` + testler | 1 |
| **3** | Prisma `IntegrationSetting` + `IntegrationSettingRevision` + migration | — |
| **4** | `integration-settings` NestJS modülü (controller/service/dto/validator) + testler | 2, 3 |
| **5** | `fields/` bileşenleri + `FIELD_REGISTRY` + `SettingsSchemaRenderer` | 1 |
| **6** | `useIntegrationSettings` + `IntegrationSettingsDrawer` + liste sayfasına aksiyon | 4, 5 |
| **7** | `IntegrationSetupWizard` + liste rozetleri + `triggerSync` guard'ı | 6 |
| **8** | Provider manifest'leri (5 sağlayıcı) + `CredentialService` refactor + connector'a `settings` geçirme | 2, 4 |
| **9** | i18n anahtarları (`tr`, `en`) + revizyon/geri alma UI'ı | 6 |

> PR 1–4 backend'i tek başına çalışır kılar (Swagger'dan test edilebilir).
> PR 5–7 UI'ı ayağa kaldırır. PR 8 mevcut if/else duplikasyonunu siler.

---

## 14. Yeni Pazaryeri Ekleme — Nihai Kontrol Listesi

Bu sistem kurulduktan sonra yeni bir pazaryeri (ör. Pazarama, Shopify) eklemek:

- [ ] `integrations/marketplaces/<provider>/` → `Connector` + `Mapper` + `Types` (mevcut kalıp)
- [ ] `MarketplaceConnectorFactory`'ye `case` ekle
- [ ] `settings/providers/<provider>.settings.ts` → `ProviderSettingsOverride` yaz
      (`capabilities`, `credentials`, gerekiyorsa `patchFields` / `addSections` / `omitFields`)
- [ ] `manifest.registry.ts`'e kaydet
- [ ] `messages/tr.json` + `en.json` → yalnızca **yeni** alanların i18n anahtarları
- [ ] Prisma değişikliği **yok**, frontend değişikliği **yok**, backend controller/service değişikliği **yok**

> Hedef: yeni pazaryeri = **2 dosya + 1 registry satırı + i18n**. Formlar, doğrulama, sihirbaz,
> drawer ve audit otomatik gelir.

### Genişleme notu (kapsam dışı, ileriye dönük)

`providerType`'ı manifest'e bir alan olarak eklemek, aynı motorun **ERP (Logo)**, **kargo** ve
**ödeme** entegrasyonlarına da uygulanmasını sağlar: `base.settings.ts` yerine
`base.<providerType>.settings.ts` dosyaları, registry `(providerType, provider)` çifti ile
çözümleme yapar. Bu doküman kapsamında **yalnızca pazaryerleri** uygulanacaktır.

---

## 15. Kabul Kriterleri

1. `/integrations/marketplace` listesinde her satırda **Ayarlar** aksiyonu var; drawer 10 sekmeyi
   manifest'ten üretiyor ve kodda hiçbir yerde `if (provider === '...')` geçmiyor.
2. Yeni entegrasyon eklendiğinde credential formu manifest'ten üretiliyor; başarılı bağlantı
   testinden sonra yapılandırma sihirbazı otomatik açılıyor.
3. Zorunlu adımlar tamamlanmadan `Senkronize Et` hem UI'da hem API'de engelleniyor.
4. Ayar kaydı `IntegrationSettingRevision` + `AuditLog` üretiyor; sırlar hiçbir yanıtta,
   log'da veya audit kaydında ham görünmüyor.
5. Worker/connector, sabit değerler yerine `resolveForRuntime()` sonucunu kullanıyor
   (stok payı, rate limit, batch size, dry-run).
6. Trendyol için `trendyol.shipmentAddressId`, N11 için `n11.shipmentTemplate` gibi
   sağlayıcıya özel zorunlu alanlar sihirbazda çıkıyor ve doğrulanıyor.
7. Tüm yeni metinler `tr.json` + `en.json` içinde; UI'da hard-coded metin yok.
8. Tüm stil `kp-*` token'ları ile; ham hex renk yok.
