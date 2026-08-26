# Açık Mimari Kararlar

> Siparişler ve Ürünler alt menüsü çalışması sırasında ortaya çıkan, **kod yazarak değil karar
> vererek** kapanacak üç konu. Üçü de aynı soruyu soruyor: *bu alandaki kanonik varlık nedir?*
>
> Her madde: ne bulundu (kanıtla), neden şimdi karar gerekiyor, seçenekler, ve karar verilene kadar
> ne bekliyor. Karar verildiğinde ilgili maddeyi "Karar" satırıyla güncelleyin, silmeyin.

Son güncelleme: 2026-08-26 · Durum: **üçü de açık**

---

## 1. Stok için tek doğru kaynak

**Durum:** Açık · **Sahip:** db-prisma · **Etki:** Yüksek

### Bulgu

`packages/backend/prisma/schema.prisma` içinde birbirinden bağımsız **üç** stok kaynağı var ve
farklı eksenlerde tutuluyorlar:

| Kaynak | Eksen | Not |
|---|---|---|
| `Inventory` | **Mağaza** — `@@unique([storeId, productId])` | `warehouseId` alanı **yok**. Canlı sayılar burada (`availableQty`, `reservedQty`, `defectiveQty`, `reorderLevel`). |
| `StockMovement` | **Depo + lokasyon** — `warehouseId`, `locationId` | Hareket defteri (`previousQty`, `newQty`, `difference`). Canlı depo kırılımı ancak buradan türetilir. |
| `InventorySnapshot` | **Depo** — `@@unique([agencyId, date, productId, warehouseId])` | `date` alanı `@db.Date` → **günlük** snapshot. Canlı değil, bir önceki günü verir. |
| `Product.stockQuantity` | **Ürün** | Denormalize toplam. Kim yazıyor, ne zaman güncelleniyor — netleştirilmedi. |

`StockReservation` de depo ekseninde (`warehouseId`), yani rezervasyon depo bazlı ama `Inventory`
üzerindeki `reservedQty` mağaza bazlı. Bu ikisi arasında tanımlı bir senkron yok.

Yani: WMS'in tamamı (Warehouse → Zone → Location) depo ekseninde kurulmuşken **canlı envanterin depo
kırılımı yok**.

### Neden şimdi

`/products/stock` sayfasındaki "Depo Dağılımı" kolonu ve depo filtresi bu yüzden kaldırıldı — veri
onları dürüst şekilde besleyemiyor. Sayfanın backend'i yazılmadan önce hangi kaynağın doğru
sayıldığına karar verilmeli; yoksa dört farklı yerden dört farklı stok okuyan bir ekran çıkar.

### Seçenekler

1. **`Inventory`'yi depo eksenine taşı** — `warehouseId` ekle, unique'i
   `[storeId, warehouseId, productId]` yap. Migration + mevcut satırların varsayılan depoya
   dağıtımı gerekir. WMS'le hizalanır, en temizi, en pahalısı.
2. **`Inventory` mağaza ekseninde kalsın, depo kırılımı türetilsin** — `(productId, warehouseId)`
   başına en son `StockMovement.newQty`. Migration yok, ama her okuma bir pencere sorgusu; ölçek
   büyüdükçe pahalı. Materialized view / periyodik toplama gerekebilir.
3. **`InventorySnapshot`'ı canlıya çevir** — `date` alanını kaldırıp upsert'le güncel tut, snapshot
   sorumluluğunu ayrı bir tabloya ver. Orta maliyet, ama iki tabloyu tutarlı tutma yükü doğar.

Hangisi seçilirse seçilsin ayrıca karara bağlanmalı: **`Product.stockQuantity` kalacak mı?** Kalacaksa
kim yazar, ne zaman; kalmayacaksa okuyan yerler bulunup temizlenmeli.

### Karar verilene kadar bekleyenler

- `/products/stock` için depo bazlı backend ucu
- `/products/stock`'ta "Depo Dağılımı" kolonu ve depo filtresi — **kaldırıldı** (2026-08-26).
  Boş bırakılmadı, silindi: her satırda tire gösteren bir "Depo Dağılımı" başlığı, kırılımın
  var olduğunu ve yalnızca bugün eksik olduğunu iddia eder. Geri getirme adımları
  `useProductStock.ts` tepesindeki `TODO(backend)` notunda.
- `useProductStock.ts` içindeki `TODO(backend)` notu

---

## 2. Alıcı kimliği — "aynı kişi" ne demek

**Durum:** Açık · **Sahip:** backend-dev + ürün · **Etki:** Orta

### Bulgu

`orders/buyers.ts` içindeki `buyerKey` e-postayı tercih ediyor, yoksa telefona düşüyor. Sonuç:
aynı insan bir siparişinde e-posta bırakmış, diğerinde bırakmamışsa **iki ayrı alıcı** olarak
görünür (`email:...` ve `phone:...` ayrı anahtarlar).

Bunun yan ürünü olarak `groupBuyers` içindeki `existing.email = existing.email || ...` satırı **ölü
kod**: telefonla anahtarlanmış bir grubun hiçbir üyesinde e-posta olamaz (olsaydı e-postayla
anahtarlanırdı), e-postayla anahtarlanmışta ise zaten doludur. Yalnız `phone` doldurulabiliyor.
→ *Bu satır silinebilir, davranış değişmez.*

