# API_CONTRACT.md — Gerçek Kod Sözleşmesi

> **Tek doğruluk kaynağı.** Bu dosya `packages/backend/src/modules/**/*.controller.ts`
> dosyalarının tamamı okunarak üretildi. `docs/` altındaki hiçbir doküman kaynak olarak
> kullanılmadı.

| | |
|---|---|
| Üretildiği commit | **`c23ce7c`** (`wip/erp-warehouse-split`) |
| Üretim tarihi | 2026-08-06 |
| Kapsam | 35 controller · 165 endpoint |
| Yöntem | Statik kod okuma + `/api/audit-logs`, `/api/integration-logs` için canlı HTTP doğrulaması |
| Sonraki güncellemeler | P1 İŞ 1 (`09dff1f`) · İŞ 4 (`a6305db`, `83bb0e3`) · İŞ 5 (`2902ed1`) · **İŞ 3 (`73fcc71`, `47d76a6`)** — §2, §12, §13, §20, §23, §25 |

## Referans kuralı

Satır numaraları commit/merge sonrası kayar (bkz. `docs/prompt/KESIF_SONUCU.md`'nin başına
gelen). Bu dosyada referanslar **`Sınıf.metot`** biçimindedir; satır numarası yalnızca sınıf
seviyesi decorator'lar gibi metoda bağlanamayan yerlerde ve o zaman da commit SHA'sıyla
birlikte verilir.

## Temel gerçekler

| Konu | Durum | Kaynak |
|---|---|---|
| `app.setGlobalPrefix()` | **YOK.** Gerçek yol = controller'ın `@Controller(...)` içinde yazdığı yol | `main.ts` (58 satır, çağrı hiç geçmiyor) |
| Port | `API_PORT` ?? `3001` | `main.ts` |
| Swagger UI | `/api/docs` | `main.ts` |
| Tenant bağlamı | `TenantMiddleware` **global** (`forRoutes('*')`); `req.user` ve `req.activeAgency`/`activeClient`/`activeStore` her istekte burada dolar | `app.module.ts:55` @ `c23ce7c` |
| `TenantGuard` | Yalnızca `ProductController` ve `OrderController`'da; `tenantPublicId` yoksa `return true`, super_admin baştan geçer, yazdığı `request.tenant`'ı hiçbir controller okumuyor | `tenant.guard.ts` |
| Liste zarfı | 2 endpoint `{items, total}`; geri kalan liste endpoint'leri **düz dizi** | §9, §11 |
| `{data, pagination}` zarfı | **Hiçbir endpoint'te yok** | tüm servis taraması |

## Sütun sözlüğü

