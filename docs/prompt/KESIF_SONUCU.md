# P-KEŞİF — Zemin Tespiti Sonucu

Kaynak görev: `docs/prompt/00_IYILESTIRME_PAKETI.md` › Blok C › P-KEŞİF
Tarih: 2026-08-06
**Dal: `wip/erp-warehouse-split`** (commit'lenmemiş çalışma ağacı dahil)
Yöntem: yalnızca `packages/` altındaki kod okundu. `docs/` altındaki dokümanlar kaynak olarak
KULLANILMADI (paketin YASAKLAR kuralı gereği).

> Bu tespitin hangi bulgularının dala özel olduğu → en alttaki
> **"Dal Farkı: `wip/erp-warehouse-split` vs `main`"** bölümü.

---

## 1. `setGlobalPrefix()` var mı? Gerçek endpoint yolu nedir?

**HAYIR — `app.setGlobalPrefix()` çağrısı YOK.**

`packages/backend/src/main.ts` toplam 58 satır. `NestFactory.create` (satır 7) ile `app.listen`
(satır 49) arasında yalnızca `express.json`, `ValidationPipe`, `enableCors` ve Swagger kurulumu
var. Prefix çağrısı hiç geçmiyor.

Dolayısıyla **gerçek yol = controller'ın kendi yazdığı yol**. Controller'lar zaten
`@Controller('/api/products')` yazdığına göre:

| | |
|---|---|
| Gerçek endpoint | `/api/products` ✅ |
| `/api/api/products` | ❌ oluşmuyor |
| Swagger UI | `http://localhost:3001/api/docs` (`main.ts:46`) |
| Port | `API_PORT` ?? `3001` (`main.ts:48`) |

### Frontend tarafı da tutarlı

`packages/frontend/src/lib/api.ts:9` → `baseUrl = NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'`
(aynı varsayılan `packages/frontend/next.config.js:6` ve `packages/frontend/.env.example:1`).
`api.ts:12` gelen path `/api` ile başlıyorsa ilk 4 karakteri kırpıyor.

Yani `apiFetch('/products')` ve `apiFetch('/api/products')` ikisi de
`http://localhost:3001/api/products` üretiyor. Çift prefix riski yok.

### ⚠️ ANCAK — `/api` prefix'i olmayan 3 controller var

35 controller'ın `@Controller(...)` taraması yapıldı; **üçü hariç** hepsi `/api/...` ile başlıyor:

| Dosya | Decorator | Gerçek yol | Frontend'in çağırdığı yol |
|---|---|---|---|
| `modules/integration-log/integration-log.controller.ts:6` | `@Controller('integration-logs')` | `/integration-logs` | `/api/integration-logs` |
| `modules/audit/audit.controller.ts:6` | `@Controller('audit-logs')` | `/audit-logs` | `/api/audit-logs` |
| `modules/files/files.controller.ts:6` | `@Controller('files')` | `/files` | — (frontend çağrısı yok) |

`packages/frontend/next.config.js` içinde API için rewrite/proxy YOK — satır 8-32'deki
rewrite'ların hepsi landing sayfası locale yönlendirmesi. Bu nedenle `/integration-logs` ve
`/audit-logs` çağrıları **404 döner**:

- `products/hooks/useProducts.ts:201`
- `orders/hooks/useOrders.ts:214`
- `integrations/errors/page.tsx:30`
- `system/audit-logs/page.tsx:26`
- `system/settings/components/AuditLogsShortcutPanel.tsx:9`

Ayrıca iki controller **bare** `@Controller()` kullanıp yolu metot seviyesinde yazıyor:
`modules/order/order.controller.ts:18` ve `modules/agency/agency.controller.ts:14`
(ör. `@Get('/api/orders')` — `order.controller.ts:30`). Sonuç doğru ama kalıp farklı.

---

## 2. `packages/shared/` altında ne var? Gerçekten import ediliyor mu?

**Var ve gerçekten kullanılıyor — ama iki farklı kaderi olan iki ayrı bölüm halinde.**

### Dosya envanteri (`packages/shared/src/`)

| Dosya | İçerik |
|---|---|
| `index.ts` | Barrel + elle yazılmış tipler: `AuthResponse`, `JWTPayload`, `Agency`, `Product`, `Order`, `ApiError` |
| `credentials.ts` | `CREDENTIAL_MASK`, `PUBLIC_CREDENTIAL_KEYS`, `isSecretCredentialKey`, `isMaskedValue`, `maskCredentials`, `stripMaskedCredentials` |
| `integration-settings/types.ts` | `ProviderSettingsManifest`, `SettingsSection`, `SettingsField`, `SettingsFieldType`, `SettingsFieldOption`, `SettingsOptionSource`, `ProviderSettingsOverride` |
| `integration-settings/condition.ts` | `evaluateCondition`, `collectFields`, `collectDefaults`, `isEmptyValue`, `findTabIdForField`, `missingRequiredKeys` |
| `integration-settings/index.ts` | barrel |

Paket her iki tarafa da bağlı: `packages/backend/package.json:18` ve
`packages/frontend/package.json:16` → `"@kroptos/shared": "workspace:*"`.

### A) Yoğun kullanılan bölüm: `credentials` + `integration-settings`

**Backend (11 dosya):**
`modules/integration-settings/integration-settings.service.ts:15,21` ·
`modules/integration/integration.service.ts:12` ·
`modules/integration/integration.controller.ts:10` ·
`integrations/marketplaces/settings/settings.validator.ts:8,9` ·
`integrations/marketplaces/settings/manifest.registry.ts:6` ·
`integrations/marketplaces/settings/manifest.merge.ts:8` ·
`integrations/marketplaces/settings/base.settings.ts:7` ·
`integrations/marketplaces/settings/providers/{trendyol,n11,hepsiburada,ciceksepeti,amazon}.settings.ts:1`
(+ testler: `settings.validator.spec.ts:1`, `manifest.merge.spec.ts:1,2`)

**Frontend (8 dosya):**
`integrations/marketplace/hooks/useIntegrationSettings.ts:10,11` ·
`integrations/marketplace/components/SettingsSectionCard.tsx:7` ·
`integrations/marketplace/components/SettingsSchemaRenderer.tsx:3,4` ·
`integrations/marketplace/components/IntegrationSetupWizard.tsx:15` ·
`integrations/marketplace/components/IntegrationCredentialsModal.tsx:7,8` ·
`integrations/marketplace/components/fields/MappingTableField.tsx:5` ·
`integrations/marketplace/components/fields/index.ts:4` ·
`integrations/marketplace/components/fields/FieldShell.tsx:4` ·
`warehouses/components/StockSourceSelector.tsx:6`

### B) ÖLÜ bölüm: `index.ts` içindeki 6 domain tipi

`Agency`, `Product`, `Order`, `AuthResponse`, `JWTPayload`, `ApiError` tiplerini
**hiçbir dosya import etmiyor**. `@kroptos/shared` aramasının 30+ sonucunun tamamı
`credentials` veya `integration-settings` sembollerine gidiyor; bu 6 tipe giden tek bir import yok.

Üstelik bu tipler koddan **ciddi biçimde sapmış** — P2'nin girdisi olarak kritik:

| Shared `Product` (`index.ts:37-47`) | Gerçek Prisma modeli (`schema.prisma:257-267`) |
|---|---|
| 8 alan | `price`, `basePrice`, `costPrice`, `weight`, `width`, `height`, `depth` + onlarca alan |
| `basePrice: number` | `basePrice Decimal @db.Decimal(10,2)` |
| `agencyId` var; `storeId`/`clientId` YOK | üçü de var |

`JWTPayload` (`index.ts:17-25`) `tenantId` + `role: string` diyor; gerçek payload
`tenant.middleware.ts:48-53`'te `userId`/`sub`, `tenantId`, `agencyId`, `clientId`, `role`,
`permissions` okuyor — `agencyId` ve `clientId` shared tipte yok.

**Özet:** `packages/shared` "mevcut ama kullanılmıyor" değil — **yarısı aktif, yarısı ölü ve
yanıltıcı**. P2 bu ayrımı korumalı: aktif yarıya dokunmadan ölü yarı gerçek koddan yeniden
türetilmeli.

---

## 3. Controller'ların tenant bağlamı grupları

### ÖNEMLİ ÖN BULGU — `TenantGuard` sanılan iş bölümünü yapmıyor

Paketteki P1 tespiti "TenantGuard kullananlar / kullanmayanlar" ayrımı kuruyor. Kod bunu
desteklemiyor:

1. **`TenantMiddleware` GLOBAL çalışıyor.** `app.module.ts:55` →
   `consumer.apply(TenantMiddleware).forRoutes('*')`. `req.user`'ı
   (`tenant.middleware.ts:60-68`) ve `req.activeAgency` / `req.activeClient` / `req.activeStore`'u
   (`tenant.middleware.ts:163-244`) **her istekte** dolduran budur — TenantGuard değil.
   Cross-tenant kontrolü de burada: satır 136-138, 187-189, 226-228.
2. **`TenantGuard` yalnızca 2 controller'da var:** `product.controller.ts:16` ve
   `order.controller.ts:17`.
3. **Ve bu 2 yerde de neredeyse no-op.** `tenant.guard.ts:22-30`: `tenantPublicId`
   `params`/`query`/`x-tenant-id` header'ından okunuyor; **yoksa `return true`**. Frontend
   `x-tenant-id` göndermiyor (`api.ts:54-56` yalnızca `x-agency-id`, `x-client-id`, `x-store-id`
   set ediyor). Ayrıca `tenant.guard.ts:17-19` super_admin'i baştan geçiriyor. Guard'ın yazdığı
   `request.tenant` alanını **hiçbir controller okumuyor**.

**Sonuç:** Gerçek fark guard listesinde değil, **controller'ın hangi alanı okuduğunda**.
Gruplama buna göre yapıldı.

### GRUP-1 — Aktif bağlamı okuyanlar (`req.activeAgency/activeClient/activeStore`) — 9 controller

| Controller | Guard seti | activeX kullanım sayısı |
|---|---|---|
| `modules/product/product.controller.ts` | `AuthGuard('jwt'), TenantGuard, PermissionGuard` (16) | 36 |
| `modules/order/order.controller.ts` | `AuthGuard('jwt'), TenantGuard, PermissionGuard` (17) | 36 |
| `modules/category/category.controller.ts` | `AuthGuard('jwt'), PermissionGuard` (15) | 30 |
| `modules/integration/integration.controller.ts` | `AuthGuard('jwt'), PermissionGuard` (17) | 78 |
| `modules/inventory/inventory.controller.ts` | `AuthGuard('jwt'), PermissionGuard` (14) | 12 |
| `modules/wms/printer/wms-printer.controller.ts` | `AuthGuard('jwt'), PermissionGuard` (12) | 10 |
| `modules/wms/labels/wms-label.controller.ts` | `AuthGuard('jwt'), PermissionGuard` (12) | 6 |
| `modules/wms/shipments/wms-shipment.controller.ts` | `AuthGuard('jwt'), PermissionGuard` (12) | 4 |
| `modules/integration-settings/integration-settings.controller.ts` | `AuthGuard('jwt'), PermissionGuard` (34) | 3 (satır 45, 47) |

Yani **doğru kalıbı uygulayan 9 controller'dan 7'sinde TenantGuard yok** — ama doğru
çalışıyorlar, çünkü işi yapan global middleware.

### GRUP-2 — JWT'deki sabit tenant'ı okuyanlar (`req.user.agencyId`) — 20 controller

| Controller | Guard seti | okuma sayısı |
|---|---|---|
| `modules/analytics/analytics.controller.ts` | `AuthGuard, PermissionGuard` (11) | 3 |
| `modules/audit/audit.controller.ts` | `AuthGuard` (7) — **PermissionGuard YOK** | 2 |
| `modules/integration-log/integration-log.controller.ts` | `AuthGuard` (7) — **PermissionGuard YOK** | 5 |
| `modules/profile/profile.controller.ts` | `AuthGuard` (23) — **PermissionGuard YOK** | 8 |
| `modules/settings/settings.controller.ts` | `AuthGuard, PermissionGuard` (11) | 1 |
| `modules/settings/controllers/users.controller.ts` | `AuthGuard, PermissionGuard` (11) | 1 (satır 20) |
| `modules/settings/controllers/roles.controller.ts` | `AuthGuard, PermissionGuard` (11) | 1 |
| `modules/settings/controllers/permissions.controller.ts` | `AuthGuard, PermissionGuard` (11) | 1 |
| `modules/settings/controllers/api-keys.controller.ts` | `AuthGuard, PermissionGuard` (11) | 1 |
| `modules/settings/controllers/tenant-settings.controller.ts` | `AuthGuard, PermissionGuard` (11) | 2 |
| `modules/settings/controllers/notification-settings.controller.ts` | `AuthGuard, PermissionGuard` (11) | 2 |
| `modules/settings/controllers/security-settings.controller.ts` | `AuthGuard, PermissionGuard` (11) | 2 |
| `modules/settings/controllers/integration-settings.controller.ts` | `AuthGuard, PermissionGuard` (11) | 2 |
| `modules/warehouse-settings/controllers/warehouses.controller.ts` | `AuthGuard, PermissionGuard` (11) | 5 |
| `modules/warehouse-settings/controllers/warehouse-zones.controller.ts` | `AuthGuard, PermissionGuard` (11) | 5 |
| `modules/warehouse-settings/controllers/warehouse-locations.controller.ts` | `AuthGuard, PermissionGuard` (11) | 5 |
| `modules/warehouse-settings/controllers/stock-source.controller.ts` | `AuthGuard, PermissionGuard` (11) | 5 |
| `modules/warehouse-settings/controllers/stock-movements.controller.ts` | `AuthGuard, PermissionGuard` (11) | 5 |
| `modules/warehouse-settings/controllers/stock-allocation.controller.ts` | `AuthGuard, PermissionGuard` (11) | 2 |
| `modules/warehouse-settings/controllers/logo-stock.controller.ts` | `AuthGuard, PermissionGuard` (11) | 7 |

İki grup **kesişmiyor** — hiçbir controller ikisini birden kullanmıyor.

P1'in tespiti burada doğrulanıyor: `users.controller.ts:20` → `this.service.findAll(user.agencyId)`.
`user.agencyId` JWT'den geliyor (`tenant.middleware.ts:50,64`), header'dan değil. Kullanıcı tenant
değiştirdiğinde `auth-context.tsx:180` `/auth/switch-tenant` ile YENİ token alıyor, yani JWT
tazeleniyor — sızıntı penceresi token yenilenene kadar. Yine de iki ayrı doğruluk kaynağı
(JWT vs header) var ve bu kalıcı bir tutarsızlık.

`integration-log.controller.ts:13,22,28,35,42` ekstra riskli:
`user?.agencyId || req.headers['x-agency-id']` — header **fallback** olarak doğrudan, hiçbir
doğrulamadan geçmeden tenant filtresi oluyor.

### GRUP-3 — Hiçbirini kullanmayanlar: üyelik üzerinden çalışan 4 controller

`modules/agency/agency.controller.ts` (`AuthGuard, RbacGuard` — satır 13) ·
`modules/client/client.controller.ts` (satır 12) ·
`modules/store/store.controller.ts` (satır 12) ·
`modules/rbac/rbac.controller.ts` (`AuthGuard, PermissionGuard` — satır 12)

Bunlar tenant ID yerine `user.userId` geçip servise üyelik sorgusu yaptırıyor
(`store.controller.ts:29,39,51`; `agency.controller.ts:30,40,50`; `rbac.controller.ts:43,54`).
Bu **kasıtlı ve doğru**: "erişebildiğim tenant'ları listele" endpoint'i tanımı gereği tek bir
aktif tenant'a filtrelenemez. P1 bunlara dokunmamalı.

`modules/auth/auth.controller.ts` ayrı kategoride: guard'lar metot seviyesinde (satır 40, 65, 80),
login/register public.

### Guard tutarsızlıkları (P1'in "TUTARSIZ" tablosuna girecek)

| Sorun | Yer |
|---|---|
| `PermissionGuard` hiç yok | `audit.controller.ts:7` · `integration-log.controller.ts:7` · `profile.controller.ts:23` |
| Guard hiç yok | `files.controller.ts:6` (imzalı token ile korunuyor — `files.controller.ts:20`) |
| `RbacGuard` vs `PermissionGuard` — iki farklı guard | `agency`/`client`/`store` vs diğerleri |
| `TenantGuard` var ama etkisiz | `product.controller.ts:16` · `order.controller.ts:17` |

---

## 4. `apiFetch` dönüş tipleri: düz dizi mi, zarf mı?

**Sonuç: 22 liste endpoint'inin 20'si düz dizi, 2'si `{items, total}` zarfı.
`{data, pagination}` zarfını kullanan TEK BİR endpoint YOK.**

### Düz dizi (`T[]`) bekleyenler — 20 endpoint

| Endpoint | Çağrı yerleri |
|---|---|
| `/products` | `products/hooks/useProducts.ts:117` · `orders/hooks/useOrders.ts:115` · `app/wms/stocks/page.tsx:25` · `products/components/ProductFormModal.tsx:93` · `dashboard/page.tsx:65` |
| `/products/erp-search` | `products/components/ProductFormModal.tsx:204` |
| `/orders` | `orders/hooks/useOrders.ts:103` · `dashboard/page.tsx:64` |
| `/categories` | `products/hooks/useProducts.ts:129` · `integrations/marketplace/components/CategoryMappingModal.tsx:103` |
| `/integrations` | `integrations/page.tsx:25` · `integrations/components/IntegrationTree.tsx:28` · `products/components/ProductMarketplaceSettings.tsx:84` · `dashboard/page.tsx:66,92` |
| `/integrations/products/:id/mappings` | `products/components/ProductMarketplaceSettings.tsx:105` |
| `/integrations/:id/categories/mappings` | `integrations/marketplace/components/CategoryMappingModal.tsx:107` |
| `/integrations/:id/categories/trendyol-tree` | `ProductMarketplaceSettings.tsx:121` · `CategoryMappingModal.tsx:111` |
| `/agencies` | `agencies/page.tsx:60` |
| `/clients` | `clients/page.tsx:59` |
| `/stores` | `stores/page.tsx:66` |
| `/warehouses` | `warehouses/components/WarehousesTable.tsx:109` · `WarehouseZonesTable.tsx:157` · `WarehouseLocationsTable.tsx:198` · `system/settings/components/WarehouseSettingsForm.tsx:12` (SWR) |
| `/warehouse-zones` | `WarehouseZonesTable.tsx:178` · `WarehouseLocationsTable.tsx:219` |
| `/warehouse-locations` | `WarehouseLocationsTable.tsx:243` |
| `/inventory` | `inventory/page.tsx:355` |
| `/inventory/movements` | `inventory/page.tsx:397` |
| `/wms/shipments` | `app/wms/shipments/page.tsx:25` · `app/wms/packaging/page.tsx:27` |
| `/wms/print-jobs` | `app/wms/dashboard/page.tsx:43` |
| `/stock-allocation/rules` | `warehouses/components/StockAllocationRulesTable.tsx:12` (SWR) |
| `/system/integration-settings` | `system/settings/components/IntegrationSettingsGrid.tsx:11` (SWR) |

### Zarf (`{items, total}`) bekleyenler — 2 endpoint

| Endpoint | Backend kaynağı | Frontend çağrıları |
|---|---|---|
| `/integration-logs` | `integration-log.service.ts:71` → `return { items, total }` | `useProducts.ts:201-202` (`res?.items`) · `useOrders.ts:214` · `integrations/errors/page.tsx:36` |
| `/audit-logs` | `audit.service.ts:75` → `return { items, total }` | `system/audit-logs/page.tsx:26` · `system/settings/components/AuditLogsShortcutPanel.tsx:14` (`logsData.items`) |

### Liste olmayan zarflar (referans)

| Endpoint | Şekil | Yer |
|---|---|---|
| `/auth/me` | `{user, accessibleTenants}` | `lib/auth-context.tsx:79-81, 106-108` |
| `/auth/switch-tenant` | `{accessToken, refreshToken}` | `lib/auth-context.tsx:180` |
| `/integrations/:id/categories/trendyol-attributes/:catId` | `{categoryAttributes: [...]}` | `CategoryMappingModal.tsx:148` · `ProductMarketplaceSettings.tsx:150` |
| `/integrations/:id/test-connection` | `{success, message}` | `IntegrationSetupWizard.tsx:144` |

Tekil nesne dönen ayar endpoint'leri (zarf sayılmaz): `/profile`, `/system/settings`,
`/system/tenant-settings`, `/system/security-settings`, `/system/notification-settings`,
`/system/warehouse-settings`, `/stock-source/settings`, `/logo-stock/settings`.

### ⚠️ Yan bulgu — 2 sayfada axios kalıntısı, kodu sessizce bozuyor

`api.get()` (`lib/api.ts:98`) doğrudan `apiFetch`'i, o da `response.json()`'ı döndürür
(`api.ts:94`). Axios'taki `{data}` sargısı **yok**. Buna rağmen:

- `integrations/errors/page.tsx:30` → `const { data } = await api.get('/integration-logs', ...)`
- `system/audit-logs/page.tsx:26` → `const { data } = await api.get('/audit-logs', ...)`

Gövde `{items, total}` olduğu için `data` → `undefined`, sonraki `data.items` → TypeError,
`catch` bloğu yutuyor → **liste her zaman boş görünür**. (Soru 1'deki `/api` prefix eksikliği
zaten aynı iki endpoint'i 404'e düşürdüğü için hata iki katmanlı.)

---

## 5. Prisma `Decimal` alanları JSON'a string mi number mı dönüyor?

**Varsayılan: STRING. Tek bir yerde, elle, number'a çevriliyor.**

### Merkezî serileştirme ayarı YOK

`packages/backend/src` içinde `Interceptor` aramasının **tek** sonucu
`profile.controller.ts:11,17,128` → `FileInterceptor` (dosya yükleme, alakasız).
`useGlobalInterceptors` yok, `ClassSerializerInterceptor` yok, `toJSON` override yok,
Prisma `$extends` result transform'u yok, `BigInt` yaması yok.

### Varsayılan davranış — ampirik doğrulama

```
$ node -e "const {Prisma}=require('@prisma/client');
           console.log(JSON.stringify({price: new Prisma.Decimal('123.45')}))"
{"price":"123.45"}
```

Prisma'nın `Decimal`'ı decimal.js tabanlı ve `toJSON`'u string döndürüyor. Yani araya dönüştürme
girmeyen her `Decimal` alanı istemciye **string** olarak gider.

### Şemadaki Decimal alanları (`packages/backend/prisma/schema.prisma`)

`Product`: `price` (257), `basePrice` (258), `costPrice` (259), `weight` (264), `width` (265),
`height` (266), `depth` (267) · `Order.totalAmount` (365) · `OrderItem.unitPrice` (396),
`totalPrice` (397) · analytics tabloları (800-855) · `discountRate` (1231)

### Tek dönüştürme noktası: `product.service.ts`

`mapProductResponse()` (`product.service.ts:669-686`) `Number(...)` uyguluyor: `price`,
`basePrice`, `costPrice`, `weight`, `width`, `height`, `depth`.
Çağrıldığı yerler yalnızca ikisi: `list()` → satır 101, `get()` → satır 165.

**Ama iç içe ilişkiler dönüştürülmüyor.** `list()`'in `include`'u (`product.service.ts:64-99`)
şunları getiriyor ve hiçbiri mapper'dan geçmiyor:

- `bundleItems.childProduct.price` (satır 83) → **string**
- `crossSellSources.targetProduct.price` (satır 90) → **string**
- `variants[].price` / `variants[].basePrice` (satır 94-96) → **string**

Yani aynı response içinde `product.price` number, `product.variants[0].price` string.

### Order tarafında hiç dönüştürme yok

`order.service.ts:65` ham `this.prisma.order.findMany({...})` döndürüyor. Sonuç:
`totalAmount`, `items[].unitPrice`, `items[].totalPrice` → hepsi **string**.

### Bu, frontend'deki "string | number" kaçamağını birebir açıklıyor

`orders/hooks/useOrders.ts`:

- satır 13 → `unitPrice: string | number` ← order'dan (string)
- satır 40 → `totalAmount: string | number` ← order'dan (string)
- satır 52 → `price: number` ← product'tan (mapper'dan geçmiş, number)

