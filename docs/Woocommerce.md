# KroptOS — WooCommerce Entegrasyonu (Antigravity Görev Promptu)

> Bu dosyanın tamamı Antigravity'e verilecek görev metnidir. Baştan sona yapıştır.
> Kaynak konvansiyonlar: `00_PROJECT_CONTEXT.md`, `01_FRONTEND_PAGE_ANATOMY.md`,
> `02_BACKEND_MODULE_ANATOMY.md`, `03_ROUTE_AND_MODULE_MAP.md`, `claude_04_KARGO_ENTEGRASYON_REHBERI.md`.

---

## 0. Rol ve temel ilke

Sen KroptOS monorepo'sunda çalışan bir entegrasyon geliştiricisisin. Görev: **WooCommerce'i
KroptOS'a bir satış kanalı olarak uçtan uca bağlamak** — bağlantı/kimlik, ürün ve stok/fiyat
itme, sipariş çekme, sipariş durumu geri yazma, webhook, kuyruk, frontend ekranları, testler.

Temel ilke: **`integrations/marketplaces/` altında kanıtlanmış mimariyi birebir izle,
yeni kalıp icat etme.** WooCommerce, Trendyol/N11 ile aynı porta oturur; ayrı bir ağaç açma.

İkinci ilke: **uydurma yok.** Ne KroptOS'un alan adlarını, ne WooCommerce'in endpoint/alan
adlarını hafızadan yaz. KroptOS tarafını **koddan**, WooCommerce tarafını **§5'teki
doğrulama tablosundan** al. Doğrulayamadığın şeyi `TODO(verify):` ile işaretle ve raporla —
sessizce varsayma.

---

## 1. Karar noktaları (değiştirmek istersen tek satırda değiştir)

| # | Karar | Varsayılan |
|---|---|---|
| KARAR-1 | Doğruluk kaynağı | **KroptOS master.** Katalog + stok + fiyat KroptOS → Woo yönünde itilir. Woo'da elle yapılan katalog değişikliği bir sonraki senkronda ezilir (kullanıcıya ekranda açıkça yazılır). |
| KARAR-2 | Sipariş yönü | **Woo → KroptOS** (pull + webhook). Sipariş KroptOS'ta işlenir; durum/kargo bilgisi Woo'ya geri yazılır. |
| KARAR-3 | Eşleme birimi | **1 KroptOS `Store` = 1 WooCommerce sitesi.** Aynı store'a ikinci Woo bağlantısı kurulamaz. |
| KARAR-4 | Varyant modeli | Woo `variable` ürünün her `variation`'ı KroptOS'ta **ayrı SKU** olarak eşlenir. |
| KARAR-5 | Protokol | Yalnız **HTTPS + WooCommerce REST API v3**. HTTP/OAuth1.0a yolu **kapalı** (§4.3). |
| KARAR-6 | İlk teslim kapsamı | Faz 0–6 (bağlantı → sipariş → stok/fiyat → webhook → ekran). Kupon, müşteri, iade/refund ve raporlar **kapsam dışı**; şema onları engellemeyecek şekilde tasarlanır. |

---

## 2. Faz 0 — Yazmadan önce oku (KAPI: bu bitmeden tek satır kod yok)

Aşağıdaki dosyaları oku ve **gerçek imzaları/alan adlarını** çıkar:

| Dosya | Ne çıkaracaksın |
|---|---|
| `packages/backend/src/integrations/marketplaces/core/MarketplaceConnector.ts` | Abstract sınıfın **tam metot imzaları** — WooCommerceConnector bunlara uyacak |
| `.../core/MarketplaceConnectorFactory.ts` | Kayıt kalıbı (switch mi map mi), provider anahtarının biçimi |
| `.../core/MarketplaceCredentialService.ts` | Zorunlu alan doğrulama + `decrypt()` kalıbı |
| `.../core/MarketplaceHttpClient.ts` + `MarketplaceRateLimiter.ts` | HTTP/throttle sözleşmesi, timeout, retry, hata sarmalama |
| `.../core/*Types.ts` | Ortak tipler: `NormalizedOrder`, `NormalizedProduct`, `ConnectionTestResult` gibi ne varsa — **yeni tip üretmeden önce var olanı kullan** |
| `.../trendyol/TrendyolConnector.ts` + `Mapper` + `Types` | Bir sağlayıcının tam örneği; dosya bölme ve isimlendirme düzeni |
| `packages/backend/prisma/schema.prisma` | `Integration`, `IntegrationLog`, `IntegrationQueue`, `ProductMapping`, `WebhookSubscription`, `WebhookEvent`, `Product`, `Order`, `OrderItem`, `OrderTimeline`, `Inventory` — **alan adları, tipler (Decimal mi Float mu), unique index'ler** |
| `packages/backend/src/modules/integration/*` | BullMQ kuyruk + worker + `IntegrationLog` yazım kalıbı; kuyruk adı ve job tipi konvansiyonu |
| `packages/backend/src/modules/order/*` | Sipariş oluşturma/güncelleme servis yüzeyi — dışarıdan sipariş import ederken **doğrudan Prisma'ya değil, bu servise** yazılacak mı? |
| `packages/backend/src/modules/inventory/*` | Stok okuma yüzeyi (itilecek stok değeri nereden okunur) |
| `packages/backend/src/common/utils/encryption.util` | `encrypt()` / `decrypt()` imzası ve anahtar kaynağı (env değişkeni adı) |
| `packages/backend/src/main.ts` | `rawBody` açık mı, global ValidationPipe/prefix ayarı (webhook HMAC için kritik — §9.2) |
| `packages/frontend/src/app/t/[tenantPublicId]/integrations/` | Var olan entegrasyon ağacı ekranları — üstüne kurulacak, yanına değil |
| `packages/frontend/src/app/t/[tenantPublicId]/products/` | Kanonik frontend sayfa kalıbı |
| `packages/backend/prisma/seed.ts` | RBAC izin seed kalıbı |

