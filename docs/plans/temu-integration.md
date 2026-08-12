# Temu entegrasyonu — açık kalan bilgiler

**Durum:** connector yazıldı, sağlayıcı registry'ye KAYDEDİLMEDİ.
Katalog kartı "Çok yakında" olarak duruyor.
**Tarih:** 2026-08-12

Bu not, ISV paneline girildiğinde neyin aranacağını önden yazar. Amaç, o an
sıfırdan araştırma yapmak yerine doğrudan doğrulanacak maddelere gitmek.

---

## Kod bugün nerede

| Parça | Durum |
|---|---|
| İmza algoritması | Yazıldı, 13 test. `TemuSignature.ts` |
| POST zarfı (`type`, `app_key`, `access_token`, `timestamp`, `data_type`, `sign`) | Yazıldı |
| İş hatası çözümleme (`success:false` → hata) | Yazıldı |
| Gateway host'u | **Koda yazılmadı** — `apiUrl` credential'ı olarak satıcıdan alınıyor |
| Sipariş metodu | `bg.order.list.v2.get` — Temu doküman navigasyonunda görüldü |
| Ürün / stok / kategori metotları | `METHODS` içinde `null`; çağrılırsa doldurulacak sabitin adını söyleyen hata veriyor |
| Manifest | `temu.settings.ts` yazıldı, `OVERRIDES`'a **eklenmedi** |
| Çeviriler | `tr.json`'a eklendi, kaydedilmemiş manifest testi bunları koruyor |

Açmak için gereken: aşağıdaki metot adları doğrulanır → `METHODS` doldurulur →
`manifest.registry.ts` içindeki `OVERRIDES` dizisine `temuOverride` eklenir.
Bu son adım tek satır.

---

## Aday metot adları — DOĞRULANMADI

Aşağıdaki adlar `partner.temu.com` doküman sayfalarının **indekslenmiş
başlıklarından** geldi. Sayfa içerikleri JavaScript ile render edildiği için
**parametreleri, istek/yanıt gövdeleri ve hangi sürümün geçerli olduğu
görülemedi.**

Bu yüzden **koda yazılmadılar.** Yanlış bir RPC adı, her senkronizasyonda opak
bir hata kodu olarak döner ve hatanın kaynağını bulmak günler alır.

| Aday ad | Muhtemel karşılığı | Bizdeki yeri |
|---|---|---|
| `bg.open.accesstoken.create` | Access token üretimi / yenileme | Bugün token elle yapıştırılıyor; bu metot varsa yenileme otomatikleşebilir |
| `bg.local.goods.sku.list.query` | SKU / ürün listeleme | `METHODS.products` |
| `bg.local.goods.stock.edit` | Stok güncelleme | `METHODS.stock` |
| `bg.local.goods.priceorder.change.sku.price` | Fiyat güncelleme | Şu an karşılığı yok — connector fiyat göndermiyor |

Ayrıca daha önce görülen ve şu an kullanılan tek ad:

| `bg.order.list.v2.get` | Sipariş listeleme | `METHODS.orders` — **kullanımda**, ama parametreleri yine doğrulanmadı |

### Panelde bunlarla ne yapılacak

Her ad için şunlar alınmalı:

1. **Tam istek parametreleri** (adlar ve zorunluluk durumu) — özellikle sayfalama
   alanlarının adları (`page_number`/`page_size` varsayımı doğrulanmalı).
2. **Yanıt gövdesinin şekli** — `TemuTypes.ts` içindeki alan adları tahminle
   yazıldı, hepsi doğrulanmalı.
3. **Tutar birimi** — kod şu an tutarların **minor unit (kuruş)** geldiğini
   varsayıyor ve 100'e bölüyor. Yanlışsa her sipariş yüz kat şişer. En pahalı
   varsayım bu.
4. **Sipariş durumu kodları** — sayısal; kodda yalnızca 1–5 eşlemesi var,
   gerisi `pending`'e düşüyor.

---

## ⚠️ `local` uyarısı — önce satıcı modelini teyit et

Metot ağacındaki üç adda **`local`** geçiyor:

```
bg.local.goods.sku.list.query
bg.local.goods.stock.edit
bg.local.goods.priceorder.change.sku.price
```

Temu'nun iki farklı satıcı modeli var ve **metot kümeleri farklı olabilir**:

- **Local-to-local (yerel satıcı)** — satıcı stoğu kendi tutar, kendi gönderir.
  `bg.local.*` adlandırması buna işaret ediyor.
- **Tam yönetimli (fully managed)** — Temu envanteri ve lojistiği üstlenir;
  satıcının stok/fiyat üzerindeki kontrolü farklıdır.

**Panelde hangi modelde olunduğu teyit edilmeden bu adlar koda yazılmamalı.**
Yanlış modelin metotları ya yetki hatası verir ya da hiç var olmaz.

Teyit edilecek:

1. Hesap hangi modelde? (Partner panelinde satıcı tipi olarak görünür.)
2. Model başına metot ağacı farklı mı — `bg.local.*` dışında bir önek var mı?
3. Bir hesap iki modelde birden olabilir mi? Olabiliyorsa bu, **entegrasyon
   başına model seçimi** gerektirir; tıpkı Trendyol Global'de ülke ve eBay'de
   pazar seçimi gibi. O durumda `temu.settings.ts`'e zorunlu bir `sellerModel`
   alanı eklenir ve connector ona göre metot seçer.

---

## Gateway host'u

Hâlâ doğrulanmadı ve **koda yazılmayacak** — `apiUrl` olarak satıcıdan alınıyor.
Panelde API bilgileri sayfasında istek adresi olarak görünmeli. Bölgeye göre
değiştiği için (US / EU / global) farklı bölge = farklı entegrasyon kaydı;
rate limit kovası da host bazlı ayrılıyor.

> Not: bir aramada aday bir host doğrulanmış gibi döndü, ancak o sonuç sorguya
> konulan adayları geri okuyordu. Kanıt sayılmadı ve koda girmedi.

---

## Doğrulama sırası (öneri)

Gerçek kimlik bilgileri geldiğinde:

1. **Önce imza.** Tek bir çağrı yapıp `success` dönüp dönmediğine bak. İmza
   hatası toptan kimlik doğrulama hatası olarak döner, yani başka hiçbir şey
   test edilemez. `TemuSignature.ts` doğrulanacak ilk şey.
2. Gateway host'u ve `bg.order.list.v2.get` ile bir sipariş çek.
3. Tutar biriminin kuruş olduğunu **gerçek bir siparişle** doğrula.
4. Satıcı modelini teyit et, sonra `local` metotlarını sırayla dene.