- **Guard** — sınıf seviyesi `@UseGuards` seti. Metot seviyesinde ek guard varsa hücrede belirtilir.
- **İzin** — `@RequirePermission(...)` değeri. `—` = decorator yok.
- **Tenant kaynağı** — servise tenant filtresi olarak hangi değerin geçtiği:
  `activeX` (`req.activeAgency`/`activeClient`/`activeStore`) · `user.agencyId` (JWT'den) ·
  `userId` (kullanıcı kapsamlı) · `üyelik` (servis üyelik sorgusu yapar) · `yok`.
- **DOĞRULANAMADI** — statik okumayla kesinleştirilemeyen alan; uydurma yerine işaretlendi.

---

## 1. Kimlik ve oturum — `AuthController`

`@Controller('/api/auth')` · sınıf seviyesi guard **yok** (guard'lar metot seviyesinde)

| Metot | Yol | Guard | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | yok (public) | — | `RegisterDto` | `AuthResponseDto` | yok | `AuthController.register` |
| POST | `/api/auth/login` | yok (public) | — | `LoginDto` | `AuthResponseDto` | yok | `AuthController.login` |
| POST | `/api/auth/logout` | `AuthGuard('jwt')` (metot) | — | `RefreshDto` | `{ message: string }` | `userId` | `AuthController.logout` |
| POST | `/api/auth/refresh` | yok (public) | — | `RefreshDto` | `{ accessToken, refreshToken }` | yok | `AuthController.refresh` |
| POST | `/api/auth/switch-tenant` | `AuthGuard('jwt')` (metot) | — | `SwitchTenantDto` | `{ accessToken, refreshToken }` | `userId` | `AuthController.switchTenant` |
| GET | `/api/auth/me` | `AuthGuard('jwt')` (metot) | — | — | `{ user: {...user, role, isPlatformAdmin}, accessibleTenants }` | `userId` | `AuthController.me` |

**Notlar**

- `register` ve `login` `Promise<AuthResponseDto>` olarak **tiplenmiş**; diğer dördünün dönüşü
  tiplenmemiş, şekil servis gövdesinden türetildi (`AuthService.refreshTokens`,
  `AuthService.switchTenant`, `AuthService.getMe`).
- `getMe` dönüşündeki `role`, `userRoles[0]?.role?.name ?? null` — koddaki yoruma göre
  **yalnızca UI amaçlı**, yetki kararı her korumalı rotada sunucuda yeniden yapılır.
- `switch-tenant` yeni bir token çifti döndürür. Tenant değişimi JWT tazelenmesiyle olur;
  bu, §12'deki `user.agencyId` kalıbının neden kalıcı bir tutarsızlık olduğunu açıklar.

---

## 2. Kullanıcı profili — `ProfileController`

`@Controller('/api/profile')` · `@UseGuards(AuthGuard('jwt'))` · **`PermissionGuard` yok, `@RequirePermission` yok (10/10 endpoint) — bilinçli istisna**

P1 İŞ 3 bu controller'ı kasıtlı olarak dışarıda bıraktı. Servisteki her sorgu
`where: { id: userId }` / `where: { userId }` ile isteği yapanın kendi kaydına kilitli ve
`userId` her zaman `req.user.userId`'den geliyor, gövdeden değil — izin katmanı bir şey
eklemez. `logout-all-devices` (`profile.service.ts` `updateMany where: { userId }`) ve
`delete-account` (`update where: { id: userId }`, ayrıca tek Owner ise `ForbiddenException`)
ayrıca tek tek doğrulandı. Kapsam dışı gözlem: `delete-account` parola/2FA ile yeniden
doğrulama istemiyor — bu bir izin değil, hassas işlem re-auth sorunu.

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/profile` | — | — | DOĞRULANAMADI (servis dönüşü tiplenmemiş) | `userId` | `ProfileController.getProfile` |
| PUT | `/api/profile` | — | inline (`any`) | DOĞRULANAMADI | `userId` | `ProfileController.updateProfile` |
| PUT | `/api/profile/address` | — | inline (`any`) | DOĞRULANAMADI | `userId` | `ProfileController.updateAddress` |
| POST | `/api/profile/change-password` | — | inline (`any`) | DOĞRULANAMADI | `userId` | `ProfileController.changePassword` |
| POST | `/api/profile/2fa/setup` | — | — | DOĞRULANAMADI | `userId` | `ProfileController.setup2fa` |
| POST | `/api/profile/2fa/enable` | — | inline (`secret`, `code`) | DOĞRULANAMADI | `userId` | `ProfileController.enable2fa` |
| POST | `/api/profile/2fa/disable` | — | — | DOĞRULANAMADI | `userId` | `ProfileController.disable2fa` |
| POST | `/api/profile/logout-all-devices` | — | — | DOĞRULANAMADI | `userId` | `ProfileController.logoutAllDevices` |
| DELETE | `/api/profile/delete-account` | — | — | DOĞRULANAMADI | `userId` | `ProfileController.deleteAccount` |
| POST | `/api/profile/avatar` | — | `multipart/form-data` (`FileInterceptor`) | DOĞRULANAMADI | `userId` | `ProfileController.uploadAvatar` |

**Tenant kaynağı hakkında — keşif raporundan sapma**

`docs/prompt/KESIF_SONUCU.md` §3 bu controller'ı "GRUP-2 — JWT'deki sabit tenant'ı okuyanlar"
listesine koyuyor (8 okuma). Kod bunu desteklemiyor:

- `ProfileService`'in **tüm** sorguları `where: { id: userId }` ile kapsanıyor.
- Controller'daki `req.user.agencyId` okumaları servise **audit parametresi** olarak gidiyor
  ve yalnızca oluşturulan audit satırının `tenantId` alanına yazılıyor
  (`ProfileService.updateProfile`, `.updateAddress`, `.changePassword`, `.enable2fa`,
  `.disable2fa`, `.logoutAllDevices` — hepsinde `tenantId: agencyId`).

Yani profil endpoint'leri **kullanıcı kapsamlı**, tenant kapsamlı değil. Cross-tenant filtre
sorunu bu controller için geçerli değildir; `agencyId`'nin yanlış olması audit satırının
etiketini etkiler, veri erişimini etkilemez. §12'deki TUTARSIZ tablosuna bu ayrımla girdi.

**Yetkilendirme boşluğu (gözlem):** 10 endpoint'in hiçbirinde izin kontrolü yok. Kimliği
doğrulanmış her kullanıcı yalnızca kendi kaydına eriştiği için bu tasarım gereği olabilir,
ancak `delete-account` ve `logout-all-devices` gibi yıkıcı işlemler de aynı kapsamda.
Değerlendirme P1'in işi; burada yalnızca kaydedildi.

---

## 3. Dosya servisi — `FilesController`

`@Controller('files')` · sınıf seviyesi guard **YOK**

| Metot | Yol | Guard | İzin | İstek | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|---|
| GET | `/files/shipping-label` | **yok** | — | `?token=<imzalı>` | 302 redirect **veya** `application/pdf` gövdesi | token payload'ındaki `tenantPublicId` | `FilesController.getShippingLabel` |

**`/api/` prefix'i olmayan tek controller.** Gerçek yolu `/files/shipping-label`; frontend'in
`apiFetch` tabanı `.../api` olduğu için bu endpoint `apiFetch` üzerinden çağrılamaz.
Frontend'de çağrısı da yok.

**Güvenlik durumu — doğrulandı (Risk 5 kapatıldı)**

Guard yokluğu koruma yokluğu değil. `SignedUrlService.validateToken` sırasıyla:
base64 çöz → `HMAC-SHA256(payloadStr, JWT_SECRET)` yeniden hesapla → imzayı karşılaştır,
uyuşmazsa `ForbiddenException` → `expiresAt` geçmişse `ForbiddenException`. Token ömrü
amaca göre 10/15/30 dakika (`SignedUrlService.generateSignedToken`). Controller ayrıca
kaydı `agency: { publicId: payload.tenantPublicId }` koşuluyla arar, yani tenant izolasyonu
sorgu düzeyinde uygulanır ve eşleşmezse `NotFoundException` döner.

**Gözlem (düzeltilmedi):** imza karşılaştırması `!==` ile yapılıyor, sabit zamanlı
(`crypto.timingSafeEqual`) değil. Ayrıca `payload.purpose` alanı üretiliyor ama bu
controller'da doğrulanmıyor — `invoice-pdf` için üretilmiş bir token `shipping-label`
endpoint'inde de geçerli olur. İkisi de P0 kapsamı dışında, kaydedildi.

---

## 4. Kiracı hiyerarşisi — `AgencyController`

`@Controller()` **(bare)** · `@UseGuards(AuthGuard('jwt'), RbacGuard)` · yollar metot seviyesinde

| Metot | Yol | Ek guard | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|---|
| GET | `/api/agencies` | — | — | — | DOĞRULANAMADI | üyelik (`userId` + `isSuperAdmin`) | `AgencyController.list` |
| GET | `/api/agencies/:id` | — | — | — | DOĞRULANAMADI | üyelik | `AgencyController.get` |
| GET | `/api/tenants/:tenantPublicId` | — | — | — | DOĞRULANAMADI | üyelik | `AgencyController.getByTenantPublicId` |
| POST | `/api/agencies` | `PlatformAdminGuard` | `agencies.create` | `CreateAgencyDto` | DOĞRULANAMADI | üyelik | `AgencyController.create` |
| PATCH | `/api/agencies/:id` | `PlatformAdminGuard` | `agencies.write` | `UpdateAgencyDto` | DOĞRULANAMADI | üyelik | `AgencyController.update` |
| DELETE | `/api/agencies/:id` | `PlatformAdminGuard` | `agencies.write` | — | DOĞRULANAMADI | üyelik | `AgencyController.delete` |

**Bu controller iki ayrı yol ailesi sunuyor:** `/api/agencies/*` ve `/api/tenants/:tenantPublicId`.
İkincisi `AgencyService.get`'i aynı imzayla çağırıyor, yani `:tenantPublicId` ile `:id` aynı
servis parametresine gidiyor. Bare `@Controller()` kullanıldığı için bu ikilik decorator'dan
görünmüyor — envanterde ayrıca işaretlendi.

**`PlatformAdminGuard`** yalnızca yazma işlemlerinde ve yalnızca metot seviyesinde
(`create`, `update`, `delete`). Keşif raporunda bu guard hiç geçmiyor;
`packages/backend/src/common/guards/platform-admin.guard.ts` `c23ce7c` ile eklenen yeni
bir dosya.

---

## 5. Kiracı hiyerarşisi — `ClientController`

`@Controller('/api/clients')` · `@UseGuards(AuthGuard('jwt'), RbacGuard)`

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/clients` | **—** | — | DOĞRULANAMADI | üyelik | `ClientController.list` |
| GET | `/api/clients/:id` | **—** | — | DOĞRULANAMADI | üyelik | `ClientController.get` |
| POST | `/api/clients` | `clients.create` | `CreateClientDto` | DOĞRULANAMADI | üyelik | `ClientController.create` |
| PATCH | `/api/clients/:id` | `clients.write` | `UpdateClientDto` | DOĞRULANAMADI | üyelik | `ClientController.update` |
| DELETE | `/api/clients/:id` | `clients.write` | — | DOĞRULANAMADI | üyelik | `ClientController.delete` |

---

## 6. Kiracı hiyerarşisi — `StoreController`

`@Controller('/api/stores')` · `@UseGuards(AuthGuard('jwt'), RbacGuard)`

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/stores` | **—** | — | DOĞRULANAMADI | üyelik | `StoreController.list` |
| GET | `/api/stores/:id` | **—** | — | DOĞRULANAMADI | üyelik | `StoreController.get` |
| POST | `/api/stores` | `stores.create` | `CreateStoreDto` | DOĞRULANAMADI | üyelik | `StoreController.create` |
| PATCH | `/api/stores/:id` | `stores.write` | `UpdateStoreDto` | DOĞRULANAMADI | üyelik | `StoreController.update` |
| DELETE | `/api/stores/:id` | `stores.write` | — | DOĞRULANAMADI | üyelik | `StoreController.delete` |

**§4–§6 ortak kalıbı — kasıtlı ve doğru.** Üçü de tenant ID yerine `user.userId` +
`isSuperAdmin` geçirip servise üyelik sorgusu yaptırıyor. "Erişebildiğim kiracıları listele"
endpoint'i tanımı gereği tek bir aktif kiracıya filtrelenemez. Bu, §12'deki TUTARSIZ
tablosuna **girmez**.

**Kapsama boşluğu:** her üç controller'da da `list` ve `get` endpoint'lerinde
`@RequirePermission` yok; yalnızca yazma işlemleri izinli. `RbacGuard` sınıf seviyesinde
olduğu için okuma tamamen korumasız değil, ancak izin kontrolü yazma/okuma arasında asimetrik.

---

## 7. Rol ve izin yönetimi — `RbacController`

`@Controller('/api/rbac')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)`

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/rbac/roles` | `agencies.read` | — | DOĞRULANAMADI | **yok** | `RbacController.listRoles` |
| GET | `/api/rbac/permissions` | `agencies.read` | — | DOĞRULANAMADI | **yok** | `RbacController.listPermissions` |
| POST | `/api/rbac/assign` | `agencies.create` | `AssignRoleDto` | DOĞRULANAMADI | üyelik (`userId`) | `RbacController.assignRole` |
| POST | `/api/rbac/revoke` | `agencies.create` | `RevokeRoleDto` | DOĞRULANAMADI | üyelik (`userId`) | `RbacController.revokeRole` |

`listRoles` ve `listPermissions` servise **hiçbir tenant/kullanıcı parametresi geçmiyor**
(`RbacService.listRoles()`, `.listPermissions()` — argümansız). Rol ve izin katalogları
global olduğu için bu beklenen olabilir; kiracıya özel rol tanımı varsa sorun olur.
Servis içi filtre durumu bu turda incelenmedi → **DOĞRULANAMADI**, P1'in girdisi.

**İzin adlandırma çatallanması — P1 İŞ 4'te kapatıldı.** Bu controller ajans kaynağı için
`agencies.read` / `agencies.create` (nokta) kullanırken, `AgencyController` aynı kaynak için
`agency:create` / `agency:write` (iki nokta) kullanıyordu. Artık ikisi de nokta kalıbında;
`AgencyController` `agencies.create` / `agencies.write` diyor. Ayrıntı §23'te.

---

## 8. Katalog — `ProductController`

`@Controller('/api/products')` · `@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionGuard)`

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/products` | `products.read` | — | **düz dizi** `ProductResponse[]` | `activeAgency` + `activeClient` + `activeStore` | `ProductController.list` |
| GET | `/api/products/:id` | `products.read` | — | tekil `ProductResponse` | `activeX` (3'lü) | `ProductController.get` |
| POST | `/api/products` | `products.create` | `CreateProductDto` | DOĞRULANAMADI | `activeX` (3'lü) | `ProductController.create` |
| PATCH | `/api/products/:id` | `products.create` | `UpdateProductDto` | DOĞRULANAMADI | `activeX` (3'lü) | `ProductController.update` |
| DELETE | `/api/products/:id` | `products.create` | — | DOĞRULANAMADI | `activeX` (3'lü) | `ProductController.delete` |
| POST | `/api/products/parse-url` | `products.read` | inline `{ url: string }` | DOĞRULANAMADI | **yok** | `ProductController.parseUrl` |
| GET | `/api/products/erp-search` | `products.read` | `?q=` | DOĞRULANAMADI | **yok** | `ProductController.searchErp` |
| POST | `/api/products/bulk-action` | `products.create` | `BulkActionDto` | DOĞRULANAMADI | `activeX` (3'lü) | `ProductController.bulkAction` |

### ⚠️ `erp-search` rotası gölgeleniyor — erişilemez

`@Get(':id')` **satır 45**'te, `@Get('erp-search')` **satır 151**'de bildirilmiş (`c23ce7c`).
Nest rotaları metot bildirim sırasına göre kaydeder, dolayısıyla `GET /api/products/erp-search`
isteği önce `:id` kalıbına düşer ve `ProductController.get`'e `id = "erp-search"` olarak gider.
`ProductController.searchErp` fiilen erişilemez.

Frontend bu endpoint'i çağırıyor (`products/components/ProductFormModal.tsx`, keşif raporu §4).
Beklenen sonuç: ürün bulunamadı hatası veya boş yanıt — arama sonucu değil.

Bu bir **kod hatası**, doküman hatası değil. P0 kapsamı dışı olduğu için düzeltilmedi;
§12 TUTARSIZ tablosuna ve "Kapsam dışı gözlemler" bölümüne kaydedildi.

### Decimal serileştirmesi — bu controller'a özel

`ProductService.mapProductResponse` `price`, `basePrice`, `costPrice`, `weight`, `width`,
`height`, `depth` alanlarına `Number(...)` uyguluyor ve yalnızca `ProductService.list`
(dizi) ile `ProductService.get` (tekil) bu mapper'dan geçiyor. **İç içe ilişkiler geçmiyor:**
`bundleItems.childProduct.price`, `crossSellSources.targetProduct.price`,
`variants[].price`, `variants[].basePrice` → **string** kalır.

Yani aynı yanıt gövdesinde `product.price` `number`, `product.variants[0].price` `string`.
P2'nin çözmesi gereken asıl düğüm budur.

**İzin asimetrisi:** `create`, `update`, `delete` üçü de `products.create` kullanıyor;
`products.update` / `products.delete` diye bir izin yok.

---

## 9. Katalog — `CategoryController`

`@Controller('/api/categories')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)` · **`TenantGuard` yok**

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/categories` | `products.read` | — | **düz dizi** (`prisma.category.findMany`) | `activeX` (3'lü) | `CategoryController.list` |
| GET | `/api/categories/:id` | `products.read` | — | tekil | `activeX` (3'lü) | `CategoryController.get` |
| POST | `/api/categories` | `products.create` | `CreateCategoryDto` | transaction sonucu | `activeX` (3'lü) | `CategoryController.create` |
| PATCH | `/api/categories/:id` | `products.create` | `UpdateCategoryDto` | transaction sonucu | `activeX` (3'lü) | `CategoryController.update` |
| DELETE | `/api/categories/:id` | `products.create` | — | transaction sonucu | `activeX` (3'lü) | `CategoryController.delete` |

Kategori kaynağı için ayrı izin yok; `products.*` izinlerini paylaşıyor.

---

## 10. Stok — `InventoryController`

`@Controller('/api/inventory')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)`

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/inventory` | `warehouse.manage` | — | **düz dizi** (`prisma.inventory.findMany`) | `activeAgency` + `activeStore` (**zorunlu**) | `InventoryController.list` |
| POST | `/api/inventory/adjust` | `wms.stock.update` | `AdjustInventoryDto` | transaction sonucu | `activeAgency` + `activeStore` (**zorunlu**) | `InventoryController.adjust` |
| GET | `/api/inventory/movements` | `wms.stock.view` | — | **düz dizi** (`prisma.inventoryAdjustment.findMany`) | `activeAgency` + `activeStore` (**zorunlu**) | `InventoryController.getMovements` |

**Tek controller içinde üç farklı izin ailesi:** `warehouse.manage`, `wms.stock.update`,
`wms.stock.view`. `inventory.*` diye bir izin yok.

**Bağlam zorunluluğu:** üç endpoint de `activeAgency?.id` **ve** `activeStore?.id` yoksa erken
dönüyor — §8/§9'daki `activeX?.id` (opsiyonel) kalıbından farklı. Mağaza bağlamı olmadan
çağrılamaz.

---

## 11. Siparişler — `OrderController`

`@Controller()` **(bare)** · `@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionGuard)` · yollar metot seviyesinde

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/orders` | `orders.read` | — | **düz dizi** (`prisma.order.findMany`, ham) | `activeX` (3'lü) | `OrderController.list` |
| GET | `/api/orders/:id` | `orders.read` | — | tekil (ham) | `activeX` (3'lü) | `OrderController.get` |
| GET | `/api/tenants/:tenantPublicId/orders` | `orders.read` | — | DOĞRULANAMADI | `:tenantPublicId` (yoldan) | `OrderController.listByTenant` |
| POST | `/api/orders` | `orders.update` | `CreateOrderDto` | transaction sonucu | `activeX` (3'lü) | `OrderController.create` |
| PATCH | `/api/orders/:id/status` | `orders.update` | `UpdateOrderStatusDto` | transaction sonucu | `activeX` (3'lü) | `OrderController.updateStatus` |
| POST | `/api/orders/:id/cancel` | `orders.update` | — | transaction sonucu | `activeX` (3'lü) | `OrderController.cancel` |
| POST | `/api/orders/:id/refund` | `orders.update` | — | transaction sonucu | `activeX` (3'lü) | `OrderController.refund` |

**Decimal: hiçbir dönüşüm yok.** `OrderService.list` ham `prisma.order.findMany` döndürüyor.
Sonuç: `totalAmount`, `items[].unitPrice`, `items[].totalPrice` istemciye **string** gider.
`ProductController` (§8) `number` döndürdüğü için aynı uygulamada iki farklı Decimal
sözleşmesi var — frontend'deki `string | number` kaçamağının kaynağı budur.

**İkinci `/api/tenants` yol ailesi.** `AgencyController.getByTenantPublicId` (§4)
`/api/tenants/:tenantPublicId` sunuyordu; bu controller `/api/tenants/:tenantPublicId/orders`
ekliyor. İki ayrı controller aynı yol ailesini paylaşıyor ve ikisi de bare `@Controller()`
kullandığı için bu decorator'dan görünmüyor.

**`create` izni `orders.update`** — `orders.create` diye bir izin yok.

---

## 12. Denetim kayıtları — `AuditLogController`

`@Controller('/api/audit-logs')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)` — P1 İŞ 3 (`73fcc71`)

| Metot | Yol | İzin | İstek | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/audit-logs` | `audit.read` | `@Query() any` | **`{ items: T[], total: number }`** | `activeAgency.id` ?? `user.agencyId` | `AuditLogController.getLogs` |
| GET | `/api/audit-logs/:id` | `audit.read` | — | tekil | `activeAgency.id` ?? `user.agencyId` | `AuditLogController.getLogById` |

`audit.read` seed'de `agency_owner` ve `agency_admin` rollerine bağlı (`prisma/seed.ts`);
`agency_admin` bağlantısı P1 İŞ 3'te eklendi (`47d76a6`).

**Canlı doğrulandı** (`73fcc71` sonrası, imzalı dev token ile `localhost:3001`):
`GET /api/audit-logs?take=5` → `HTTP 200`, gövde anahtarları tam olarak `[items, total]`.
Aynı endpoint izinsiz token ile `HTTP 403`, token'sız `HTTP 401`.

`tenantId` yoksa servise gitmeden `{ items: [], total: 0 }` döner
(`AuditLogController.getLogs` erken dönüşü). Bu erken dönüş **izin kontrolünden sonra**
çalışır; yetkisiz kullanıcı artık boş liste değil 403 alır.

---

## 13. Entegrasyon hata kayıtları — `IntegrationLogController`

`@Controller('/api/integration-logs')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)` — P1 İŞ 3 (`73fcc71`)

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/integration-logs` | `integration.logs.read` | `@Query() any` | **`{ items: T[], total: number }`** | `activeAgency.id` ?? `user.agencyId` | `IntegrationLogController.getLogs` |
| GET | `/api/integration-logs/:id` | `integration.logs.read` | — | tekil | `activeAgency.id` ?? `user.agencyId` | `IntegrationLogController.getLogById` |
| POST | `/api/integration-logs/:id/resolve` | `integration.logs.manage` | inline `{ resolutionNote?: string }` | DOĞRULANAMADI | `activeAgency.id` ?? `user.agencyId` | `IntegrationLogController.resolveLog` |
| POST | `/api/integration-logs/:id/ignore` | `integration.logs.manage` | inline `{ resolutionNote?: string }` | DOĞRULANAMADI | `activeAgency.id` ?? `user.agencyId` | `IntegrationLogController.ignoreLog` |
| POST | `/api/integration-logs/:id/retry` | `integration.logs.manage` | — | DOĞRULANAMADI | `activeAgency.id` ?? `user.agencyId` | `IntegrationLogController.retryLog` |

`read`/`manage` ayrımı seed'deki izin açıklamasından türetildi:
`integration.logs.manage` = "Resolve, ignore or retry integration errors" (`prisma/seed.ts`).
Üç fiil, üç `POST` endpoint. İki izin de `agency_owner` ve `agency_admin` rollerinde.

**Canlı doğrulandı** (`73fcc71` sonrası): `GET /api/integration-logs?take=5` → `HTTP 200`,
anahtarlar `[items, total]`. İzinsiz token ile beş endpoint de `HTTP 403`.
`POST .../resolve` ve `.../ignore` izinli token + var olmayan `id` ile `HTTP 201`
(`updateMany` eşleşme bulamıyor, veri değişmiyor) — yani `manage` izni geçiyor.

### ~~`x-agency-id` başlığı doğrulamasız tenant filtresi oluyor~~ KAPANDI

P1 İŞ 1 (`09dff1f`) ham başlık fallback'ini kaldırdı; her iki controller da artık
`(req as any).activeAgency?.id ?? (req as any).user?.agencyId` kullanıyor, yani
`TenantMiddleware`'in doğruladığı aktif bağlamı. P1 İŞ 3 (`73fcc71`) eksik
`PermissionGuard`'ı ekledi. Bu bölüm tarihsel kayıt olarak bırakıldı.

---

## 14. Raporlama — `AnalyticsController`

`@Controller('/api/analytics')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)`

14 endpoint, hepsi `GET`, hepsi `@Query() query: any` alıyor, hiçbirinin dönüş tipi tiplenmemiş
→ tamamı **DOĞRULANAMADI**. Tenant kaynağı hepsinde ortak: controller içindeki özel yardımcı
`{ agencyId: user.agencyId, ... }` üretiyor, yani **`user.agencyId`** (JWT'den).

| Yol | İzin |
|---|---|
| `/api/analytics/overview` | `analytics.read` |
| `/api/analytics/sales` | `analytics.read` |
| `/api/analytics/orders` | `analytics.read` |
| `/api/analytics/products` | `analytics.read` |
| `/api/analytics/marketplaces` | `analytics.read` |
| `/api/analytics/inventory` | `analytics.read` |
| `/api/analytics/warehouse` | `analytics.read` |
| `/api/analytics/shipping` | `analytics.read` |
| `/api/analytics/returns` | `analytics.read` |
| `/api/analytics/alerts` | `analytics.read` |
| `/api/analytics/accounting/logo` | `analytics.integration.read` |
| `/api/analytics/integrations/health` | `analytics.integration.read` |
| `/api/analytics/profitability` | `analytics.financial.read` |
| `/api/analytics/export` | `analytics.export` |

İzin ayrıştırması bu controller'da tutarlı: genel raporlar `analytics.read`, entegrasyon
raporları `analytics.integration.read`, finansal rapor ayrı `analytics.financial.read`,
dışa aktarma ayrı `analytics.export`.

---

## 15. Pazaryeri entegrasyonları — `IntegrationController`

`@Controller('/api/integrations')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)` · **13 endpoint, hepsi `integrations.manage`**

| Metot | Yol | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|
| GET | `/api/integrations` | — | **düz dizi** | `activeX` | `IntegrationController.list` |
| GET | `/api/integrations/:id` | — | tekil | `activeX` | `IntegrationController.get` |
| POST | `/api/integrations` | `CreateIntegrationDto` | DOĞRULANAMADI | `activeX` | `IntegrationController.create` |
| PATCH | `/api/integrations/:id` | `UpdateIntegrationDto` | DOĞRULANAMADI | `activeX` | `IntegrationController.update` |
| DELETE | `/api/integrations/:id` | — | DOĞRULANAMADI | `activeX` | `IntegrationController.delete` |
| POST | `/api/integrations/:id/test-connection` | — | `{ success, message }` | `activeX` | `IntegrationController.testConnection` |
| POST | `/api/integrations/:id/sync` | — | DOĞRULANAMADI | `activeX` | `IntegrationController.triggerSync` |
| POST | `/api/integrations/:id/connect` | — | DOĞRULANAMADI | `activeX` | `IntegrationController.connect` |
| GET | `/api/integrations/:id/categories/trendyol-tree` | — | **düz dizi** | `activeX` | `IntegrationController.getTrendyolCategories` |
| GET | `/api/integrations/:id/categories/trendyol-attributes/:categoryId` | — | `{ categoryAttributes: [...] }` | `activeX` | `IntegrationController.getTrendyolCategoryAttributes` |
| GET | `/api/integrations/products/:productId/mappings` | — | **düz dizi** | `activeX` | `IntegrationController.getProductMappings` |
| POST | `/api/integrations/products/:productId/mappings` | `UpsertProductMappingDto` | DOĞRULANAMADI | `activeX` | `IntegrationController.upsertProductMapping` |
| DELETE | `/api/integrations/products/:productId/mappings/:mappingId` | — | DOĞRULANAMADI | `activeX` | `IntegrationController.deleteProductMapping` |

`test-connection` ve `trendyol-attributes` dönüş şekilleri frontend çağrılarından teyit edildi
(keşif raporu §4 "Liste olmayan zarflar"); ikisi de tiplenmemiş, şekil kullanım yerinden
türetildi.

Tek izin (`integrations.manage`) hem okuma hem yazma hem yıkıcı işlemleri (`delete`,
`triggerSync`) kapsıyor. §16'daki ayrıştırılmış izin setiyle karşıtlık oluşturuyor.

---

## 16. Entegrasyon ayarları — `IntegrationSettingsController`

`@Controller('/api/integrations')` · `@UseGuards(AuthGuard('jwt'), PermissionGuard)` · **§15 ile aynı yol prefix'i**

| Metot | Yol | İzin | İstek gövdesi | Dönüş | Tenant kaynağı | Kaynak |
|---|---|---|---|---|---|---|
| GET | `/api/integrations/settings/providers` | `integrations.read` | — | DOĞRULANAMADI | **yok** | `.listProviders` |
| GET | `/api/integrations/settings/providers/:provider/schema` | `integrations.read` | — | DOĞRULANAMADI | **yok** | `.getProviderSchema` |
| GET | `/api/integrations/:id/settings/schema` | `integrations.read` | — | DOĞRULANAMADI | `activeX` | `.getSchema` |
| GET | `/api/integrations/:id/settings` | `integrations.read` | — | değerler + **maskelenmiş sırlar** | `activeX` | `.getSettings` |
| PUT | `/api/integrations/:id/settings` | `integrations.settings.update` | `SaveIntegrationSettingsDto` | DOĞRULANAMADI | `activeX` | `.save` |
| PATCH | `/api/integrations/:id/settings` | `integrations.settings.update` | `SaveIntegrationSettingsDto` | DOĞRULANAMADI | `activeX` | `.patch` |
| POST | `/api/integrations/:id/settings/validate` | `integrations.read` | `ValidateIntegrationSettingsDto` | DOĞRULANAMADI | `activeX` | `.validate` |
| POST | `/api/integrations/:id/settings/reset` | `integrations.settings.update` | `ResetIntegrationSettingsDto` | DOĞRULANAMADI | `activeX` | `.reset` |
| GET | `/api/integrations/:id/settings/revisions` | `integrations.read` | — | DOĞRULANAMADI | `activeX` | `.listRevisions` |
| POST | `/api/integrations/:id/settings/revisions/:version/restore` | `integrations.settings.update` | — | DOĞRULANAMADI | `activeX` | `.restoreRevision` |
| POST | `/api/integrations/:id/settings/wizard/complete` | `integrations.settings.update` | `CompleteWizardStepDto` | DOĞRULANAMADI | `activeX` | `.completeWizard` |

**Sır maskeleme sözleşmesi:** `secret: true` işaretli alanlar yanıtta ham dönmez;
`••••<son 4 hane>` biçiminde maskelenir ve audit izinde `[REDACTED]` olur. Bu davranış
`integration-settings.service.spec.ts` içindeki testlerle sabitlenmiş durumda.

### İki controller aynı prefix'i paylaşıyor — çakışma yok, kırılganlık var

`IntegrationController` ve `IntegrationSettingsController` ikisi de `@Controller('/api/integrations')`.
`app.module.ts`'te kayıt sırası: `IntegrationModule` (satır 40) → `IntegrationSettingsModule`
(satır 41), yani §15'in rotaları **önce** kaydediliyor.

Bugün fiilî çakışma **yok**, çünkü §15'in tek segmentlik `:id` kalıbı §16'nın iki+ segmentlik
yollarıyla eşleşmiyor ve §16'nın `settings/providers` yolu §15'te karşılığı olmayan bir literal.

Kırılganlık şurada: §15'e tek segmentlik yeni bir `@Get('...')` eklenirse veya §16'ya
`@Get(':id')` benzeri bir kalıp girerse, gölgeleme sessizce oluşur — §8'deki `erp-search`
hatasının aynısı, bu kez iki dosya arasında. Envanterde uyarı olarak bırakıldı.

---

## 17. Sistem ayarları — `settings/` ailesi (9 controller, 15 endpoint)

Dokuzunun tamamı: `@UseGuards(AuthGuard('jwt'), PermissionGuard)` · tenant kaynağı
**`user.agencyId`** (JWT'den) · istek gövdeleri `any` · dönüş tipleri tiplenmemiş
→ dönüş sütunu topluca **DOĞRULANAMADI**.

| Metot | Yol | İzin | İstek gövdesi | Kaynak |
|---|---|---|---|---|
| GET | `/api/system/settings` | `system.settings.read` | — | `SettingsController.getSettings` |
| PUT | `/api/system/settings` | `system.settings.manage` | `any` | `SettingsController.updateSettings` |
| GET | `/api/system/api-keys` | `system.settings.read` | — | `ApiKeysController.findAll` |
| GET | `/api/system/integration-settings` | `system.settings.read` | — | `IntegrationSettingsController.findAll` |
| PUT | `/api/system/integration-settings/:provider` | `system.settings.manage` | `any` | `IntegrationSettingsController.update` |
| GET | `/api/system/notification-settings` | `system.settings.read` | — | `NotificationSettingsController.findOne` |
| PUT | `/api/system/notification-settings` | `system.settings.manage` | `any` | `NotificationSettingsController.update` |
| GET | `/api/system/permissions` | `system.settings.read` | — | `PermissionsController.findAll` |
| GET | `/api/system/roles` | `system.settings.read` | — | `RolesController.findAll` |
| GET | `/api/system/security-settings` | `system.settings.read` | — | `SecuritySettingsController.findOne` |
| PUT | `/api/system/security-settings` | `system.settings.manage` | `any` | `SecuritySettingsController.update` |
| GET | `/api/system/tenant-settings` | `system.settings.read` | — | `TenantSettingsController.findOne` |
| PUT | `/api/system/tenant-settings` | `system.settings.manage` | `any` | `TenantSettingsController.update` |
| GET | `/api/system/users` | `system.settings.read` | — | `UsersController.findAll` |
| PATCH | `/api/system/users/:id/stores` | **`system.settings.write`** | DOĞRULANAMADI | `UsersController.updateUserStores` |

**Not:** bu klasördeki `IntegrationSettingsController` (`/api/system/integration-settings`),
§16'daki aynı adlı sınıftan (`/api/integrations/.../settings`) **farklı bir dosyadır**.
İki ayrı modülde aynı sınıf adı kullanılıyor.

### Üç farklı `system.settings.*` eylem adı

`read` ve `manage` 14 endpoint'te tutarlı kullanılırken `UsersController.updateUserStores`
tek başına **`system.settings.write`** kullanıyor. Aynı ailede üçüncü bir eylem adı.

### `user.id` — JWT payload'ında böyle bir alan yok

`SettingsController.updateSettings` servise `user.id` geçiyor. `JwtStrategy.validate`
dönüşü `{ userId, email, tenantId, agencyId, clientId, role, permissions }` — **`id` alanı
yok**, dolayısıyla bu değer `undefined`.

Aynı klasördeki, servise kullanıcı kimliği geçen diğer dört controller
(`integration-settings`, `notification-settings`, `security-settings`, `tenant-settings`)
savunmacı `user.userId || user.id` kalıbını kullanıyor; yalnızca bu biri doğrudan `user.id`
okuyor. (Kalan dört controller — `api-keys`, `permissions`, `roles`, `users` — `req.user`'ı
okuyor ama servise `userId` geçirmiyor, yani karşılaştırmaya girmiyor.) Etkisi audit/güncelleyen-kullanıcı
alanının boş kalması olur. Kod hatası, P0 kapsamı dışı — kaydedildi.

---

## 18. Depo yönetimi — `warehouse-settings/` ailesi (7 controller, 35 endpoint)

Yedisinin tamamı: `@UseGuards(AuthGuard('jwt'), PermissionGuard)` · tenant kaynağı
**`user.agencyId`** · istek gövdeleri `any` · dönüşler tiplenmemiş → **DOĞRULANAMADI**.

Beşi birebir aynı CRUD iskeletini paylaşıyor — `warehouses`, `warehouse-zones`,
`warehouse-locations`, `stock-source`, `stock-movements`:

| Metot | Yol kalıbı | İzin |
|---|---|---|
| GET | `/api/<kaynak>` | `warehouse.settings.read` |
| GET | `/api/<kaynak>/:id` | `warehouse.settings.read` |
| POST | `/api/<kaynak>` | `warehouse.settings.manage` |
| PUT | `/api/<kaynak>/:id` | `warehouse.settings.manage` |
| DELETE | `/api/<kaynak>/:id` | `warehouse.settings.manage` |

`<kaynak>` ∈ { `warehouses`, `warehouse-zones`, `warehouse-locations`, `stock-source`,
`stock-movements` }. Kaynak: `WarehousesController`, `WarehouseZonesController`,
`WarehouseLocationsController`, `StockSourceController`, `StockMovementsController` —
metotlar hepsinde `.findAll`, `.findOne`, `.create`, `.update`, `.remove`.

**`LogoStockController`** (`/api/logo-stock`) — yukarıdaki 5'li CRUD'a ek olarak iki ayar
endpoint'i, toplam 7:

| Metot | Yol | İzin | Kaynak |
|---|---|---|---|
| GET | `/api/logo-stock/settings` | `warehouse.settings.read` | `.getSettings` |
| PUT | `/api/logo-stock/settings` | `warehouse.settings.manage` | `.updateSettings` |
| GET | `/api/logo-stock` | `warehouse.settings.read` | `.findAll` |
| GET | `/api/logo-stock/:id` | `warehouse.settings.read` | `.findOne` |
| POST | `/api/logo-stock` | `warehouse.settings.manage` | `.create` |
| PUT | `/api/logo-stock/:id` | `warehouse.settings.manage` | `.update` |
| DELETE | `/api/logo-stock/:id` | `warehouse.settings.manage` | `.remove` |

`/settings` rotası `:id` rotasından **önce** bildirildiği için §8'deki gölgeleme sorunu
burada oluşmuyor.

**`StockAllocationController`** (`/api/stock-allocation`) — ayrı izin ailesi:

| Metot | Yol | İzin | Tenant kaynağı | Kaynak |
|---|---|---|---|---|
| GET | `/api/stock-allocation/rules` | `stock.allocation.read` | `user.agencyId` | `.findAll` |
| POST | `/api/stock-allocation/rules` | `stock.allocation.manage` | `user.agencyId` | `.create` |
| POST | `/api/stock-allocation/calculate` | `stock.allocation.read` | **YOK** | `.calculate` |

`calculate` imzası `(@Body() data: any)` — `@Req()` almıyor, dolayısıyla **hiçbir tenant
bağlamı yok**. Hesaplama saf fonksiyonsa sorun değil, veri okuyorsa kiracılar arası sızıntı
yüzeyi. Servis içi davranış bu turda incelenmedi → **DOĞRULANAMADI**, P1'in girdisi.

---

## 19. WMS — `wms/` ailesi (3 controller, 10 endpoint)

Üçü de `@UseGuards(AuthGuard('jwt'), PermissionGuard)` · tenant kaynağı **`activeAgency`**
· dönüşler tiplenmemiş → **DOĞRULANAMADI**.

| Metot | Yol | İzin | İstek gövdesi | Kaynak |
|---|---|---|---|---|
| GET | `/api/wms/labels/latest` | `wms.labels.view` | — | `WmsLabelController.getLatest` |
| GET | `/api/wms/labels/:id/preview` | `wms.labels.view` | — | `WmsLabelController.getPreview` |
| POST | `/api/wms/labels` | `wms.labels.create` | inline `{ orderId, shipmentId? }` | `WmsLabelController.createLabel` |
| GET | `/api/wms/printer/settings` | `wms.view` | — | `WmsPrinterController.getSettings` |
| PATCH | `/api/wms/printer/settings` | `wms.settings.update` | `any` | `WmsPrinterController.updateSettings` |
| GET | `/api/wms/printer/driver` | `wms.view` | — | `WmsPrinterController.checkDriver` |
| POST | `/api/wms/printer/test` | `wms.print` | — | `WmsPrinterController.testPrint` |
| GET | `/api/wms/print-jobs` | `wms.view` | — | `WmsPrinterController.getPrintJobs` |
| GET | `/api/wms/status` | `wms.view` | — | `WmsShipmentController.getStatus` |
| GET | `/api/wms/shipments` | `wms.view` | — | `WmsShipmentController.getShipments` |

**Üçüncü paylaşılan prefix:** `WmsPrinterController` ve `WmsShipmentController` ikisi de
`@Controller('/api/wms')`. Alt yolları literal ve ayrık olduğu için çakışma yok
(§16'daki kırılganlık notu burada da geçerli).

**`activeAgency.id` opsiyonel zincir olmadan okunuyor** (10 endpoint'in tamamında).
`TenantMiddleware` `activeAgency`'yi dolduramazsa `TypeError` → 500. §8/§9'daki `activeX?.id`
ve §10'daki erken dönüş kalıplarından farklı, üçüncü bir davranış.

---

## 20. TUTARSIZ — P1'in girdisi

Yalnızca gözlem; öneri sütunu **bilinçli olarak yok** (P1'in kararı).

| # | Tutarsızlık | Yer | Gözlem |
|---|---|---|---|
| 1 | ~~`PermissionGuard` ve `@RequirePermission` ikisi de yok~~ **KAPANDI (P1 İŞ 3)** | `AuditLogController` · `IntegrationLogController` · `ProfileController` | Yedi endpoint guard + izin aldı (`73fcc71`, §12/§13). `ProfileController` (10 ep) **bilinçli istisna**: her sorgu `where: { id: userId }` ile kendi kaydına kilitli, izin katmanı bir şey eklemez — `logout-all-devices` ve `delete-account` dahil ayrıca doğrulandı |
| 2 | ~~Doğrulamasız başlık tenant filtresi oluyor~~ **KAPANDI (P1 İŞ 1)** | `AuditLogController` (2 ep) · `IntegrationLogController` (5 ep) | `09dff1f` ham `x-agency-id` fallback'ini kaldırdı; artık `activeAgency?.id ?? user?.agencyId` |
| 3 | `TenantGuard` var ama etkisiz | `ProductController` · `OrderController` | `tenantPublicId` yoksa `return true`; frontend `x-tenant-id` göndermiyor; `request.tenant`'ı hiçbir controller okumuyor |
| 4 | ~~Aynı kaynak için iki izin adlandırma kalıbı~~ **KAPANDI (P1 İŞ 4)** | `AgencyController` (`agency:create`) vs `RbacController` (`agencies.create`) | Altı iki-nokta ad noktaya çevrildi; kod tabanında tek kalıp kaldı — §23 |
| 5 | Üçüncü eylem adı | `UsersController.updateUserStores` | `system.settings.write` — ailenin geri kalanı `read`/`manage` |
| 6 | İzin kapsaması asimetrik | `AgencyController` (3/6) · `ClientController` (3/5) · `StoreController` (3/5) | `list` ve `get` izinsiz, yalnızca yazma izinli |
| 7 | Tek izin tüm eylemleri kapsıyor | `IntegrationController` (13/13) | Okuma, yazma ve `delete`/`sync` aynı `integrations.manage` |
| 8 | Yazma eylemleri okuma/oluşturma iznini kullanıyor | `ProductController` (`update`/`delete` → `products.create`) · `CategoryController` (aynı) · `OrderController` (`create` → `orders.update`) | Ayrı `update`/`delete` izni tanımlı değil |
| 9 | Rota gölgelemesi — endpoint erişilemez | `ProductController.searchErp` | `@Get(':id')` satır 45, `@Get('erp-search')` satır 151 (`c23ce7c`) |
| 10 | Tenant bağlamı hiç yok | `StockAllocationController.calculate` | `@Req()` almıyor |
| 11 | `activeAgency.id` opsiyonel zincirsiz | `wms/` ailesi (10 ep) | Bağlam yoksa 500 |
| 12 | JWT payload'ında olmayan alan okunuyor | `SettingsController.updateSettings` | `user.id` — `JwtStrategy.validate` `userId` döndürüyor |
| 13 | Üç farklı bağlam-yokluğu davranışı | `activeX?.id` (§8/§9) · erken dönüş (§10) · `activeAgency.id` (§19) | Aynı durumda sırasıyla `undefined` filtre, boş liste, 500 |
| 14 | Guard ailesi çatallanması | `RbacGuard` (`agency`/`client`/`store`) vs `PermissionGuard` (diğerleri) | İki ayrı yetkilendirme guard'ı |
| 15 | Yol prefix'i paylaşan controller çiftleri | §15+§16 (`/api/integrations`) · §19 (`/api/wms`) · §4+§11 (`/api/tenants`) | Bugün çakışma yok; tek segmentlik rota eklenirse sessiz gölgeleme |
| 16 | `/api` prefix'i yok | `FilesController` | Tek istisna; `apiFetch` üzerinden çağrılamaz |
| 17 | Guard ile controller aynı isteği farklı tenant kaynağından okuyor | `AuditLogController` · `IntegrationLogController` (P1 İŞ 3 sonrası) | `PermissionGuard` rolü `user.agencyId`/`user.clientId` (JWT) ile arıyor; controller tenant filtresini `activeAgency.id` (doğrulanmış bağlam) ile kuruyor. Bağlam değişip token yenilenmediğinde ikisi ayrışır — İŞ 2'nin kapsamına eklendi |

---

## 21. Yanıt şekli sözleşmesi

| Şekil | Kapsam | Örnek |
|---|---|---|
| **Düz dizi** `T[]` | Liste endpoint'lerinin ezici çoğunluğu | `/api/products`, `/api/orders`, `/api/categories`, `/api/inventory`, `/api/integrations`, tüm `warehouse-settings` listeleri |
| **`{ items, total }`** | Yalnızca **2** endpoint | `/api/audit-logs`, `/api/integration-logs` — ikisi de canlı doğrulandı |
| **`{ data, pagination }`** | **Hiçbir endpoint'te yok** | — |
| Adlandırılmış zarf | Liste olmayan birkaç endpoint | `/api/auth/me` → `{ user, accessibleTenants }` · `/api/auth/refresh` ve `/switch-tenant` → `{ accessToken, refreshToken }` · `trendyol-attributes` → `{ categoryAttributes }` · `test-connection` → `{ success, message }` |

**Sayfalama sunucuda yok.** Hiçbir liste endpoint'i `page`/`limit` query DTO'su almıyor;
`{items, total}` dönen iki endpoint dışında toplam sayı da dönmüyor. P3'ün zemini budur.

## 22. Decimal serileştirmesi

Merkezî ayar **yok** — `useGlobalInterceptors`, `ClassSerializerInterceptor`, Prisma
`$extends` result transform'u, `toJSON` override'ı hiçbiri kullanılmıyor. Prisma `Decimal`
varsayılan olarak JSON'a **string** olarak gider.

| Yer | Davranış |
|---|---|
| `ProductService.mapProductResponse` | `price`, `basePrice`, `costPrice`, `weight`, `width`, `height`, `depth` → `Number()` |
| Aynı yanıttaki iç içe ilişkiler | `variants[].price`, `bundleItems.childProduct.price`, `crossSellSources.targetProduct.price` → **string** kalır |
| `OrderService` | Dönüşüm yok → `totalAmount`, `items[].unitPrice`, `items[].totalPrice` **string** |

Tek uygulamada iki farklı Decimal sözleşmesi var. P2'nin karar vermesi gereken nokta budur.

## 23. İzin envanteri

36 benzersiz izin adı, **tek adlandırma kalıbı** (`kaynak.aksiyon`):

`agencies.create`, `agencies.read`, `agencies.write`, `analytics.export`,
`analytics.financial.read`, `analytics.integration.read`, `analytics.read`,
`audit.read`, `clients.create`, `clients.write`, `integration.logs.manage`,
`integration.logs.read`, `integrations.manage`, `integrations.read`,
`integrations.settings.update`, `orders.read`, `orders.update`, `products.create`,
`products.read`, `stock.allocation.manage`, `stock.allocation.read`, `stores.create`,
`stores.write`, `system.settings.manage`, `system.settings.read`,
`system.settings.write`, `warehouse.manage`, `warehouse.settings.manage`,
`warehouse.settings.read`, `wms.labels.create`, `wms.labels.view`, `wms.print`,
`wms.settings.update`, `wms.stock.update`, `wms.stock.view`, `wms.view`

Son üç ad (`audit.read`, `integration.logs.read`, `integration.logs.manage`) P1 İŞ 3'ün
ilk yarısında seed'e eklenmişti ama hiçbir endpoint kullanmıyordu; `73fcc71` ile
kullanıma girdiler.

İki nokta (`kaynak:aksiyon`) kalıbı P1 İŞ 4'te kaldırıldı; altı ad şu karşılıklarını aldı:
`agency:create` → `agencies.create`, `agency:write` → `agencies.write`, `client:create` →
`clients.create`, `client:write` → `clients.write`, `store:create` → `stores.create`,
`store:write` → `stores.write`. `CLAUDE.md`'deki değişmez kural artık kod tabanının
tamamında geçerli.
(Yalnızca `*:*` wildcard'ı iki nokta içerir; o bir kaynak.aksiyon adı değil.)

**Seed durumu (P1 İŞ 3 + İŞ 4 sonrası):** 36 adın hepsi `prisma/seed.ts`'te tanımlı;
`permissionsList` 41 kayıt tutuyor (kullanılmayan `accounting.export`, `wms.manage` ve
`*:*` dahil). `agencies.create` ve `agencies.write` bilinçli olarak **hiçbir role bağlı
değil** — distribütör firma yönetimi `PlatformAdminGuard` ile kilitli, `super_admin` da
`*:*` ile kapsıyor.

## 24. DOĞRULANAMADI özeti

Statik okumayla kesinleştirilemeyen ve **uydurulmayan** alanlar:

| Kategori | Kapsam | Neden |
|---|---|---|
| Dönüş tipleri | ~120 endpoint | `@ApiResponse` yalnızca 11/35 controller'da; servis dönüşleri tiplenmemiş |
| İstek gövdeleri | 26 endpoint | `@Body() x: any` |
| `RbacService.listRoles` / `.listPermissions` tenant filtresi | 2 endpoint | Servise parametre geçmiyor; servis içi filtre incelenmedi |
| `StockAllocationController.calculate` veri erişimi | 1 endpoint | Tenant bağlamı yok; servis davranışı incelenmedi |
| `ProfileService` dönüş şekilleri | 10 endpoint | Tiplenmemiş |

## 25. Kapsam dışı gözlemler

P0 yalnızca doküman üretir/düzeltir; aşağıdakiler **kod** değişikliği gerektirir ve
düzeltilmedi:

1. `ProductController.searchErp` rota gölgelemesi nedeniyle erişilemez (§8).
2. ~~`AuditLogController` / `IntegrationLogController` `x-agency-id` başlığını doğrulamasız
   tenant filtresi olarak kullanıyor (§13).~~ **KAPANDI** — P1 İŞ 1 (`09dff1f`) ham başlık
   fallback'ini, P1 İŞ 3 (`73fcc71`) eksik `PermissionGuard`'ı kapattı.
3. `SettingsController.updateSettings` var olmayan `user.id` alanını okuyor (§17).
4. `SignedUrlService` imza karşılaştırması sabit zamanlı değil; `payload.purpose`
   `FilesController`'da doğrulanmıyor (§3).
5. `StockAllocationController.calculate` tenant bağlamsız (§18).
6. `ProductService.erp-search` mock veri döndürüyor (keşif raporu §"Kapsam dışı gözlemler" 5) —
   bu turda yeniden doğrulanmadı.