**Faz 0 çıktısı (kod değil, rapor):**

1. `MarketplaceConnector`'ın gerçek metot listesi ve WooCommerce'in her birine ne döndüreceği.
2. Yeniden kullanılacak Prisma modelleri + gerçek alan adları; **yeni alan gerekiyorsa gerekçesi**.
3. `Integration.provider` alanı **enum mu string mi** — enum ise migration gerekir, string ise gerekmez.
4. Sipariş tekilliği için mevcut unique index var mı (`(storeId, provider, externalOrderId)` gibi)? Yoksa eklenecek.
5. Para alanı tipi: `Decimal` / `Int` (kuruş) / `Float`. **Float ise not düş, ama bu PR'da değiştirme.**
6. Değişecek/eklenecek dosyaların tam listesi.

Bu raporu ver, **sonra** kod yazmaya başla.

> "Var mı?" sorusunun cevabını dokümandan değil koddan al. Doküman eskimiş olabilir.

---

## 3. Mimari yerleşim

```
packages/backend/src/integrations/marketplaces/woocommerce/
├── WooCommerceConnector.ts       # core/MarketplaceConnector'ı implement eder
├── WooCommerceMapper.ts          # Woo ⇄ KroptOS dönüşümü + durum normalizasyonu
├── WooCommerceTypes.ts           # Woo API cevap tipleri (ham) + credential şeması
├── WooCommerceWebhook.ts         # imza doğrulama + topic → job eşlemesi
└── __tests__/                    # (komşu sağlayıcı testleri nerede duruyorsa oraya uy)
```

Kayıt: `MarketplaceConnectorFactory`'ye `woocommerce` provider'ı eklenir.
`MarketplaceCredentialService`'e zorunlu alan doğrulaması eklenir.

**`core/` altındaki dosyalara dokunma** — tek istisna: factory kaydı, credential doğrulama
ve (gerekiyorsa) provider union'ına `'woocommerce'` eklemek. Ortak tiplere alan eklemen
gerekiyorsa önce raporla, tek başına karar verme; diğer 5 connector'ı kırma riski var.

---

## 4. Bağlantı ve kimlik modeli

### 4.1 Credential şeması

`Integration.credentials` içine **şifreli JSON** olarak yazılır:

```ts
interface WooCommerceCredentials {
  baseUrl: string;          // https://magaza.com  — şema zorunlu, sondaki / kırpılır, path yok
  consumerKey: string;      // ck_...
  consumerSecret: string;   // cs_...
  webhookSecret: string;    // bizim ürettiğimiz rastgele 32+ byte — Woo tarafına biz yazarız
  apiVersion?: 'wc/v3';     // varsayılan wc/v3
  verifySsl?: boolean;      // varsayılan true; false SADECE staging'de ve uyarı ile
}
```

- `baseUrl` ve `consumerKey` **maskelenerek** API cevabında dönebilir (`ck_••••1234`).
- `consumerSecret` ve `webhookSecret` **hiçbir koşulda** cevapta, logda, audit'te, hata
  mesajında görünmez.
- Şifreleme servis katmanında `encrypt()`/`decrypt()` ile; controller düz metin görmez.

### 4.2 Ortam ayrımı

`Integration` üzerinde bir `isTestMode` / `environment` alanı varsa kullan, yoksa
`settings` JSON'una `environment: 'sandbox' | 'production'` yaz. Sandbox modda gerçek
Woo'ya yazma çağrısı (POST/PUT/DELETE) yapılmaz; okuma serbesttir.