Tip belirsiz olduğu için değil, **API gerçekten iki farklı tip döndürdüğü için** böyle yazılmış.
P2'nin "string mi number mı" kararı bu üç satırı tek tipe indirmeli ve dönüştürmeyi tek bir
merkezî yere (interceptor veya Prisma `$extends`) taşımalı — bugünkü servis-başına elle `Number()`
kalıbı iç içe ilişkileri kaçırıyor.

---

## EKSİK BİLGİ

**Yok.** 5 sorunun tamamı `packages/` altındaki koddan doğrudan cevaplandı. Ek dosyaya ihtiyaç
duyulmadı; Soru 5 ayrıca çalıştırılarak doğrulandı.

---

## Dal Farkı: `wip/erp-warehouse-split` vs `main`

Bu tespit `wip/erp-warehouse-split` dalında, **commit'lenmemiş çalışma ağacı dahil** yapıldı.
Bulgular `main` ile tek tek karşılaştırıldı. Sonuç:

### 🔴 DALA ÖZEL — `main`'de GEÇERLİ DEĞİL

| # | Bulgu | `main`'deki durum |
|---|---|---|
| **2** | `packages/shared`'ın "aktif yarısı" (19 dosyada import) | **`main`'de `@kroptos/shared`'ı import eden TEK BİR dosya YOK.** Paket `main`'de tamamen ölü. `credentials.ts` dosyası `main`'de mevcut değil; `export * from './credentials'` bu dalda eklendi (commit `44d64f2`). `integration-settings` klasörü `main`'de var ama hiç import edilmiyor. |
| **5** | `mapProductResponse()` ile `Decimal → number` dönüşümü | **`main`'de `mapProductResponse` YOK.** Dolayısıyla `main`'de `product.price` de **string** döner. "Tek dönüştürme noktası" bu dalda eklenmiş; `main`'de sıfır dönüştürme noktası var. |
| **5** | `useOrders.ts:52` → `price: number` | `main`'de bu alan da fiilen string alıyor; `string \| number` kaçamağı `main`'de daha da geniş kapsamlı. |
| **2/5** | Ürün alan listesi | Bu dal `schema.prisma`'ya 6 satır, `product/dto/product.dto.ts`'ye 66 satır ekliyor (ERP/Logo entegrasyonu). P2'nin `Product` tipi bu dalın alan setine göre yazılırsa `main`'e merge'de çakışır. |

