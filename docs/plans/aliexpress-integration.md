# AliExpress entegrasyonu — durum ve açık kalanlar

**Durum:** connector yazıldı, sağlayıcı registry'ye KAYDEDİLMEDİ.
Katalog kartı "Çok yakında" olarak duruyor.
**Tarih:** 2026-08-12

---

## Doğrulanan

| | Değer |
|---|---|
| Gateway | `https://api-sg.aliexpress.com/sync` |
| Eski gateway | `gw.api.taobao.com/router/rest` — **host, sürümü ayırt etmenin yolu** |
| İstek | POST |
| Sistem parametreleri | `app_key`, `method`, `timestamp`, `v` (2.0), `sign_method`, `format`, `session`, `sign` |
| Access token | `session` parametresi olarak gönderiliyor |
| İmza girdisi | Parametreler **ASCII sırasına** göre sıralanır, `key`+`value` biçiminde birleştirilir |
| Digest | Hex, **büyük harf** |
| Metot adlandırma | RPC tarzı; `aliexpress.solution.order.info.get` doğrulandı |

API erişimi başvuru/onay gerektiriyor.

---

## ⚠️ Doğrulanamayan 1: imzada secret'ın yeri

İki şema var ve kaynaklar bu gateway için **çelişiyor**:

- **A (hmac):** `HMAC_SHA256(secret, concat)`
- **B (wrapped):** `SHA256(secret + concat + secret)`

**İkisi de yazıldı ve test edildi** (`AliExpressSignature.ts`). Tahmin edip tek
birini yazmak yerine, hangisinin geçerli olduğu öğrenilince `ACTIVE_VARIANT`
sabitini değiştirmek yeterli — etrafındaki sıralama ve kodlama zaten doğru.

Şu an `ACTIVE_VARIANT = 'hmac'`. Bu bir **seçim**, doğrulanmış bir olgu değil.

> Neden bu kadar önemli: imza yanlışsa her çağrı toptan kimlik doğrulama
> hatası verir ve hata mesajı hangi parçanın yanlış olduğunu söylemez.

Ayrıca doğrulanmadı: **api yolunun imzaya dahil edilip edilmediği.** Bazı
Alibaba gateway'lerinde imzalanan dizgenin başına yol ekleniyor.

## ⚠️ Doğrulanamayan 2: sipariş LİSTESİ metodu yok

Doğrulanan tek sipariş metodu `aliexpress.solution.order.info.get` — bu **tek bir
siparişin detayını** getiriyor, listeleme yapmıyor.

Keşfedemediği bir siparişin detayını çekebilen bir connector senkronizasyon
değildir. Bu yüzden `getOrders` tahmin etmek yerine **reddediyor**.

Aynı şekilde bilinmiyor: ürün listeleme, stok güncelleme, kategori metotları.
Hepsi `METHODS` içinde `null`; çağrılırsa doldurulacak sabitin adını söyleyen
hata veriyor.

## ⚠️ Doğrulanamayan 3: timestamp biçimi

Kod epoch **milisaniye** gönderiyor. Eski TOP gateway'i `yyyy-MM-dd HH:mm:ss`
biçimini kullanıyordu; yeni gateway'in hangisini istediği teyit edilmedi.
Yanlışsa imza doğrulaması da başarısız olur — yani 1. maddeyle birlikte
değerlendirilmeli.

---

## Panelde alınacaklar

1. **İmza örneği.** Resmi SDK veya doküman bir örnek istek+imza veriyorsa,
   iki varyantı da hesaplayıp hangisinin tuttuğuna bakmak birkaç dakika sürer.
   `AliExpressSignature.spec.ts` her iki varyantı da hesaplıyor.
2. **Sipariş listeleme metodunun adı** ve sayfalama parametreleri.
3. Ürün listeleme, stok güncelleme, kategori metotları.
4. Timestamp biçimi.
5. OAuth token uç noktası (access token'ın nasıl yenilendiği) — şu an token
   elle yapıştırılıyor.

## Doğrulama sırası (öneri)

1. **Önce imza.** `testConnection` bilerek doğrulanan tek metodu (sipariş
   detayı) parametresiz çağırıyor: amaç ağ geçidinin imzayı kabul edip
   etmediğini görmek. Parametre eksikliği şikâyeti gelirse **imza doğrudur** —
   `sign check failed` gelirse `ACTIVE_VARIANT`'ı diğerine çevirip tekrar
   deneyin. Bir test bu hatanın mesajda aynen göründüğünü pinliyor.
2. İmza tuttuktan sonra metot adlarını sırayla doldurun.

## Açmak için

`METHODS` doldurulur, `ACTIVE_VARIANT` teyit edilir, sonra
`manifest.registry.ts` içindeki `OVERRIDES` dizisine `aliexpressOverride`
eklenir — tek satır. Çeviriler hazır ve kaydedilmemiş-manifest testi onları
koruyor.