### 4.3 SSRF — pazarlık yok

`baseUrl` **kullanıcıdan gelir ve backend o adrese istek atar.** Bu bir SSRF yüzeyidir.
Bağlantı kaydedilirken ve **her istekten önce** doğrula:

- Şema `https` olmak zorunda (`NODE_ENV !== 'production'` iken `http://localhost` istisnası).
- Hostname DNS çözümü **private/loopback/link-local** aralığa düşerse reddet:
  `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (bulut metadata!), `::1`, `fc00::/7`.
- **Redirect takip edilmez** (`maxRedirects: 0`) veya yalnız aynı host'a izin verilir.
- Port kısıtı: 443 (ve dev'de 80/8080). Başka port reddedilir.
- Timeout zorunlu (bağlantı 10 sn, toplam 30 sn) — self-hosted siteler yavaştır ve
  timeout'suz bir istek worker'ı kilitler.

Bu kontrol tek bir `WooUrlGuard` yardımcısında toplanır ve **testi yazılır**.

### 4.4 `testConnection()` — teşhis edici olmalı

Sırayla ve **ayrı hata mesajlarıyla**:

1. `GET {baseUrl}/wp-json/` → `namespaces` içinde `wc/v3` var mı?
   Yoksa: "WooCommerce REST API bulunamadı" (WP var, Woo yok).
   404 dönerse: **kalıcı bağlantılar (pretty permalinks) kapalı olabilir** — bunu mesajda söyle
   ve `?rest_route=/wc/v3/` alternatifini dene.
2. `GET {baseUrl}/wp-json/wc/v3/system_status` (kimlikli) → 401/403 ise "anahtar geçersiz veya
   yetki yetersiz (Read/Write gerekli)".
3. Cevaptan **oku ve kaydet**: WooCommerce sürümü, WP sürümü, para birimi,
   `prices_include_tax`, timezone. Bunlar `Integration.settings`'e yazılır — sonraki
   dönüşümler bunlara bakar.
4. `{ success, message, durationMs }` (veya `core`'daki gerçek `ConnectionTestResult` tipi) döner.

---

## 5. WooCommerce API sözleşmesi

### 5.1 Kesin kabul edilenler (yine de Faz 0'da 1 gerçek çağrı ile doğrula)

| Konu | Değer |
|---|---|
| Taban | `{baseUrl}/wp-json/wc/v3` |
| Kimlik (HTTPS) | **Basic Auth**: kullanıcı = `consumerKey`, parola = `consumerSecret` |
| Basic Auth çalışmazsa | Bazı sunucular `Authorization` başlığını düşürür → HTTPS üzerinde `?consumer_key=&consumer_secret=` query fallback'i. **Fallback kullanıldıysa `IntegrationLog`'a `warn` yaz** (URL'ler proxy loglarına düşer). |
| Sayfalama | `?page=N&per_page=100` (üst sınır 100); cevap başlıkları `X-WP-Total`, `X-WP-TotalPages` |
| Hata gövdesi | `{ code, message, data: { status } }` — `message` HTML içerebilir, **sanitize et** |
| Ürün uçları | `/products`, `/products/{id}/variations`, `/products/categories`, `/products/batch` |
| Sipariş uçları | `/orders`, `/orders/{id}`, `/orders/{id}/notes` |
| Ürün tipleri | `simple`, `variable`, `grouped`, `external` |
| Stok alanları | `manage_stock` (bool), `stock_quantity` (int\|null), `stock_status` (`instock`/`outofstock`/`onbackorder`) |
| Fiyat alanları | `regular_price`, `sale_price` — **string**, para birimi yok |
| Tarih alanları | `date_created` (site TZ) **ve** `date_created_gmt` — **daima `_gmt` kullan** |
| Sipariş durumları (çekirdek) | `pending`, `processing`, `on-hold`, `completed`, `cancelled`, `refunded`, `failed`, `checkout-draft`, `trash` |
| Batch limiti | İstek başına ~100 öğe (sunucu tarafında filtrelenebilir) — 100'ü aşma |

### 5.2 Doğrulanacaklar — koda sabit yazmadan önce gerçek bir Woo'ya sor

- `modified_after` / `dates_are_gmt` parametrelerinin desteklenip desteklenmediği
  (eski WC sürümlerinde yok). Desteklenmiyorsa `after` + `orderby=modified&order=asc` yoluna düş
  ve bunu `Integration.settings.capabilities`'e yaz.
- Kurulumdaki gerçek `per_page` üst sınırı ve batch limiti.
- Eklentilerin eklediği **özel sipariş durumları** (`wc-` öneki API'de görünmez).
- Rate limit: WooCommerce'in resmî bir limiti **yok**; sınır barındırma tarafındadır
  (mod_security, Cloudflare, PHP worker sayısı). Bu yüzden §7.3'teki muhafazakâr ayarlar.
- Çoklu para birimi eklentisi varsa sipariş `currency` alanı store para biriminden farklı olabilir.

**Doğrulanmamış hiçbir alan adı koda yazılmaz.** Emin değilsen `TODO(verify):` bırak ve raporla.

---

## 6. Prisma

**Önce mevcut modelleri kullan.** Yeni model yalnız gerçekten yoksa açılır.

- **Bağlantı** → mevcut `Integration` (provider `woocommerce`). Yeni tablo açma.
- **Ürün eşleme** → mevcut `ProductMapping`. Woo'da varyantlı ürün için iki kimlik gerekir
  (`productId` + `variationId`); modelde tek `externalId` varsa
  `externalId = "{productId}:{variationId}"` yerine **ayrı alan** ekle (`externalParentId`),
  string birleştirme yapma — sorgulanamaz hale gelir.
- **Sipariş eşleme** → `Order` üzerinde dış kimlik alanı varsa onu kullan. Yoksa ekle:
  `externalOrderId String?` + `@@unique([storeId, provider, externalOrderId])`.
  **Bu unique index idempotency'nin kendisidir** (§8.1) — opsiyonel değil.
- **Webhook** → `WebhookSubscription` / `WebhookEvent` varsa kullan; yoksa
  `WooWebhookDelivery` değil, **provider-agnostik** bir model aç (`IntegrationWebhookEvent`)
  — WooCommerce'e özel tablo açmak bir sonraki sağlayıcıda ikizini yazdırır.
- **Senkron imleci (watermark)** → `Integration.settings` JSON'una
  `{ lastOrderSyncAt, lastProductSyncAt, cursor }`. Ayrı tablo gerekmez.

Yeni her modelde zorunlu: `id (uuid)`, `agencyId`, `clientId?`, `storeId`, `createdAt`,
`updatedAt`, `deletedAt?`, `@@index([agencyId])`, `@@index([storeId])`.
Tekillik **tenant ile birlikte** verilir; global `@unique` açma.

Şema akışı: diff'i `docs/plans/woocommerce-adim<N>.sql` olarak üret, lokale `pnpm db:push`
ile uygula. **`prisma migrate dev` çalıştırma.**

---

## 7. Connector ve Mapper

### 7.1 Durum normalizasyonu — sessiz hata kaynağı #1

`WooCommerceMapper` Woo sipariş durumunu KroptOS `OrderStatus`'una çevirir. Tablo
**`schema.prisma`'daki gerçek enum değerleriyle** doldurulur (aşağıdaki sağ sütun örnektir,
enum'u okuyup düzelt):

| Woo | KroptOS (doğrula) |
|---|---|
| `pending` | ödeme bekliyor |
| `processing` | onaylandı / hazırlanıyor |
| `on-hold` | beklemede |
| `completed` | tamamlandı |
| `cancelled` | iptal |
| `refunded` | iade |
| `failed` | başarısız |
| `checkout-draft` | **import edilmez** — sepet taslağı, sipariş değil |
| `trash` | import edilmez |
| bilinmeyen | `?? 'pending'` — **asla terminal duruma düşürme** |

Kural: bilinmeyen durum kodu **terminal bir duruma (tamamlandı/iptal) eşlenemez.**
Yanlış eşlenen bir `completed` siparişi kapatır, stok düşer, geri dönüşü yoktur; eşlenmemiş
kodun maliyeti bir fazladan poll'dur. **Asimetri kuralı belirler.**
Bilinmeyen kod `IntegrationLog`'a `warn` ile yazılır **ve sayılır**; eşik aşılırsa
`status_map_stale` uyarısı üretilir. Ham kod her zaman saklanır.

### 7.2 Para ve vergi — sessiz hata kaynağı #2

- Woo fiyatları **string** döner. `parseFloat` ile toplama/çıkarma **yapma**; KroptOS'un
  para tipi neyse (Decimal/kuruş) ona çevirip öyle işle.
- `prices_include_tax` **ayarı okunmadan** hiçbir toplam hesaplanmaz. KDV dahil fiyat
  gönderen bir mağazada KDV'yi bir kez daha eklemek/çıkarmak faturayı bozar.
- Sipariş toplamı **yeniden hesaplanmaz**; Woo'nun `total`, `total_tax`, `shipping_total`,
  `discount_total` alanları olduğu gibi alınır. Bizim hesabımız Woo'nunkinden farklı çıkarsa
  doğru olan Woo'nunkidir (müşteri onu ödedi) — fark `IntegrationLog`'a `warn` yazılır.
- `currency` sipariş bazında okunur, store ayarından **varsayılmaz**.

### 7.3 HTTP ve throttle

- `MarketplaceHttpClient` üzerinden git; ham `axios`/`fetch` kurma.
- Eşzamanlılık **en fazla 2–4**, sağlayıcı başına. Self-hosted WordPress'i çökertebilirsin.
- `429` ve `503` → `Retry-After` başlığına uy; yoksa üstel backoff (1s, 4s, 16s), en fazla 3 deneme.
- `5xx` → retry; `4xx` → retry **yok** (401/403/404 kalıcıdır, tekrar denemek log çöpü üretir).
- Her istek `IntegrationLog`'a: endpoint, HTTP kodu, süre, **maskeli** özet. Gövde loglanacaksa
  `billing`/`shipping` blokları (ad, telefon, e-posta, adres) **maskelenir** — KVKK.

### 7.4 Ürün eşleştirme sırası (fallback zinciri)

1. `ProductMapping` kaydı (kesin).
2. SKU eşleşmesi (`storeId` kapsamında tekil).
3. Eşleşme yok → **eşleşmemiş olarak kuyruğa düşür**, kullanıcıya ekranda göster.

**İsim/başlık benzerliğiyle eşleştirme yasak.** Yanlış ürünün stoğunu düşürür.
Woo'da SKU **boş olabilir** — bu durumda 2. adım atlanır, doğrudan 3'e düşülür.

---

## 8. Senkron akışları

Tümü **mevcut `modules/integration` BullMQ altyapısını** kullanır. Yeni kuyruk sistemi kurma.
İş tipleri (adlandırmayı mevcut kalıba uydur):

`woo.orders.pull` · `woo.order.upsert` · `woo.stock.push` · `woo.price.push` ·
`woo.product.push` · `woo.order.status.push` · `woo.webhook.process`

### 8.1 Sipariş çekme (pull) — idempotency

Akış: `GET /orders?modified_after={watermark}&per_page=100&orderby=modified&order=asc`
→ sayfa sayfa → her sipariş için `woo.order.upsert` job'ı.

Idempotency **unique index ile** sağlanır, `findFirst → create` ile değil:

```
upsert(where: { storeId_provider_externalOrderId: {...} }, create: {...}, update: {...})
```

`findFirst` sonra `create` bir TOCTOU'dur: webhook ve poll aynı siparişi aynı anda getirdiğinde
iki `Order` satırı oluşur, ikisi de depoya düşer, **aynı sipariş iki kez kargolanır.**

Watermark kuralları:
- İmleç **işlenen en büyük `date_modified_gmt`** değil, **`(en büyük - 60sn)`** olarak kaydedilir.
  Aynı saniyede oluşan siparişler sayfa sınırında kaybolur.
- İmleç yalnız **sayfa tamamen başarıyla işlendikten sonra** ilerletilir. Ortada patlarsa
  imleç ilerlemez; tekrar okumak zararsızdır (upsert idempotent), atlamak değildir.
- İlk senkronda imleç yoksa: kullanıcıya "kaç gün geriye gidilsin?" sorulur (varsayılan 30 gün).
  Tüm geçmişi çekmek 50.000 siparişlik bir mağazada siteyi düşürür.

### 8.2 Stok ve fiyat itme (push)

- Tetik: KroptOS'ta stok/fiyat değişimi → job. **Her değişimde tek tek istek atma**;
  debounce + `POST /products/batch` ile topla (≤100 öğe).
- Varyantlı üründe stok **variation** ucuna yazılır; parent'a yazmak sessizce hiçbir şey yapmaz.
- `manage_stock: true` set edilmemişse `stock_quantity` yok sayılır — önce onu gönder.
- Stok 0 → `stock_status: 'outofstock'` de gönderilir (tema/eklenti buna bakar).
- Rezerve stok mantığı KroptOS'ta ne ise o itilir; Woo'da ikinci bir rezervasyon mantığı kurma.

### 8.3 Sipariş durumu geri yazma

- KroptOS'ta sipariş kargolandığında → `PUT /orders/{id}` `{ status: 'completed' }`
  (veya kullanıcının seçtiği durum — ayarlanabilir olsun, sabitleme).
- Takip numarası: Woo çekirdeğinde **standart bir takip alanı yoktur.** Kargo eklentileri
  kendi meta anahtarlarını kullanır. Bu yüzden:
  1. `POST /orders/{id}/notes` ile **müşteriye görünür not** (`customer_note: true`) yaz — bu her kurulumda çalışır.
  2. `meta_data` ile eklenti anahtarına yazmak **opsiyonel** ve ayarlanabilir olsun
     (`settings.trackingMetaKey`), varsayılan kapalı. **Anahtar adını uydurma.**
- Geri yazma da idempotent: aynı durum ikinci kez gönderilirse Woo hata vermez ama
  gereksiz webhook tetikler → mevcut durumu kontrol et, aynıysa çağrı yapma.

---

## 9. Webhook

### 9.1 Kurulum

Bağlantı kurulurken `POST /wp-json/wc/v3/webhooks` ile abone ol:
`order.created`, `order.updated`, `product.updated` (KARAR-1 gereği ürün tarafı yalnız
gözlem amaçlı, katalog geri yazılmaz).

- `delivery_url` = `{PUBLIC_API_URL}/api/integrations/woocommerce/webhook/{integrationId}`
- `secret` = **bizim ürettiğimiz** `webhookSecret` (boş bırakılırsa Woo consumer secret'ı
  kullanır — bunu yapma, sır dolaşıma girer).
- Oluşturulan webhook id'leri `Integration.settings.webhookIds`'e yazılır; bağlantı
  silinince Woo'dan da silinir (yetim webhook her 30 saniyede bir sitenize istek atar).

### 9.2 Doğrulama — atlanırsa endpoint herkese açıktır

- İmza: `X-WC-Webhook-Signature` = `base64(HMAC-SHA256(rawBody, secret))`.
- **Ham gövde (raw body) şart.** NestJS gövdeyi parse edip yeniden serialize ederse imza
  tutmaz. `main.ts`'te bu route için `rawBody` açık olmalı — Faz 0'da kontrol ettiğin madde.
- Karşılaştırma **`crypto.timingSafeEqual`** ile; `===` ile değil.
- `X-WC-Webhook-Source` kayıtlı `baseUrl` ile eşleşmeli.
- `X-WC-Webhook-Delivery-ID` ile **dedup**: Woo teslimatı at-least-once'tır, aynı olay
  birden çok kez gelir.
- Bu endpoint `AuthGuard`/`TenantGuard` **kullanmaz** (Woo JWT taşımaz); tenant bağlamı
  `integrationId` üzerinden **sunucu tarafında** çözülür. Bu, tenant filtresi kuralının
  istisnası değil — bağlam header'dan değil kayıttan gelir, filtre yine uygulanır.
- Rate limit uygula (`@nestjs/throttler`), aksi hâlde açık uç DoS yüzeyidir.

### 9.3 İşleme

Handler **hiçbir iş yapmaz**: imzayı doğrular, olayı kaydeder, kuyruğa atar, `200` döner.
Woo yavaş cevabı başarısızlık sayar ve webhook'u devre dışı bırakabilir.

**Webhook tek başına yeterli değildir.** Woo webhook'ları PHP `shutdown` üzerinde çalışır;
sunucu yeniden başlarsa, eklenti çakışırsa veya site cache'lenirse olay **hiç gelmez**.
Bu yüzden §8.1'deki periyodik pull **kapatılamaz** — webhook gecikmeyi düşürür, güvenilirliği değil.

---

## 10. Backend modül ve endpoint sözleşmesi

Faz 0'da `modules/integration`'ın mevcut uçlarını gördün. **Genel bağlantı CRUD'u zaten
varsa oraya provider ekle, yeni controller açma.** Yalnızca WooCommerce'e özel uçlar için
`modules/integration/woocommerce/` alt klasörü aç.

| Metot | Uç | İzin | Not |
|---|---|---|---|
| POST | `/api/integrations/woocommerce` | `integrations.create` | Bağlantı kur, `encrypt()`, testConnection çalıştır — 201 |
| PATCH | `/api/integrations/woocommerce/:id` | `integrations.update` | 200 |
| DELETE | `/api/integrations/woocommerce/:id` | `integrations.delete` | Soft delete + Woo'daki webhook'ları sil — 204 |
| POST | `/api/integrations/woocommerce/:id/test` | `integrations.read` | Teşhis çıktısı — 200 |
| POST | `/api/integrations/woocommerce/:id/sync` | `integrations.sync` | `{ scope: 'orders'\|'products'\|'stock' }` → job kuyruğa — 202 |
| GET | `/api/integrations/woocommerce/:id/status` | `integrations.read` | Watermark, son senkron, kuyruk derinliği, hata sayısı — 200 |
| GET | `/api/integrations/woocommerce/:id/mappings` | `integrations.read` | Eşleşen/eşleşmeyen ürünler — 200 |
| POST | `/api/integrations/woocommerce/webhook/:integrationId` | **yok (imza ile)** | 200, gövdesiz |

Kurallar:
- Webhook ucu hariç hepsinde `@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionGuard)` +
  `@RequirePermission(...)`.
- Servis **her sorguda** `agencyId/clientId/storeId` filtresi + `deletedAt: null`; tekil
  erişimde `findUnique` değil `findFirst` + scope; bulunamazsa `NotFoundException`.
- Her mutasyon `auditLog.create({ action, entityId, userId, agencyId, ipAddress })`.
  **Credential değeri audit'e yazılmaz.**
- Swagger: `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse`, üç `@ApiHeader`.
- DTO'lar `class-validator` (Create/Update/Response ayrı). `baseUrl` için `@IsUrl({ protocols: ['https'] })`.
- **Ağ çağrısı uzun DB transaction'ı içinde yapılmaz.**
- Yeni RBAC izinleri `prisma/seed.ts`'e eklenir.

---

## 11. Frontend

`01_FRONTEND_PAGE_ANATOMY.md` iskeletini birebir izle.

```
src/app/t/[tenantPublicId]/integrations/woocommerce/
├── page.tsx                          # ince: bağlam guard + kompozisyon
├── hooks/useWooCommerce.ts           # tüm state + apiFetch çağrıları
└── components/
    ├── WooConnectionCard.tsx         # bağlı/bağlı değil, sürüm, para birimi, son senkron
    ├── WooConnectionFormModal.tsx    # baseUrl + ck + cs + ortam; "Bağlantıyı test et"
    ├── WooSyncPanel.tsx              # manuel senkron butonları + kuyruk durumu
    ├── WooMappingTable.tsx           # eşleşen/eşleşmeyen ürünler, filtre + sayfalama
    ├── WooLogTable.tsx               # IntegrationLog akışı (maskeli)
    └── DeleteConfirmModal.tsx
