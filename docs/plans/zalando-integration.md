# Zalando entegrasyonu — durum ve açık kalanlar

**Durum:** connector yazıldı, sağlayıcı registry'ye KAYDEDİLMEDİ.
Katalog kartı "Çok yakında" olarak duruyor.
**Tarih:** 2026-08-12

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

**Hangi modelde olduğunuz teyit edilmeden stok/fiyat tarafı yazılmamalı.** İkisi
farklı host, farklı kimlik doğrulama, farklı veri biçimi kullanıyor. Connector'ın
`updateStock` hata mesajı da bu uyarıyı taşıyor.

---

## Doğrulanan — Zalando'nun yayımladığı Authentication OpenAPI spec'inden

Kaynak: `https://developers.merchants.zalando.com/docs/openapi/specs/authentication.json`
(kamuya açık, çekilebildi)

| | Değer |
|---|---|
| Host (production) | `https://api.merchants.zalando.com` |
| Host (sandbox) | `https://api-sandbox.merchants.zalando.com` |
| Token yolu | `POST /auth/token` |
| Kimlik yolu | `GET /auth/me` |
| Token isteği | `application/x-www-form-urlencoded` |
| Kimlik doğrulama | **Basic** (`merchant_client`) — client id : client secret |
| Grant | `client_credentials` |
| Scope | `access_token_only` — **2021-07-21'den beri gerekli değil**, standart yetkilendirme bu |
| Yanıt alanları | `access_token`, `token_type`, `expires_in`, `scope` |

Ayrıca doğrulandı: **zDirect'te yeni oluşturulan uygulamalar varsayılan olarak
sandbox modundadır.** Doğru görünen bir client id'nin production'da başarısız
olmasının en yaygın sebebi budur; connector'ın hata mesajı bunu söylüyor.

**Bu, bağlantı testinin gerçekten çalışması için yeterli.** `testConnection`
bilerek `/auth/me` kullanıyor — iş uç noktalarından hiçbirine bağımlı değil,
yani doğrulanmamış bir yol yüzünden yanlış negatif vermez.

---

## Doğrulanamayan

Zalando yalnızca authentication spec'ini kamuya açık servis ediyor; `orders.json`
ve `stocks.json` denemeleri **403** döndü.

### Sipariş yolu — türetildi, teyit edilmedi

Zalando'nun yayımladığı operation id: `get-merchants-by-id-orders`
(oluşturma ve değiştirme tarihine göre filtrelenebiliyor).

Bu ad + Zalando'nun kendi RESTful API Guidelines'ı → `GET /merchants/{merchantId}/orders`
şeklinde türetildi ve kodda **tek bir yerde** duruyor (`PATHS.orders`). Farklıysa
oradan düzeltilir.

Teyit edilecekler:
1. Yolun kendisi
2. Sayfalama parametre adları — kod `limit` / `offset` varsayıyor
3. Tarih filtresi adı — kod `created_after` varsayıyor
4. Yanıt zarfı — kod hem `items` hem `content` deniyor
5. `ZalandoTypes.ts` içindeki tüm alan adları (hepsi tahmin)

### Stok / fiyat / ürün / kategori yolları — hiç bilinmiyor

`UNCONFIRMED_PATHS` içinde `null`. Çağrılırsa doldurulacak sabitin adını söyleyen
hata veriyor. `updateStock` throw etmiyor, başarısız **sonuç** dönüyor —
senkronizasyon SKU'ları dolaşıyor, desteklenmeyen tek işlem tüm koşuyu
durdurmamalı.

### Diğer

- **Tutar birimi:** kod tutarları **major unit** (ör. 49.90 EUR) olarak okuyor —
  Temu'nun tam tersi. Yanlışsa her sipariş 100 kat sapar. Tek fonksiyonda izole,
  kendi testi var.
- `merchantId`'nin nereden alınacağı (panelde mi, `/auth/me` yanıtında mı).
  Connector `/auth/me` yanıtındaki `merchant_id`'yi bağlantı testinde gösteriyor;
  oradan otomatik doldurulabilir mi, teyit edilmeli.
- Token ömrü: spec `expires_in` alanını tanımlıyor ama sabit değer vermiyor.
  Kod yanıttaki değere güveniyor, yalnızca hiç yoksa 3600'e düşüyor.
- Rate limit değerleri.
- Sipariş durumu sözlüğü — yalnızca tutarlı görülen eşleme çevriliyor, gerisi
  `pending`.

---

## Açmak için

1. Satıcı modelini teyit et (zDirect / Connected Retail).
2. Sipariş yolunu ve parametrelerini doğrula → `PATHS.orders`.
3. Stok/fiyat yollarını al → `UNCONFIRMED_PATHS`.
4. `manifest.registry.ts` içindeki `OVERRIDES` dizisine `zalandoOverride` ekle —
   tek satır. Çeviriler zaten hazır ve kaydedilmemiş-manifest testi onları
   koruyor.

## Doğrulama sırası (öneri)

1. **Önce `testConnection`.** Kimlik doğrulama tamamen doğrulanmış olduğu için
   bu bugün çalışmalı. Çalışmıyorsa sorun kimlik bilgilerinde veya sandbox
   modundadır, kodda değil.
2. `/auth/me` yanıtındaki scope listesine bak — hangi iş uç noktalarına yetki
   verildiğini o söyler ve hangi API'lerin isteneceğini belirler.
3. Sipariş yolunu dene; tutar birimini **gerçek bir siparişle** doğrula.
