# Temu entegrasyonu — açık kalan bilgiler

**Durum:** connector gerçek çağrı yapıyor; sağlayıcı registry'ye **KAYDEDİLDİ**
(2026-08-14). Katalog kartı **Beta** rozetiyle bağlanabilir durumda.
**Son güncelleme:** 2026-08-14

---

## 2026-08-14'te ne değişti

`temuOverride` `manifest.registry.ts` içindeki `OVERRIDES`'a eklendi. Kayıt,
Kademe 2 kapandığı için değil, **kapanabilmesi için** açıldı: kart devre dışıyken
kimlik bilgisi girilecek yer yoktu, dolayısıyla kaydı haklı çıkaracak canlı çağrı
hiç yapılamıyordu. Kapı, kendisini açacak tek şeyi engelliyordu.

Yanında gidenler:
- `capabilities` `[]` → `['orders.read', 'products.read', 'categories.read']`.
  Bunlar connector'ın gerçekten istek attığı üç işlem. `stock.push`,
  `attributes.read` ve `price.push` **bilerek yok** — karşılıkları reddediyor.
- Katalog kartı `coming_soon` → `beta`, rozetler `Siparişler / Ürünler /
  Kategoriler`. **Stok rozeti yok.**
- Testler: `manifest.i18n.spec.ts` ve `MarketplaceConnectorFactory.spec.ts`
  içindeki "kayıtlı değil" pinleri Temu'dan alındı; ikisi de artık Temu'yu
  kayıtlı sağlayıcı döngüsünden geçiriyor (daha güçlü kontrol).
  `AddIntegrationModal.test.tsx`'e Temu'nun beta kaldığını ve stok vaat
  etmediğini pinleyen ayrı bir blok eklendi.

**Aşağıdaki Kademe 2 listesi hâlâ tamamen açık.** Kayıt onu kapatmadı.

---

## 2026-08-13'te ne değişti

Metot adları `null` iken dolduruldu ve connector artık gerçekten istek yapıyor.
Gerekçe: adların reddedilme sebebi ortadan kalktı.

Önceki ölçüt şuydu — *"adlar doküman sayfa **başlıklarından** geldi,
parametreleri ve yanıtları hiç görülmedi."* Bu doğruydu. Şimdi elimizde protokolü
uygulayan **iki bağımsız gayrı-resmî SDK** var (biri Python, biri TypeScript);
ikisi birbiriyle ve bizim mevcut taşıma katmanımızla uyuşuyor, ve her metodun
**tam istek parametre listesini** içeriyor.

Kanıt hâlâ resmî ISV dokümanı değil ve **canlı çağrı hiç yapılmadı.** Aşağıdaki
kademe ayrımı bu yüzden var; koddaki yorumlar da aynı ayrımı kullanıyor.

---

## Kanıt kademeleri

### Kademe 1 — iki bağımsız uygulama tarafından teyitli

| Ne | Değer |
|---|---|
| İmza | `MD5(app_secret + sıralı k1v1k2v2… + app_secret)`, hex, **büyük harf** |
| Zarf | `type`, `app_key`, `access_token`, `timestamp` (saniye), `data_type: 'JSON'`, `sign` |
| İstek yolu | `/openapi/router` — host bölgeye göre değişir, yol değişmez |
| ABD gateway | `https://openapi-b-us.temu.com` (yalnızca ABD teyitli) |
| Siparişler | `bg.order.list.v2.get` — `page_number`, `page_size`, `parent_order_status`, `create_after`, `create_before`, `parent_order_sn_list`, `region_id`, `sortby`… |
| Ürünler | `bg.local.goods.sku.list.query` — `page_no`, `page_size`, `sku_search_type`, `search_text`, `sku_id_list`, `cat_id_list`… |
| Stok | `bg.local.goods.stock.edit` — `goods_id` (zorunlu), `sku_stock_change_list` (fark), `sku_stock_target_list` (mutlak), `request_unique_key` |
| Kategoriler | `bg.local.goods.cats.get` — `parent_cat_id` (0 = kök), `language` |

> **Sayfalama tuzağı:** siparişler `page_number`, ürünler `page_no` kullanıyor.
> Aynı sanıp tek alan kullanmak, her seferinde 1. sayfayı döndürür ve
> senkronizasyon **çalışıyormuş gibi görünür.** Kodda iki ayrı sabit ve bunu
> pinleyen bir test var.

### Kademe 2 — HÂLÂ DOĞRULANMADI

Hiç canlı çağrı yapılmadı. Bunlar ancak gerçek kimlik bilgisiyle kapanır:

1. **Yanıt gövdelerinin alan adları.** `TemuTypes.ts` içindeki her alan
   çıkarımdır. Sayfanın hangi anahtarda geldiği de dahil.
2. **Tutar birimi.** Kod kuruş (minor unit) varsayıp 100'e bölüyor. Yanlışsa her
   sipariş yüz kat şişer. Buradaki en pahalı varsayım hâlâ bu.
3. **Sipariş durum kodları.** Yalnızca 1–5 eşlenmiş, gerisi `pending`.
4. **Satıcı modeli.** Aşağıdaki uyarıya bakın.
5. **ABD dışı gateway host'ları.**
6. **`page_size` üst sınırı.** Kod 50 kullanıyor, ölçülmedi.