```

Zorunlu:
- `'use client'`; veri erişimi **yalnız** `@/lib/api` → `apiFetch`; ham `fetch` yasak.
- Yol `/integrations/woocommerce` yazılır, başına `/api` konmaz.
- `useAuth().tenantContext.storeId` yoksa "Store Seçimi Gerekli" boş durumu.
- Stil **yalnız** `kp-*` token sınıfları; ham hex veya Tailwind palet rengi yok.
  İkonlar `@heroicons/react/24/outline`.
- Sidebar'a nav item; i18n anahtarları **en az** `messages/tr.json` ve `messages/en.json`.
- Layout tekrar sarılmaz.

UX kuralları:
- Consumer secret formda girildikten sonra **bir daha gösterilmez** (`cs_••••`), yalnız değiştirilebilir.
- KARAR-1 ekranda açıkça yazılır: *"Katalog ve stok KroptOS'tan yönetilir; WooCommerce'te
  yapılan değişiklikler bir sonraki senkronda geri alınır."*
- Bağlantı kurulumu için 3 adımlı yardım metni: WooCommerce → Ayarlar → Gelişmiş → REST API →
  Anahtar ekle → **Read/Write** yetkisi. Yanlış yetki en sık destek çağrısıdır.
- Hata bannerı `IntegrationLog`'un son hatasını gösterir; "Tekrar dene" butonu job'ı yeniden kuyruğa atar.

---

## 12. Test ve Definition of Done

### Testler (mock-first — CI'da gerçek çağrı yok)

- [ ] `WooCommerceMapper`: durum tablosu; **bilinmeyen durum terminale düşmüyor** testi
- [ ] Mapper: `prices_include_tax` iki durumu; para birimi sipariştenden okunuyor
- [ ] Mapper: `variable` ürün → variation başına ayrı SKU; SKU boş olan yol
- [ ] Credential doğrulama: eksik alan, `http://` şeması, sondaki `/`
- [ ] `WooUrlGuard`: private IP, redirect, port, DNS rebinding
- [ ] Webhook imzası: geçerli / geçersiz / gövde değiştirilmiş / delivery-id tekrarı
- [ ] Idempotency: **iki eşzamanlı** aynı sipariş importu → tek `Order`, tek `OrderTimeline`
- [ ] Watermark: sayfa ortasında hata → imleç ilerlemiyor
- [ ] HTTP: 429 + `Retry-After` uygulanıyor; 4xx retry edilmiyor
- [ ] Servis: tenant filtresi olmadan sorgu yok (grep ile de doğrula)