### 🟢 DALA ÖZEL DEĞİL — `main`'de de aynen geçerli

| # | Bulgu | Doğrulama |
|---|---|---|
| **1** | `setGlobalPrefix` yok | `main:packages/backend/src/main.ts` içinde de yok |
| **1** | `integration-logs` / `audit-logs` / `files` prefix eksikliği → 404 | `main`'de de `@Controller('integration-logs')`, `@Controller('audit-logs')` |
| **1** | `NEXT_PUBLIC_API_URL` varsayılanı `.../api` | `next.config.js`'in bu dalda değişen tek yeri `webpack.cache` bloğunun silinmesi; `env` bloğu aynı |
| **2** | `index.ts`'teki 6 domain tipi ölü ve koddan sapmış | `main`'de de hiç import edilmiyor |
| **3** | `TenantMiddleware` global (`forRoutes('*')`) | `main:app.module.ts:53` aynı |
| **3** | `TenantGuard` yalnızca `product` + `order` controller'ında | `main`'de de tam olarak bu iki dosyada |
| **3** | `TenantGuard`'ın `tenantPublicId` yoksa `return true` yapması | `main:tenant.guard.ts:27-29` aynı |
| **3** | GRUP-2 `user.agencyId` kalıbı (ör. `users.controller.ts`) | `main`'de de `this.service.findAll(user.agencyId)` |
| **4** | Düz dizi vs `{items,total}` ayrımı; `{data,pagination}` hiç yok | `main`'de de aynı |
| **4** | `const { data } = await api.get(...)` axios kalıntısı | `main`'de de `errors/page.tsx:30` ve `audit-logs/page.tsx:26`'da aynı satırlar |

