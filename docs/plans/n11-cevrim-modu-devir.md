# n11 Çevrim Modu — Devir Notu

**Tarih:** 2026-08-17
**Dal:** `wip/n11-cevrim-modu` (`3f97a15` üzerinden)
**Commit'ler:** `4d4d1d7` (checkpoint, yabancı iş) → `84eb50e` (n11 çevrim modu)
**Durum:** n11 dokümanı 2026-08-17'de geldi; sipariş, ürün ve stok uçları bağlandı.
Testler yeşil, **hiçbir uç canlı satıcı hesabında koşulmadı** — `defaultMode` hâlâ
`simulation`. Push edilmedi. Bekleyen tek blokaj: `salePrice` KDV dahil mi (bkz. 5.1).

---

## 1. Ne yapıldı

### 1.1 Bulgu: n11'in beş uç noktasından beşi yanlıştı

2026-08-17 canlı sondası (dummy `appKey`/`appSecret`, satıcı hesabı olmadan):

| Connector'daki yol | Gerçek yanıt |
|---|---|
| `/ms/product-query/products` (testConnection + getProducts) | `404 NotFoundException: No handler found for GET /product-query/products` |
| `/ms/order/list` | `503` OpenShift "Application is not available" — route yok |
| `/ms/product/stock-update` | `503` — route yok |
| `/ms/category` | `503` — route yok |
| `/ms/category/{id}/attributes` | `503` — route yok |

`testConnection` ilk satırı kullandığı için **geçerli anahtarla bile hep başarısızdı**.

Doğru olan tek şey auth: `appKey`/`appSecret` header çifti. Dummy değerle
`SellerApiUserUnauthorizedException`, header'sız istekte servis
`Required request header 'appkey' ... is not present` diyor.

**Yol oracle'ı** (sonraki kişi için): `403 "Authentication parameters missing"` =
gateway'de kayıtlı gerçek prefix · `503` HTML = route yok · JSON `404`/`500` =
servise ulaştı ama handler yok.

### 1.2 HttpClient retry sınıflandırması

`core/MarketplaceHttpClient.ts` yeniden yazıldı. Blanket "status yok → retry"
kuralı kalktı; yerine `classifyTransportFailure()` geldi:
`http | protocol | tls | dns | url | reset | timeout | unknown`.
undici gerçek nedeni `error.cause` içinde sakladığı için hem `cause.code` hem
`cause.message` okunuyor. **Tanınmayan hata fatal sayılır.**

| Sınıf | Karar |
|---|---|
| `protocol` (HPE_*, "does not match the HTTP/1.1 protocol"), `tls`, `dns`, `url`, `unknown` | asla retry |
| `reset` (ECONNRESET, EPIPE, ETIMEDOUT, socket hang up) | 1 retry, **yalnız GET/HEAD** |
| `timeout` | 1 retry, **yalnız GET** |
| `http` | 429 + gerçek 5xx retry; 4xx asla |
| POST/PUT/PATCH | `idempotencyKey` yoksa **hiçbir sınıfta** retry yok |

- Süre bütçesi: `budgetMs` varsayılan **8000**, backoff dahil tüm çağrıyı kapsar.
  Deneme başına timeout **5000** (8 sn bütçeye iki denemenin sığması için).
  Her deneme `min(timeout, kalan bütçe)` ile başlar.
- Env: `MARKETPLACE_HTTP_TIMEOUT_MS`, `MARKETPLACE_HTTP_BUDGET_MS`, `MARKETPLACE_HTTP_RETRIES`.
- 200 + JSON olmayan gövde artık ham `SyntaxError` değil; `upstreamStatus: 200`
  + gövdenin ilk 200 karakteriyle `MarketplaceHttpError`. Tam gövde `upstreamBody`'de
  kalır, böylece `describeUpstreamBody`'nin "HTML sayfası döndü" tespiti çalışır.
- Mesaj şablonu `METHOD host/path → status|neden`. Query string **kasten** dışarıda
  (`?appKey=...` loglara sızmasın; testi var).

> ⚠️ Bu değişiklik **19 connector'ı birden** etkiler. Ağ hatası/timeout artık
> sınıfına göre retry ediliyor, körlemesine değil. Politikanın her satırının
> kendi testi var (`MarketplaceHttpClient.spec.ts`, 25 test).

### 1.3 n11 çevrim modu (`auto | live | simulation`)