### DoD

- [ ] `marketplaces/woocommerce/` altında Connector + Mapper + Types + Webhook
- [ ] `MarketplaceConnectorFactory` kaydı + `MarketplaceCredentialService` doğrulaması
- [ ] Prisma değişiklikleri `docs/plans/woocommerce-adim<N>.sql` olarak üretildi, `db:push` uygulandı
- [ ] Sipariş tekilliği unique index'i mevcut ve upsert onu kullanıyor
- [ ] Kuyruk işleri `modules/integration` altyapısında; yeni kuyruk sistemi yok
- [ ] Webhook ucu imza + kaynak + dedup doğruluyor; ham gövde okunuyor
- [ ] Webhook devre dışıyken periyodik pull tek başına doğru çalışıyor (test edildi)
- [ ] Credential'lar şifreli, cevapta maskeli, logda/audit'te yok
- [ ] PII maskelemesi `IntegrationLog`'ta doğrulandı
- [ ] RBAC izinleri seed'e eklendi; Swagger dekoratörleri tam
- [ ] Frontend: bağlantı kurma → test → senkron → eşleme tablosu → log akışı çalışıyor
- [ ] i18n anahtarları `tr.json` + `en.json`
- [ ] `pnpm lint && pnpm test && pnpm build` yeşil
- [ ] Gerçek bir Woo kurulumunda (docker veya staging) **en az 1 sipariş** uçtan uca aktı:
      Woo siparişi → KroptOS `Order` → durum güncelleme → Woo'da not göründü.
      **Bu madde işaretlenmeden entegrasyon "hazır" sayılmaz.**