### ⚠️ Metodolojik uyarı — satır numaraları geçici

Çalışma ağacında commit'lenmemiş çok sayıda değişiklik var. Bu tespitin dayandığı dosyalardan
şunlar **commit edilmemiş** durumda: `tenant.middleware.ts` (+27/−7), `tenant.guard.ts` (+13/−3),
`app.module.ts` (+2), `settings/controllers/users.controller.ts` (+10/−1), `order.service.ts`,
`agency.controller.ts`, `integrations/errors/page.tsx` (+9/−9),
`system/audit-logs/page.tsx` (+7/−7), `orders/hooks/useOrders.ts` (+2).

**Davranışsal sonuçların hepsi `main`'e karşı ayrıca doğrulandı** (yukarıdaki 🟢 tablosu), ancak
**satır numaraları commit/merge sonrası kayacaktır.** P0 (`API_CONTRACT.md`) üretilirken satır
numaraları yeniden doğrulanmalı.

### P görevleri için pratik sonuç

- **P0, P1, P3, P4** → `main`'de de aynı zemine oturuyor; bu tespit doğrudan kullanılabilir.
- **P2** → **bu dala bağımlı.** P2'yi `main`'de çalıştırmak farklı bir başlangıç noktası demektir:
  orada `packages/shared` sıfırdan devreye alınacak ve `Decimal → number` dönüşümü hiç yok.
  P2 bu dal `main`'e merge edildikten SONRA çalıştırılmalı.