Bağlayıcı artık kendini "doğrulanmamış" ilan edebiliyor.

**Mod önceliği:** entegrasyon ayarı `general.mode` → `MARKETPLACE_MODE` ortam
değişkeni → bağlayıcının `defaultMode`'u.
Base sınıf varsayılanı **`live`**; n11 **`simulation`**.

Manifest alanı `general.mode` üç seçenekli ve varsayılanı `auto`. Somut bir
varsayılan (`live`/`simulation`) **kasten yok**: `resolveForRuntime` manifest
default'larını okuma anında merge ettiği için, somut bir default env değişkenini
sonsuza dek erişilemez kılardı.

| Mod | Davranış |
|---|---|
| `simulation` | Hiçbir dış istek yok. Örnek veri üretilir, worker bunları **veritabanına yazmaz**. |
| `live` | Gerçek uçlara gider. Doküman öncesi bu satır "yalnızca iki kategori ucu çalışır, gerisi açık hata döner" diyordu; doküman geldikten sonra sipariş, ürün ve stok da bağlandı. Sessizce örnek veriye düşme hiçbir durumda yok. |

Her yanıt, DTO ve log `mode` + `modeSource` (`setting`/`env`/`default`) taşır.
Örnek sipariş numaraları **içsel olarak** `SIM-` ile başlar — ayara bağlı değil,
`orders.numberPrefix` silinse bile sahte kayıt kendini belli eder.

Frontend: kartta amber "Simülasyon" rozeti, sihirbazda uyarı şeridi, senkron
özetinde *"sıfır sipariş/ürün sonucu arıza değil, bu modun beklenen çıktısıdır"*.

**Ölçüm (gerçek `api.n11.com`, dummy kimlik):**

```
bozuk HTTP yanıtı   951 ms, tek deneme      (önce ~10 sn + "fetch failed")
live testConnection 822 ms, 403 + gateway'in kendi mesajı
live getOrders        1 ms, reddetti, sıfır HTTP çağrısı
simülasyon            0 ms, sıfır HTTP çağrısı
```

### 1.4 `SettingsField.deprecated` bayrağı

Bağlayıcının okumadığı üç alan (`n11.shipmentTemplate` — ki `required: true` idi
ve sihirbazı bloke ediyordu —, `n11.preparingDay`, `n11.catalogMatch`)
**silinmedi**, `deprecated: true` ile işaretlendi ve `required` kaldırıldı.