Ayrıca bu davranışı doğruladığını sanan bir test vardı; yalnızca bozuk bir sıralayıcı sayesinde
yeşildi. Test gerçek davranışa çevrildi ve birleşmediğini belgeleyen ikinci bir test eklendi.

### Neden şimdi

`/orders/customers` sayfasının **tüm anlamı** alıcı başına toplama: "Sipariş Sayısı" ve "Toplam
Harcama". Bölünmüş kayıtlarda bu iki kolon yanlış sayı gösterir.

### Seçenekler

1. **Olduğu gibi bırak, sayfanın iddiasını düşür** *(şu an önerilen)* — anahtarlama kuralına
   dokunma; kolonların *kişi başına* değil *iletişim bilgisi başına* olduğunu etiketle ya da
   tablonun altına not düş. Yanlış birleşme riski sıfır, sayı doğru ama kapsamı dar.
2. **Telefonla ikinci geçiş birleştirme** — önce e-postayla grupla, sonra telefonu eşleşen
   telefon-only grupları e-posta grubuna kat. Daha doğru toplamlar; **ama yanlış birleşme riski
   getirir**: pazaryerleri hem e-postayı hem telefonu sipariş başına maskeliyor, proxy numaralar
   geri dönüşüme giriyor, aynı hanede telefon paylaşılıyor. İki farklı insanın geçmişi ve iletişim
   bilgisi tek satırda birleşirse bu, bölünmüş kayıttan daha ağır bir hata.
3. **Gerçek müşteri varlığı** — `Order.customerId` alanı zaten şemada var ama kullanılmıyor
   görünüyor. Kanonik bir müşteri kaydı açılır, siparişler ona bağlanır, kimlik çözümlemesi tek
   yerde yapılır. En doğrusu, açık ara en büyüğü.

> Not: `Order` modelinde `customerId String?` mevcut. Seçenek 3'e girmeden önce bu alanın bugün
> kim tarafından, hangi entegrasyonlarda doldurulduğu tespit edilmeli.

### Karar verilene kadar bekleyenler

- `/orders/customers` toplama kolonlarının etiketi
- ~~`groupBuyers` içindeki ölü satırın temizliği~~ — **yapıldı** (2026-08-26). `existing.email`
  satırı silindi; üç anahtar biçiminde de ölüydü, davranış değişmedi (`buyers.test.ts` 15/15).
  `existing.phone` satırı **duruyor**: e-postayla anahtarlanmış bir grupta telefon gerçekten
  sonradan dolabiliyor, o yol canlı.

---

## 3. PII görünürlüğü — iki uç, zıt politika

**Durum:** Açık · **Sahip:** güvenlik + ürün · **Etki:** Orta

### Bulgu

Aynı veriye iki uç zıt davranıyor:

- `/orders/customers` → `/api/orders`'ı çekip **her alıcının e-posta ve telefonunu**
  `orders.read` iznine sahip herkese toplu listeliyor.
- `shipment.service.ts:226-238` → gönderi projeksiyonundan alıcı adresi ve telefonu **bilinçli
  olarak çıkarılmış**, hem liste hem detay için. Gerekçe yorumda yazılı: teslimat adresine ihtiyacı
  olan operatör onu siparişten, o alandaki iznin arkasından okur.

Yeni bir sızıntı değil — veri zaten `/api/orders`'tan geliyor. Sorun **tutarsızlık**: bir sonraki
geliştirici hangisinin kural olduğunu bilemez.

### Seçenekler

1. **Listede maskele, tam değeri detayda göster** *(şu an önerilen)* — `shipment.service.ts`'in
   mantığıyla hizalanır, yeni izin tanımı gerektirmez, en hızlı kapanan seçenek.
2. **Ayrı izne bağla** (`orders.pii.read`) — uzun vadede en doğrusu, ama yeni izin tanımı, RBAC
   matrisi güncellemesi ve mevcut rollere göç demek. Madde 1'deki şema kararıyla aynı turda ele
   alınabilir.
3. **Bilinçli olarak açık bırak** ve `shipment.service.ts`'teki yorumu bu istisnayı anacak şekilde
   güncelle. *Önerilmiyor:* zıt politikayı yorumla meşrulaştırmak, kuralın hangisi olduğunu hâlâ
   söylemez.

### Karar verilene kadar bekleyenler

- `/orders/customers` liste kolonlarının son hali

---

## Ek — doğrulanmamış iddialar

Karara girmeden önce canlı doğrulanması gereken, bu çalışmada **iddiasız bırakılmış** noktalar:

- `Inventory.updatedAt`'in boş `update: {}` içeren `upsert`'te de yazılıp yazılmadığı
  (`inventory.service.ts:16-23`, `ensureInventoriesExist`). DB gerektirir. Sonuçtan bağımsız olarak
  `updatedAt` stok hareketini değil herhangi bir alan değişikliğini izliyor — kolon bu yüzden
  `Güncellenme` olarak yeniden adlandırıldı (**yapıldı** 2026-08-26: `columns.lastMovement` →
  `columns.updatedAt`, 15 dil dosyasında; alan adı `StockRow.lastMovementAt` → `updatedAt`).
- `Order.customerId`'nin bugün hangi akışlarda doldurulduğu (Madde 2, seçenek 3'ün önkoşulu).