---

## 13. Yasaklar

- WooCommerce endpoint/alan adı/durum kodu **uydurmak**; doğrulanmamış bilgiyi kesinmiş gibi kullanmak
- Mock cevabı gerçek gibi göstermek, gerçek çağrı yapmadan bağlantıyı `LIVE`/`VERIFIED` işaretlemek
- `findFirst → create` ile sipariş yazmak (unique index + upsert zorunlu)
- Bilinmeyen Woo durumunu terminal duruma (`completed`/`cancelled`) eşlemek
- Ürünleri **isim benzerliğiyle** eşleştirmek
- Para değerlerini `parseFloat` ile toplayıp çıkarmak; `prices_include_tax` okumadan toplam hesaplamak
- `date_created` (site TZ) kullanmak — `_gmt` dururken
- Credential'ı loglamak, audit'e yazmak, API cevabında döndürmek
- Webhook ucunu imza doğrulamadan açmak; imzayı `===` ile karşılaştırmak
- `baseUrl`'i SSRF kontrolünden geçirmeden istek atmak
- Yeni kuyruk/HTTP istemcisi/tip sistemi kurmak; `core/`'daki ortak tipleri diğer connector'ları
  kıracak şekilde değiştirmek
- WooCommerce'e özel alanları `Order`/`Product` çekirdek modellerine düz alan olarak eklemek
- Frontend'de ham `fetch`, ham hex renk, `/api` önekli yol
- `prisma migrate dev` çalıştırmak
- `eticaret-system/` klasörüne dokunmak (arşiv)
- Tek dev dosya yazmak, alakasız dosyaları değiştirmek, kullanıcının değişikliğini silmek