**Neden silinmedi:** ayar katmanı bilinmeyen anahtarı buduyor.
`settings.validator.ts:21` `unknownKeys` → **422**;
`settings.validator.ts:36-50` `pruneInvisible` + `integration-settings.service.ts:270`
→ saklı değer **sonraki her kayıtta sessizce silinir**.
`visibleWhen: false` ve `requiresCapability` ile gizlemek de aynı budamayı
tetikliyor (üçü de alanı `collectFields`'tan düşürür).

`deprecated` bunu çözer: backend anahtarı bilmeye devam eder, frontend render
etmez. Bütün alanları `deprecated` olan bölüm de render edilmez.

### 1.5 `plannedCapabilities`

Implement edilmemiş yetenekler işaretlendi ama `capabilities`'ten **çıkarılmadı**.
Doküman geldikten sonra `stock.push` bu listeden çıktı (artık implement);
kalanlar `orders.updateStatus`, `products.push`, `price.push`, `returns.read`.

**Neden çıkarılmadı:** base tab'ler `requiresCapability` ile kapılı —
`orders.read`→orders (`base.settings.ts:151`), `products.push`→catalog (`:312`),
`stock.push`→stock (`:434`), `price.push`→pricing (`:575`),
`returns.read`→returns (`:850`). Yeteneği çıkarmak tab'i siler, tab silinince
1.4'teki budama devreye girer ve içindeki saklı değerler yok olur — worker'ın
**her sağlayıcı için** okuduğu `stock.bufferQuantity` / `stock.maxCap` dahil.

Bu yüzden `plannedCapabilities`, `capabilities`'in **yerine değil üstüne** bir
işarettir. UI onu okuyup ilgili tab'i salt-okunur render eder + "henüz
desteklenmiyor, kayıtlı değerleriniz korunur" şeridi gösterir.

### 1.6 Simülasyon izolasyonu — seçenek (A)

**Worker simülasyon modunda sipariş/ürün tablolarına hiç satır yazmaz.**

Değerlendirilen alternatif (B): kalıcı `isSimulated` bayrağı + tüm liste
sorgularında varsayılan filtre. Reddedildi: şema değişikliği gerektiriyor ve
güvenliği "filtreyi unutmama"ya bağlıyor — unutulan tek sorgu sahte veriyi
gerçek gösterir. (A)'da unutmayla sızma imkânı yok.

Kaybedilen "ne yazılacaktı" görünürlüğünü `advanced.dryRun` log çıktısı zaten
veriyor. Loglar `[simulation:<kaynak>]` etiketli ve üretilen kayıt sayısını
belirtiyor ("2 örnek sipariş üretildi, veritabanına yazılmadı").

Kilit: `integration-sync.simulation.spec.ts` (9 test).

---

## 2. Commit'ler ve neden ikiye bölündü

Çalışma başladığında ağaçta **23 dosya commit edilmemiş** haldeydi ve bunlar
başka bir ajanın devam eden dört işiydi (Trendyol, Hepsiburada, Temu, eMAG).
n11 işi bunların **üzerine** oturdu: `N11Connector` `prefixOrderNumber` /
`mapOrderStatus`'ü, spec'i `describeUpstreamBody`'yi, worker `updateStock`'un
üçüncü `identifiers` parametresini kullanıyor — hiçbiri `3f97a15`'te yok.
Ayrıca `manifest.registry.ts` o sırada untracked olan `emag.settings.ts`'i
import ediyordu.

Yani "sadece n11 dosyaları" diye derlenen bir commit çıkarmak mümkün değildi.
Çözüm: önce yabancı işi olduğu gibi checkpoint'le, sonra n11'i üstüne bindir.

### `4d4d1d7` — checkpoint (28 dosya, +3119/−128)

**İçeriği bu işi yapan ajan/geliştirici yazmadı; Claude tarafından yazılmadı.**
Mekanik checkpoint, tek satırı değiştirilmedi, `Co-Authored-By` trailer'ı
bilinçli olarak yok.

- **Trendyol:** `TrendyolBaseConnector.ts`, `TrendyolConnector.ts` + spec;
  `MarketplaceConnector.ts`'te `mapOrderStatus` + `prefixOrderNumber` +
  `describeUpstreamBody` + `updateStock` `identifiers`;
  `integration.service.ts` adres alanı çözümü;
  `integration-sync.worker.ts` barcode çözümü + `storeId`/`clientId` bağımsız
  tenant çözümü
- **Hepsiburada:** `HepsiburadaConnector/Mapper/Types` + spec, `hepsiburada.settings.ts`
- **Temu:** `temu.settings.ts`, `docs/plans/temu-integration.md`,
  `AddIntegrationModal.{tsx,test.tsx}` (kart beta + planlanan pazaryeri listesi)
- **eMAG:** `marketplaces/emag/` (Connector/Mapper/Types + spec'ler),
  `emag.settings.ts`, `base.settings.ts`'e RON/BGN/HUF/PLN + Europe/*
- **Ortak:** `MarketplaceConnectorFactory.ts` + spec, `manifest.registry.ts`
  (temu + emag kaydı), `integration.controller.ts`,
  `prisma/schema.prisma` (`Order.orderNumber` store bazlı unique)

### `84eb50e` — n11 çevrim modu (23 dosya, +1787/−238)

Yukarıdaki 1.2–1.6'nın tamamı, testleriyle birlikte.

### Bölme nasıl doğrulandı

`git add -p` bu ortamda interaktif olduğu için çalışmıyor; filtrelenmiş patch
(`git apply --cached`) ve kendi düzenlemelerimi tam metniyle geri alma yöntemi
kullanıldı. `git add .` / `-A` hiç kullanılmadı. İki yönlü kontrol:

```
benim işaretlerim A'da:   connectionMode 0  isSimulation 0  modeStamp 0
                          notImplemented 0  plannedCapabilities 0
yabancı yardımcılar A'da: mapOrderStatus 2  prefixOrderNumber 2
                          describeUpstreamBody 2  emagOverride 3
B'nin diff'inde yabancı:  describeUpstreamBody 0  emagOverride 0  barcode 0
```

> **Tuzak — tekrar bölünecekse okuyun.** İlk denemede A derlenmedi: diğer ajanın
> `mapOrderStatus`/`prefixOrderNumber` bloğu benim mod bloğumla **aynı diff
> hunk'ına** düşmüştü. Hunk seçimi çağıranı A'ya, çağrılanı B'ye attı → `TS2339`.
> Karışık dosyalarda hunk seçimine güvenmeyin; kendi düzenlemelerinizi tam
> metniyle geri alıp kalanı stage edin.

---

## 3. Bilinen tek kırmızı

**`manifest.i18n.spec.ts` — 210 test.** Sebebi eMAG işidir, `4d4d1d7`'de doğar,
`84eb50e` onu devralır ve sayısını değiştirmez. n11 commit'ine bulaşmadı.

`base.settings.ts`'e eklenen para birimi/saat dilimi seçeneklerinin ve eMAG
credential/ülke alanlarının `tr.json` karşılıkları yazılmamış. Base manifest'te
oldukları için **14 sağlayıcının hepsi** aynı anda düşüyor.

Eksik 20 anahtar:

```
integrations.settings.credentials.emag.username
integrations.settings.credentials.emag.usernameHelp
integrations.settings.credentials.emag.password
integrations.settings.credentials.emag.passwordHelp
integrations.settings.credentials.emag.ipWhitelist
integrations.settings.credentials.emag.ipWhitelistHelp
integrations.settings.fields.emag.country.label
integrations.settings.fields.emag.country.help
integrations.settings.options.emag.country.RO
integrations.settings.options.emag.country.BG
integrations.settings.options.emag.country.HU
integrations.settings.options.emag.country.PL
integrations.settings.options.general.currency.RON
integrations.settings.options.general.currency.BGN
integrations.settings.options.general.currency.HUF
integrations.settings.options.general.currency.PLN
integrations.settings.options.general.timezone.Europe/Bucharest
integrations.settings.options.general.timezone.Europe/Sofia
integrations.settings.options.general.timezone.Europe/Budapest
integrations.settings.options.general.timezone.Europe/Warsaw
```

Yalnızca `tr.json` yeterli: i18n spec her locale'i `tr` üzerine katmanlıyor.
(`en-US.json` kısmi bir sözlük, `integrations` bloğu yok.)

---

## 4. Kapı kuralı

Bu daldaki her değişiklik iki şartı birden sağlamalı:

1. **`manifest.i18n.spec.ts` dışındaki her suite yeşil.**
2. **Eksik anahtar listesi, yukarıdaki eMAG kümesinin alt kümesi.**
   Listede `n11` veya `general.mode` içeren tek satır bile çıkmamalı.

Ölçüm komutları:

```bash
# 1
npx jest 2>&1 | grep -E "^(FAIL|Test Suites:|Tests:)" | sort -u

# 2
npx jest src/integrations/marketplaces/settings/manifest.i18n.spec.ts 2>&1 \
  | grep -oE '"integrations\.settings\.[^"]+"' | sort -u \
  | grep -vE "emag|general\.currency\.(RON|BGN|HUF|PLN)|general\.timezone\.Europe/(Bucharest|Sofia|Budapest|Warsaw)"
# çıktı boş olmalı
```

`84eb50e` itibarıyla: backend **44/45 suite**, 697 yeşil / 210 kırmızı / 907 toplam
(üç ardışık koşuda aynı, kararsızlık yok). Frontend **6/6 suite, 64/64**.
`tsc --noEmit` üç pakette de temiz.

---

## 5. Uç durumu (doküman sonrası)

### 5.0 Kaynak dokümanın künyesi

Bu bölümdeki her uç, alan adı ve kısıt **resmî n11 satıcı dokümanından** okundu.
Üçüncü taraf kopya, blog, SDK ya da web araması kullanılmadı.

**Doküman depoya alınmadı ve alınmayacak.** n11'e ait, satıcıya özel dağıtılmış bir
belge; lisansı ve yeniden dağıtım koşulları belirsiz, depo ise yeniden dağıtım
kanalı değil. Bir kez `49ca06c` ile depoya alındı ve `b27de7c` ile geri alındı;
`.gitignore`'daki `*.docx` kuralı yanlışlıkla geri girmesini engelliyor.

| | |
|---|---|
| Başlık | n11 RestAPI Entegrasyon Servisleri |
| İndirilen dosya adı | `restapi_genel_dokumantasyon_n2Rrwg2r.docx` |
| Bize sağlandığı tarih | 2026-08-17 (kullanıcı tarafından) |
| Belge oluşturma / son değişiklik | 2024-09-12 / **2026-02-04** (docx metadata) |
| Kapsam | 42 sayfa, ~9.750 kelime, docx revizyon 131 |
| MD5 | `65ba42820327abc183597b18bdf28177` |
| Sürüm numarası | **Dokümanda yok** — sürümleme yalnızca son değişiklik tarihinden izlenebiliyor |
| n11 portalındaki konumu | **Bilinmiyor** — dosya bize doğrudan verildi, portal bağlantısı iletilmedi. Doldurulması gereken tek alan bu. |
| Doküman içi iletişim | `sellerintegration@n11.com` |

**Yerel kopya (depo dışında):**
`C:/Users/Administrator/Desktop/kroptos-vendor-docs/n11-restapi-dokumantasyon.docx`

Yeni bir sürüm gelirse: MD5'i ve son değişiklik tarihini yukarıdakiyle karşılaştır;
farklıysa aşağıdaki eşleme tablosundaki her satır yeniden doğrulanmalı.

### 5.0.1 Hangi bölüm hangi kararı besledi

| Doküman bölümü | Beslediği karar / kod |
|---|---|
| *Satıcı Ürünlerini Listeleme (GetProductQuery)* | `getProducts` -> `GET /ms/product-query`; parametre zorunluluğu yok, `page` 0-tabanlı, `size` varsayılan 20 / **maks 250**; yanıt `content[]` + `totalPages`, boş `content` = son sayfa. Alan eşlemesi: `stockCode`=SKU, `title`, `description`, `salePrice`, `quantity`, `barcode`, `imageUrls[]`, `vatRate`, `currencyType` |
| *Sipariş Listeleme (GetShipmentPackages)* | `getOrders` -> `GET /rest/delivery/v1/shipmentPackages` (**`/ms/` altında değil**); `size` maks 100; `startDate`/`endDate` **timestamp ms, GMT+3**; yanıt alanları `orderNumber`, `id` (paket), `customerfullName` (n11'in yazımı), `shippingAddress.*`, `lines[]` **düz dizi** |
| Aynı bölüm - *Dikkat Edilmesi Gerekenler* | **15 gün tavanı** (yalnız `startDate` -> +15 gün, yalnız `endDate` -> -15 gün, geniş aralık -> son 15 gün) ve **2024 Kasım öncesi veri yok** -> `MAX_BACKFILL_DAYS`, manifest'te `orders.backfillDays.max = 15` |
| Aynı bölüm - `status` parametresi | **Statü başına tek istek** -> seçilen her statü için ayrı sweep; geçerli küme `Created, Picking, Shipped, Cancelled, Delivered, UnPacked, UnSupplied` |
| Aynı bölüm - sipariş hesaplama denklemi | Satır tutarı `(price x quantity) - totalSellerDiscountPrice` -> `N11Mapper.lineTotal` ve `items[].totalPrice` |
| *Paket Bölme (SplitPackages)* + *Miktar Bazlı Paket Bölme* | **`UnPacked` yalnızca `Picking`'ten gelir** (bölünen ana paket) -> `UnPacked`=`processing`, ama varsayılan içe aktarma listesinde yok (çift sayım riski). **`UnSupplied` = iptal edilen paket** -> `cancelled`. Ayrıca paket bölünmesi -> kayıt anahtarı `orderNumber-packageId` ve `Order.marketplaceOrderNumber` kolonu |
| *Ürün Fiyat-Stok Güncelleme (UpdateProductPriceAndStock)* | `updateStock` -> `POST /ms/product/tasks/price-stock-update`; gövde `{payload:{integrator, skus:[{stockCode, quantity}]}}`; **`integrator` zorunlu**; tek istekte maks 1000 SKU; yanıt `IN_QUEUE`/`REJECT` + `taskId`. "İstekte mevcut olmayan alanlar için update yapılmaz" -> fiyat alanları kasten gönderilmiyor |
| *Task Detail Sorgulama (TaskDetails)* | `POST /ms/product/task-details/page-query`; `status` `PROCESSED`/`IN_QUEUE`/`REJECT`, SKU başına `itemCode` + `SUCCESS`/`Fail` -> tek yoklama ve `StockUpdateResult.pending` |
| *Kategori Ağacı Listeleme* / *Kategori Özellikleri Listeleme* | `getCategories`, `getCategoryAttributes` (zaten canlı doğrulanmıştı); `subCategories: null` = yaprak kategori |
| Her servisin başlığı | Auth: `appkey` + `appsecret` header'ları, "Authorization: no auth" |
| *Sipariş Listeleme* başlığı | **Rate limit 1000 istek/dakika** - dokümanda verilen tek limit; ürün/kategori için limit yok -> muhafazakâr 60/dk |

**Dokümanın cevaplamadığı ve açık kalan tek soru:** `salePrice` KDV dâhil mi hariç mi
(`vatRate` ayrı alan olarak dönüyor ama ilişki yazılmıyor). Bkz. 5.1.

| Metot | Uç | Durum |
|---|---|---|
| `getCategories` | `GET /cdn/categories` | bağlı, parametresiz, tüm ağaç tek istekte |
| `getCategoryAttributes` | `GET /cdn/category/{id}/attribute` | bağlı |
| `getProducts` | `GET /ms/product-query` | bağlı; page 0-tabanlı, size maks **250** |
| `getOrders` | `GET /rest/delivery/v1/shipmentPackages` | bağlı; size maks **100**, statü başına ayrı istek |
| `updateStock` | `POST /ms/product/tasks/price-stock-update` + `POST /ms/product/task-details/page-query` | bağlı, **asenkron** (aşağıya bak) |
| `orders.updateStatus` | `PUT /rest/order/v1/update` | **implement edilmedi**; doküman yalnızca `Picking` güncellemesine izin veriyor |
| `products.push` | `POST /ms/product/tasks/product-create` | implement edilmedi |
| `price.push` | aynı `price-stock-update` ucu | implement edilmedi — 5.1 çözülmeden açılmaz |
| `returns.read` | dokümanda **yok** | `plannedCapabilities`; iade servisi dokümanı ayrıca istenecek |

Uçların üç ayrı kökte olduğuna dikkat: `/cdn/**`, `/ms/**`, `/rest/**`. Sipariş
servisi `/ms/` altında **değil** — doküman gelmeden `/ms/order/*` altında yapılan
tüm sondalar bu yüzden boş döndü.

### 5.1 Açık kalan tek soru: KDV

Doküman `salePrice`'ın KDV dâhil mi hariç mi olduğunu **söylemiyor**; `vatRate`'i
ayrı bir alan olarak veriyor. `N11Mapper.toUnifiedProduct` fiyatı olduğu gibi
okuyor ve kodda `// VARSAYIM: salePrice KDV dahil (brüt), doğrulanmadı` yorumu var.
**Doğrulama yöntemi:** satıcı panelinde bilinen bir ürünün fiyatını API yanıtıyla
karşılaştır. Bu yapılmadan `price.push` açılmaz.

### 5.2 Dokümandan çıkan, tasarımı değiştiren kısıtlar

- **`updateStock` asenkron.** İstek `taskId` döndürür; sonuç `task-details` ile
  alınır. Uygulanan yol: task gönder, bütçe içinde **bir kez** yokla; sonuç netse
  `success` true/false, değilse `StockUpdateResult.pending: true` + `taskId`.
  *Sonraki faz:* sonucu ayrı bir kuyruk işiyle sorgulayan akış
  (`sync-flow-builder` kapsamı) — bugünkü tek yoklama, uzun süren task'lerde
  sonucu bilinmez bırakır.
- **Paket bölünmesi.** Bir sipariş birden çok pakete bölünebilir; paketler ayrı
  kargolanır ve ayrı iptal edilir. Kayıt anahtarı `orderNumber-packageId`, ham
  numara `Order.marketplaceOrderNumber`'da. `id` null gelirse ("Konuma Özel
  Teslimat") tek başına `orderNumber` kullanılır.
- **15 günlük pencere.** n11 daha geniş aralığı sessizce kırpar; `backfillDays`
  kodda ve manifest'te 15 ile sınırlı. **2024 Kasım öncesi sipariş hiç gelmiyor.**
- **Statü başına tek istek.** `status` parametresi tek değer alır; seçilen her
  statü bir sweep demektir.
- **Statü sözlüğü:** `Created→pending`, `Picking→processing`, `Shipped→shipped`,
  `Delivered→delivered`, `Cancelled→cancelled`, `UnSupplied→cancelled`,
  `UnPacked→processing`. `UnPacked`'e yalnızca `Picking`'ten geçilir (içeriği alt
  paketlere taşınmış ana paket), bu yüzden **varsayılan içe aktarma listesinde
  yok** — çocuklarıyla birlikte alınırsa aynı mal iki kez sayılır.
- **`invoiced` ve `returned`** n11'de tanımsız; manifest seçeneklerinden çıkarıldı.
- **`integrator`** her yazma isteğinde zorunlu. Kod sabiti `"KroptOS"`, manifest'te
  `advanced.integrator` opsiyonel override.
- **Rate limit:** sipariş servisi 1000/dk (dokümanlı), ürün ve kategori için
  **limit yazmıyor** → muhafazakâr 60/dk. Etkin = `min(ayar, grup limiti)`.
- **`totalAmount` mutabakatsız.** Dokümanın kendi örneğinde paket toplamı ile satır
  toplamı arasında 149.99 fark var ve hiçbir alan bunu açıklamıyor (kargo olabilir;
  `deliveryFeeType` sadece ödeme tipi, tutar değil). `Order.totalAmount`'a paket
  tutarı yazılır, fark ≥ 0.01 ise uyarı loglanır.
- **Para birimi:** pakette alan yok → TRY varsayılır. Üründe `currencyType != TL`
  ise kayıt işlenmez, uyarı loglanır.

## 6. Doküman gelince sıra

Her uç için, tek tek:

1. **Ucu ekle** — `PATHS`'e gerçek yolu yaz, metodu implement et,
   `N11Connector.spec.ts`'te o metodun URL'ini assert et. (Okuma uçları için bu
   adım tamamlandı; kalanlar `orders.updateStatus`, `products.push`, `price.push`.)
2. **`defaultMode`'u `'live'`'a çevir** — ancak **tüm** okuma uçları doğrulandıktan
   sonra. Tek uç için erken çevirmek diğerlerini `notImplemented` hatasına düşürür.
3. **`plannedCapabilities`'ten çıkar** — `n11.settings.ts`. `capabilities`'e
   dokunma, o zaten dolu (bkz. 1.5).
4. **Alanın `deprecated`'ını kaldır** — ilgili UI alanı artık bir şeyi besliyorsa.
   `required: true` geri koyulacaksa sihirbazı bloke edip etmeyeceği düşünülsün.

Her adımda kapı kuralı (bölüm 4) yeniden koşulur.

---

## 7. Ortam kurulum notları

Yeni bir çalışma kopyası kurarken sırayla:

```bash
# 1. Bağımlılıklar — npm DEĞİL. Depo pnpm workspace (pnpm-lock.yaml, pnpm 11.9.0).
pnpm install --frozen-lockfile --prefer-offline     # ~1 dk 20 sn, store'dan hardlink

# 2. Shared paketi derlenmeli, yoksa backend tipleri çözülmez
cd packages/shared && npx tsc -p tsconfig.json

# 3. Prisma client üretilmeli, yoksa 14 suite derleme hatasıyla düşer
cd packages/backend && npx prisma generate

# 4. Testler
npx jest
```

**MAX_PATH / uzun yol:** `packages/frontend/src/app/t/[tenantPublicId]/integrations/
marketplace/components/fields/ResourceSelectField.tsx` ~118 karakter. Uzun bir
üst dizine `git worktree add` yapmak `Filename too long` ile yarıda kalır (git
yarım worktree'yi kendisi geri alır, elle temizlik gerekmez). **Kısa bir kök
kullanın** (`C:/bl-n11` gibi) ve gerekirse `git -c core.longpaths=true`.

**`node_modules` temizliği:** `robocopy /MIR` veya ayna/`--delete` kipindeki
hiçbir araç kullanılmamalı — pnpm workspace paketlerini junction olarak kurar,
ayna araçları bağlantıyı takip edip **hedefi** siler. `Remove-Item -Recurse -Force`,
uzun yol hatasında `cmd /c rmdir /s /q`. (Bkz. CLAUDE.md §8, 2026-08-08 vakası.)

**Doğrulama worktree'si:** `C:/bl-n11` şu an `84eb50e` üzerinde detached duruyor,
bağımlılıkları kurulu. İş bitince `git worktree remove /c/bl-n11`.

**Yedek:** `C:\Users\Administrator\Desktop\kroptos-backup\kroptos-pre-commit-20260817-201141.tgz`
(39 MB, 1906 dosya, `.git/` ve `packages/backend/.env` dahil, `node_modules` hariç).