**Yanıt şekli yanlışsa ne olur:** liste okuyucu boş dizi döndürmez, **hata
fırlatır** ve gelen anahtar adlarını mesaja yazar. Sessizce "hiç sipariş yok"
demek haftalarca fark edilmeyebilir; gürültülü hata edilemez.

---

## ⚠️ `local` uyarısı — hâlâ geçerli

Dört metottan üçü `bg.local.*` öneki taşıyor; bu Temu'nun **yerel satıcı**
(local-to-local: stoğu satıcı tutar, satıcı gönderir) modeline ait.

**Tam yönetimli (fully managed)** bir hesapta bu metotlar ya yetki hatası verir
ya hiç yoktur. Böyle bir hata bu dosyadaki bir bug değildir — önce hesabın
modelini panelden teyit edin.

Hesap iki modelde birden olabiliyorsa entegrasyon başına model seçimi gerekir
(Trendyol Global'de ülke, eBay'de pazar seçimi gibi): `temu.settings.ts`'e
zorunlu bir `sellerModel` alanı eklenir, connector metot kümesini ona göre seçer.

---

## Stok neden hâlâ gönderilmiyor

`updateStock` bilerek başarısız sonuç döndürüyor — ve bu **eksik metot adı
değil.** `bg.local.goods.stock.edit` ve üst düzey parametreleri teyitli. Eksik
olan iki şey:

1. `sku_stock_change_list` / `sku_stock_target_list` **öğelerinin alan adları**
   (sku kimliği ve miktar alanı).
2. **SKU → `goods_id` eşlemesi.** Temu stoğu goods bazında tutuyor, satıcının SKU
   koduyla değil. Çözüm `METHODS.products` üzerinden bir arama gerektiriyor, o da
   Kademe 2'deki yanıt şekline bağlı.

Tahminle göndermenin bedeli asimetrik: Temu'nun bizim niyet ettiğimiz gibi
ayrıştıramadığı bir liste **tüm katalogun stoğunu sıfıra çekebilir.** Fazla satış
telafi edilebilir, her listede stok tükenmesi edilemez. O yüzden bu ikisi gerçek
bir payload'dan teyit edilmeden gönderim açılmayacak.

---

## Kategori özellikleri

`getCategoryAttributes` reddediyor. Aday: `bg.local.goods.property.get` — aynı
metot ağacında duruyor ama parametreleri tespit edilemedi. `METHODS` içindeki
diğer adlardan **daha zayıf bir ölçütle** yazılmaması için dışarıda bırakıldı.

---

## Kart neden artık "Beta"

Kayıt açıldı (yukarı bakın), dolayısıyla kart bağlanabilir. **Beta** rozeti
duruyor çünkü Kademe 2'nin tek maddesi bile kapanmadı.

Bunun kabul edilen riski şu: bir satıcı Temu'yu bağlayabilir ve ilk senkron
başarısız olabilir. Bu, yanlış veri almaktan daha ucuz kabul edildi — connector
tanımadığı yanıt şeklinde **boş liste değil hata** döndürüyor, yani başarısızlık
görünür oluyor. Alternatif (kartı kapalı tutmak) ise doğrulamayı süresiz olarak
imkânsız kılıyordu.

---

## Doğrulama sırası (gerçek kimlik bilgileri geldiğinde)

1. **Önce imza.** `testConnection` artık en ucuz gerçek çağrıyı yapıyor
   (`bg.order.list.v2.get`, `page_size: 1`). İmza hatası toptan kimlik doğrulama
   hatası olarak döner; başka hiçbir şey test edilemez.
2. **Yanıt gövdesini kaydet.** Liste hangi anahtarda geliyor? `TemuTypes.ts`'i ona
   göre düzelt. Şekil tanınmazsa kod zaten gelen anahtarları hataya yazıyor.
3. **Tutar birimini gerçek bir siparişle doğrula.** Kuruş mu, değil mi.
4. **Durum kodlarını** gerçek siparişlerden çıkar, `TemuMapper.toStatus`'u tamamla.
5. **Satıcı modelini teyit et**, sonra `bg.local.*` metotlarını sırayla dene.
6. **Stok için** yukarıdaki iki eksiği bir payload'dan al, `updateStock`'u aç.

---

## Kodun bugünkü hâli

| Parça | Durum |
|---|---|
| İmza algoritması | Yazıldı; imzalanan küme = gönderilen küme değişmezi testle pinli |
| POST zarfı | Yazıldı, Kademe 1 |
| Gateway yolu | Host satıcıdan; yol yoksa `/openapi/router` ekleniyor |
| İş hatası çözümleme (`success:false`) | Yazıldı |
| Siparişler / Ürünler / Kategoriler | **Gerçek çağrı yapıyor**, sayfalama dahil |
| Stok | Bilerek reddediyor (yukarıya bakın) |
| Kategori özellikleri | Bilerek reddediyor |
| Manifest | `temu.settings.ts` yazıldı ve `OVERRIDES`'a **eklendi** (2026-08-14) |
| Testler | 54 (connector 30, imza 16, mapper 20 civarı) |
