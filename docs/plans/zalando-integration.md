# Zalando entegrasyonu — durum ve açık kalanlar

**Durum:** connector yazıldı, sipariş ve stok yolları spec'e göre gerçeklendi,
sağlayıcı registry'ye **KAYDEDİLMEDİ**. Katalog kartı "Çok yakında" duruyor.
**Satıcı modeli:** zDirect (kullanıcı tarafından teyit edildi, 2026-08-13).
**Tarih:** 2026-08-13

---

## ⚠️ Önce bu: Zalando'nun iki farklı ürünü var

Bunlar birbirinin yerine geçmez ve **protokolleri tamamen ayrıdır**:

### 1. zDirect Partner Platform — *bu connector'ın hedefi*

Eski adıyla Merchant Platform. Satıcı Zalando pazaryerinde satar.

- REST API, **OAuth2 client-credentials**
- Host: `api.merchants.zalando.com` / `api-sandbox.merchants.zalando.com`
- Ürün yaşam döngüsü, fiyat/stok, sipariş çekme, ZFS stok hareketleri

### 2. Connected Retail (FCI) — *bu connector'ın hedefi DEĞİL*

Fiziksel mağazaların stoğunu Zalando'ya açması için. **Dosya tabanlı**:

- Stok güncellemesi: `PUT https://merchants-connector-importer.zalandoapis.com/{Client ID}/{Stock File Name}`
- Kimlik doğrulama: `x-api-key` başlığı — OAuth **değil**
- POS/ERP'den periyodik dosya gönderimi bekleniyor

---

## Kanıt seviyeleri

Bu dosyadaki her iddia üç kovadan birine düşer. Kod da aynı ayrımı taşıyor.

### A. Birinci elden doğrulanmış — Zalando'nun kendi sunucusundan çekildi

Kaynak: `https://developers.merchants.zalando.com/docs/openapi/specs/authentication.json`

| | Değer |
|---|---|
| Host (production) | `https://api.merchants.zalando.com` |
| Host (sandbox) | `https://api-sandbox.merchants.zalando.com` |
| Token yolu | `POST /auth/token` |
| Kimlik yolu | `GET /auth/me` |
| Token isteği | `application/x-www-form-urlencoded` |
| Kimlik doğrulama | **Basic** (`merchant_client`) — client id : client secret |
| Grant | `client_credentials` |
| `/auth/token` yanıtı | `access_token`, `token_type`, `expires_in`, `scope` |
| `/auth/me` yanıtı | `client_id`, `user_id`, `username`, **`bpids`**, `groups`, `scopes` |
| 429 başlıkları | `X-Flow-Id`, `Retry-After`, `X-Rate-Limit` |

**Satıcı kimliği `bpids` dizisinden gelir.** `/auth/me` yanıtında `merchant_id`
diye bir alan **yok**; spec'in kendi ifadesi: *"a bpid is also known as a
Merchant Identifier"*. Connector'ın önceki sürümü `merchant_id` okuyordu ve
gerçek her hesapta "satıcı bulunamadı" derdi. Bağlantı testi artık girilen
Satıcı ID'yi `bpids` listesiyle karşılaştırıp uyuşmazsa reddediyor.

Ayrıca doğrulandı: **zDirect'te yeni oluşturulan uygulamalar varsayılan olarak
sandbox modundadır.** Doğru görünen bir client id'nin production'da başarısız
olmasının en yaygın sebebi budur.

### B. Aynadan alınmış — güçlü destekleyici kanıt var, birinci el yok

Zalando yalnızca authentication spec'ini kendi sunucusundan servis ediyor.
Diğer bütün spec yolları **403** dönüyor; `developers.merchants.zalando.com/openapi/*.json`
ise hangi dosya istenirse istensin aynı 76 KB'lık dokümantasyon SPA kabuğunu
200 ile döndürüyor — yani orada da spec yok.

Orders / stocks / prices spec'leri şu kamuya açık aynadan alındı:
`https://github.com/api-evangelist/zalando` (`openapi/zalando-*-api-openapi.yml`).

Destekleyen deliller:
- Zalando'nun yayımladığı operation id `get-merchants-by-id-orders` ile yol örtüşüyor
- `/merchants/{merchant-id}/…` kalıbı authentication spec'iyle aynı
- JSON:API zarfı Zalando'nun kendi RESTful API Guidelines'ının dayattığı biçim
- `bpids` ↔ merchant-id eşleşmesi birinci elden doğrulanmış spec'le tutarlı

**Bu kanıt "yazmaya yeter" seviyesindedir, "çalışıyor demeye" yetmez.**

#### Siparişler — `GET /merchants/{merchant-id}/orders`

- Yanıt **JSON:API**: `application/vnd.api+json`, `data` / `included` / `meta`
- Sayfalama **`page[number]` ve `page[size]`** — `limit`/`offset` değil.
  `page[size]` varsayılanı 50, üst sınırı spec'te yazmıyor; kod bu yüzden
  tahmini bir tavan yerine belgelenmiş varsayılanı kullanıyor.
- Filtreler: `created_after`, `created_before`, `last_updated_after`,
  `last_updated_before`, `order_status`, `order_number`, `locale`, `exported`,
  `order_type`, `sales_channel_id`
- `include`: `order_transitions`, `order_items`, `order_lines`,
  `order_lines.order_line_transitions`, `shipments`