---

## Kapsam dışı gözlemler

Paketin kuralı gereği düzeltilmedi, yalnızca not düşüldü:

1. **`/integration-logs` ve `/audit-logs` şu an çalışmıyor** — `/api` prefix eksikliği (Soru 1) +
   axios `{data}` kalıntısı (Soru 4). İki bağımsız hata aynı endpoint'lerde üst üste binmiş.
   Her ikisi de `main`'de de mevcut.
2. **`lib/auth-context.tsx:115` ve `:152` ham `fetch` kullanıyor** — `apiFetch` değil. Paketin
   DEĞİŞMEZ KURALLAR #1 maddesinin ihlali. (Login/register akışı, token henüz yokken.)
3. **`TenantGuard` fiilen ölü kod** — `request.tenant`'ı hiçbir controller okumuyor ve
   `x-tenant-id` header'ı frontend tarafından hiç gönderilmiyor. P1'in "TenantGuard'ı her
   controller'a ekle" hedefi, guard bu haldeyken güvenlik kazancı sağlamaz; P1 Faz A'da guard'ın
   kendisinin de ele alınıp alınmayacağı kararlaştırılmalı.
4. **`packages/shared/src/index.ts`'teki 6 domain tipi ölü ve yanıltıcı** — P2 için doğrudan girdi.
5. **`product.service.ts:640-666`** `erp-search` mock veri döndürüyor (`mockErpItems`), gerçek ERP
   entegrasyonu değil.