---

## 14. Çalışma protokolü ve PR sırası

Her faz **ayrı PR**. Branch: `feature/woocommerce-<faz>`. Conventional Commits
(`feat(integrations): WooCommerce connector ve credential doğrulaması ekle`).
Push öncesi `pnpm lint && pnpm format && pnpm test`.

| PR | İçerik |
|---|---|
| 1 | Faz 0 raporu + Prisma/kontrat değişiklikleri (şema, tipler, factory kaydı) — **tablolar boşken bedava** |
| 2 | `WooCommerceConnector` + `Mapper` + `Types` + `testConnection` + testler |
| 3 | Sipariş pull + upsert idempotency + watermark + kuyruk işleri |
| 4 | Stok/fiyat push + batch + ürün eşleme |
| 5 | Webhook (kurulum + imza + dedup + işleme) |
| 6 | Backend uçları + RBAC + Swagger |
| 7 | Frontend sayfası + i18n |
| 8 | Uçtan uca doğrulama (gerçek Woo) + DoD raporu |

**Kod yazılır yazılmaz commit'le** — untracked bir modül bir `git clean -fd`'ye uzaklıkta.
Bir katmanın "var" olduğunun kanıtı `git ls-files`'tır, oturum özeti değil.

### Çalışma sonu raporu (her PR'da)

1. Okunan dosyalar ve `marketplaces/`'ten devralınan kalıplar
2. Oluşturulan/değiştirilen dosya listesi
3. **Gerçekten doğrulanan** WooCommerce davranışları (hangi çağrı, hangi sürüm) —
   ve **doğrulanamayanlar, açıkça**
4. Test sonuçları: `pnpm lint && pnpm test && pnpm build`
5. Şema durumu: üretilen SQL, `db:push` uygulandı mı
6. Güvenlik: şifreleme, maskeleme, PII, tenant filtresi, SSRF guard
7. Açık `TODO(verify):` maddeleri ve neyin beklendiği