- **Para sipariş üstünde değil, sipariş satırlarında.** `OrderItemAttributes`
  hiç fiyat taşımıyor; `include=order_items,order_lines` olmadan sipariş
  parasız gelir.
- `OrderStatus` yalnızca `initial` / `approved` / `fulfilled` — **iptal durumu
  yok**. İptal sadece satır seviyesinde (`OrderLineStatus`: `initial`,
  `reserved`, `shipped`, `returned`, `canceled`). Mapper bu yüzden tüm
  satırları iptalse siparişi `cancelled` sayıyor.
- **Tutar birimi: major unit.** `Money.amount` spec'te "Amount with 2 digits
  after the decimal separator", örnek `99.95`. Temu'nun tam tersi. Tek
  fonksiyonda izole, kendi testi var.
- Sipariş toplamı = `order_lines_price_amount` + `shipping_costs.amount`.

#### Stok — `POST /merchants/{merchant-id}/stocks`

- Gövde: `{ items: [{ sales_channel_id, ean, quantity }] }`, tek istekte 1000'e kadar
- Scope: `products/stock/write`
- Yanıt **207**: HTTP çağrısı başarılı olsa bile her kalem kendi sonucunu
  taşır (`ACCEPTED` / `REJECTED` / `FAILED` + kod 0/101/102/104). Sadece
  durum koduna bakmak her reddi başarı sayardı.
- **Stok EAN (GTIN-13) + satış kanalı ile eşlenir, SKU ile değil.** Connector
  13 haneli olmayan bir tanımlayıcıyı çağrı yapmadan reddediyor.

#### Fiyat — `POST /merchants/{merchant-id}/prices`

Spec elde ve anlaşıldı (`{ product_prices: [{ ean, sales_channel_id,
regular_price, promotional_price?, scheduled_prices? }] }`, major unit).
**Gerçeklenmedi:** bu sistemde bir connector'a fiyat gönderten hiçbir yol yok —
`MarketplaceConnector` üzerinde `updatePrice` yok, `integration-sync.worker`
içinde buna varan bir olay yok. Yazılsa çağrılmayan kod olurdu. Manifest de bu
yüzden `price.push` yeteneğini **istemiyor**; istese hiçbir şey yapmayan bir
fiyat sekmesi açılırdı.

### C. Hâlâ hiç bilinmiyor

- **Ürün / makale listeleme.** Spec yok. `getProducts` reddediyor.
- **Kategori / özellik ağacı.** Spec yok. `getCategories` reddediyor.
- Rate limit değerleri. Manifest 60/dk varsayıyor — DOĞRULANAMADI.
- Her satış kanalının hangi para biriminde kapandığı. Yük bunu söylediği yerde
  okunuyor; tahmini bir ülke→para tablosu **yok**.

---

## Kimlik bilgileri

| Alan | Neden credential (settings değil) |
|---|---|
| `clientId` / `clientSecret` | OAuth |
| `merchantId` | İş uç noktalarında yol parametresi — ilk çağrıda lazım |
| `salesChannelId` | Stok her zaman bir satış kanalına gider — ilk çağrıda lazım |

Settings kaydı entegrasyon oluştuktan *sonra* yazılır; connector ise ilk
çağrısında bu değerlere ihtiyaç duyar. Credential olarak toplanınca
`MarketplaceCredentialService.validate()` eksik bir create'i hiçbir şey
kalıcılaşmadan reddediyor.

**Satış kanalı başına bir entegrasyon kaydı** — Trendyol Global'in `country`'si
ve eBay'in marketplace'i ile aynı kural. Satış kanalı, Zalando'nun fiyat, stok
ve siparişi ilişkilendirdiği birim; ikisi tek kayıtta duramaz.

---

## Açmak için

1. Gerçek bir zDirect hesabıyla **`testConnection`**. Kimlik doğrulama birinci
   elden doğrulanmış olduğu için bu bugün çalışmalı. Çalışmıyorsa sorun kimlik
   bilgilerinde veya sandbox modundadır, kodda değil.
2. `/auth/me` yanıtındaki `scopes` listesine bak — hangi iş uç noktalarına
   yetki verildiğini o söyler. `orders/read` ve `products/stock/write` var mı?
3. **Sipariş çek.** Doğrulanacaklar, önem sırasıyla:
   - Yol ve JSON:API zarfı gerçekten aynadaki gibi mi (`PATHS.orders`)
   - `page[number]` / `page[size]` kabul ediliyor mu
   - **Tutar birimi gerçek bir siparişle** — yanlışsa her sipariş 100 kat sapar
   - `include=order_items,order_lines` satırları ve fiyatları getiriyor mu
4. **Tek bir EAN'a stok gönder** ve 207 gövdesindeki `status` alanını gör.
5. Yalnız bunlar geçtikten sonra: `manifest.registry.ts` içindeki `OVERRIDES`
   dizisine `zalandoOverride` ekle — tek satır. Çeviriler hazır ve
   kaydedilmemiş-manifest testi onları koruyor.

Ölçüm sonuçları commit mesajının gövdesine yazılır (CLAUDE.md §7).

---

## Kayıtlı olmayan sağlayıcı nasıl korunuyor

`manifest.i18n.spec.ts` içindeki `UNREGISTERED` listesi zalando'yu da geziyor,
yani sağlayıcı registry'de olmasa bile çevirileri her locale için test ediliyor.
Kaydetmek gerçekten tek satır kalıyor; ekranı ham anahtarlarla dolduran bir
sürprize dönüşmüyor.
