# Entegrasyon İzolasyonu — Bağlaşım Envanteri ve Faz Planı

**Tarih:** 2026-08-18
**Durum:** Analiz. **Kod yazılmadı.** Uygulama, n11 canlıya alındıktan sonra ayrı dalda.
**Tetikleyen olay:** eMAG'ın `base.settings.ts`'e eklediği 8 seçenek, karşılık gelen
`tr.json` anahtarları yazılmadığı için **14 sağlayıcının hepsini birden** kırmızıya
düşürdü — 210 test.

**Hedef:** Bir sağlayıcının değişikliği veya yarım işi diğerlerini kırmamalı.
**Hedef değil:** Kopya kod. Bkz. §3.

Ölçüm tarihi 2026-08-18, `f4f29a7`. Satır numaraları o commit'e ait.

---

## 1. Bağlaşım envanteri

### K1 — `manifest.i18n.spec.ts`: locale x sağlayıcı çarpımı

`settings/manifest.i18n.spec.ts:137-147`

```ts
describe.each(localeFiles)('locale %s', (file) => {
  it.each(providers)('resolves every key %s references', (provider) => { ... })
```

15 locale x 14 sağlayıcı = **210 test**. Sağlayıcı listesi `registry.listProviders()`
(satır 112) ile üretiliyor; her yeni sağlayıcı çarpanı büyütüyor.

Asıl bağlaşım: test her sağlayıcının **kendi** anahtarlarını değil, **çözülen
manifest'in tüm** anahtarlarını kontrol ediyor (`manifestKeys`, satır 72-89).
Çözülen manifest base'i içerdiği için base'e eklenen bir seçeneğin eksik çevirisi
**her sağlayıcıda** eksik sayılıyor.

- **Etki yarıçapı:** 14/14 sağlayıcı, 15 locale
- **Gerçekleşti mi:** **Evet.** eMAG olayının doğrudan mekanizması.
- **İzolasyon maliyeti:** **S**
- **Kaybedilen:** Doğru yapılırsa hiçbir şey. Risk: base anahtarı eksikliğinin
  sağlayıcı testinde görünmemesi — bu yüzden base testi silinmemeli, ayrılmalı.

### K2 — `base.settings.ts`: paylaşılan seçenek listeleri

`settings/base.settings.ts:77` (`general.environment`), **`:93` (`general.currency`)**,
**`:101` (`general.timezone`)**, `:186` ve `:226` (`orders.importStatuses`).

eMAG'ın `4d4d1d7` ile eklediği: `RON, BGN, HUF, PLN` ve
`Europe/{Bucharest,Sofia,Budapest,Warsaw}`. Tek bir sağlayıcının ihtiyacı, listeye
girer girmez 14 sağlayıcının UI'ında görünüyor ve 14 sağlayıcının i18n yükümlülüğü
oluyor.

- **Etki yarıçapı:** 14/14
- **Gerçekleşti mi:** **Evet.** Trendyol satıcısına Macar forinti sunuluyor.
- **İzolasyon maliyeti:** **M**
- **Kaybedilen:** Tek yerden "tüm desteklenen para birimleri" görüntüsü. Sağlayıcı
  bazlı listede iki sağlayıcının aynı birimi farklı yazması (`TRY` vs `TL`) mümkün
  hale gelir; bunu bir birlik testiyle kapatmak gerekir.

### K3 — `manifest.registry.ts`: boot anında tek Map

`settings/manifest.registry.ts:52-58` — `OVERRIDES` (satır 28-42, 14 sağlayıcı)
tek seferde `resolveManifest`'ten geçiriliyor. Bir override throw ederse Map hiç
kurulmaz ve registry'yi enjekte eden her yer patlar.

- **Etki yarıçapı:** 14/14 + registry'ye bağımlı her modül
- **Gerçekleşti mi:** Hayır, ama yakını oldu (`factory-registry-ayrismasi`).
- **İzolasyon maliyeti:** **S**
- **Kaybedilen:** "Bozuk override boot'ta patlasın" güvencesi — satır 47-50'de
  bilerek yazılmış bir tasarım. Yerine sağlık testi gelmeli, yoksa sessizleşir.

### K4 — `core/MarketplaceConnector.ts`: 17 alt sınıfın ortak tabanı

17 connector miras alıyor. `send()`, `describeError()`, `probe()`, `mapOrderStatus()`,
`prefixOrderNumber()`, `connectionMode` burada.

- **Etki yarıçapı:** 17/17
- **Gerçekleşti mi:** **Evet, iki kez.** `updateStock`'a `identifiers` parametresi;
  `probe()`'a `modeStamp`.
- **İzolasyon maliyeti:** **L** — ve büyük ölçüde **yapılmamalı**. Bkz. §3.
- **Kaybedilen:** Tek yerden davranış düzeltme. İzolasyonun yanlış uygulanacağı en
  tehlikeli nokta.

### K5 — `MarketplaceConnectorFactory.ts`: 22 import, 18 case

Herhangi bir connector dosyası derlenmezse factory derlenmez, dolayısıyla
factory'yi import eden hiçbir şey derlenmez.

- **Etki yarıçapı:** 18/18 + servis ve worker
- **Gerçekleşti mi:** **Evet.** Bu oturumda `manifest.registry.ts` untracked
  `emag.settings.ts`'i import ediyordu; o dosya olmadan hiçbir şey derlenmiyordu.
- **İzolasyon maliyeti:** **M**
- **Kaybedilen:** Statik `switch`'in derleme-zamanı bütünlük garantisi ve "bu
  provider nerede kuruluyor" izlenebilirliği. Dinamik kayıt, kaydedilmemiş bir
  provider'ı çalışma zamanına erteler.

### K6 — Ortak spec'ler: bir sağlayıcı tüm suite'i kırıyor

| Dosya | Tüm sağlayıcıları geziyor mu |
|---|---|
| `settings/manifest.i18n.spec.ts` | **evet** (`listProviders`, 4 yerde) |
| `core/MarketplaceConnectorFactory.spec.ts` | **evet** (`it.each(registered)`, satır 42) |
| `settings/manifest.merge.spec.ts` | kısmen (`resolves each registered provider independently`) |

Jest bir suite'i tek birim sayar; kapı kuralı da tüm paket üzerinden okunuyor.

- **Etki yarıçapı:** 14/14
- **Gerçekleşti mi:** **Evet**, K1 ile aynı olay.
- **İzolasyon maliyeti:** **S**
- **Kaybedilen:** "Tek komutla hepsi yeşil mi" kolaylığı; kapı kuralı yeniden
  tanımlanmalı.

### K7 — Capability -> tab bağı

`settings/base.settings.ts:151` (`orders.read`->orders), `:312` (`products.push`->catalog),
`:434` (`stock.push`->stock), `:575` (`price.push`->pricing), `:850` (`returns.read`->returns);
alan bazlı: `:258`, `:665`, `:823`, `:955`.

Sağlayıcılar arası değil, tek yönlü bir tuzak: yeteneği çıkarmak tab'i siler, tab
silinince `settings.validator.ts:21` (422) ve `:36-50` (`pruneInvisible`) saklı
ayar değerlerini **budar**.

- **Etki yarıçapı:** 1 sağlayıcı, ama o sağlayıcının **verisi**
- **Gerçekleşti mi:** Hayır — bu oturumda yakalandı, `plannedCapabilities` ile aşıldı.
- **İzolasyon maliyeti:** **S** (test + doküman; kod değişikliği gerekmiyor)
- **Kaybedilen:** Yok.

### K8 — Rate limiter: süreç genelinde tek Map

`core/MarketplaceRateLimiter.ts:5` tek `Map`, `integration.module.ts:21,32` tek
singleton. Kova anahtarı `rateLimitKey` (`core/MarketplaceConnector.ts:86`),
varsayılanı provider adı. Yedi connector override ediyor (aliexpress, allegro,
ebay, emag, temu, trendyol_global, zalando); n11 servis grubu için `:` ekliyor
(`core/MarketplaceConnector.ts:258`).

**Anahtar tenant içermiyor:** iki ajansın Trendyol entegrasyonu aynı `TRENDYOL`
kovasını paylaşıyor — biri kotayı doldurunca diğeri bekliyor.

- **Etki yarıçapı:** Sağlayıcılar arası düşük, **tenant'lar arası yüksek**
- **Gerçekleşti mi:** Ölçülmedi.
- **İzolasyon maliyeti:** **S**
- **Kaybedilen:** Kota gerçekten hesap başına ise tenant bazlı kova **fazla istek**
  üretir. Sağlayıcı bazında doğrulanmadan yapılmamalı.

### K9 — Sync worker: hata sınırı sağlam, ortak gövde bağlı

`modules/integration/integration-sync.worker.ts:591` — `processJob`'ın tek
`try/catch`'i; `:37` ve `:68` ayrıca sarmalıyor. Bir sağlayıcının hatası yalnızca
o işi düşürüyor. **Bu nokta bugün sağlıklı.**

Bağlaşım kodda değil şekilde: `sync_products`/`sync_orders`/`sync_stock` dallarının
gövdesi (`:375-540`) tüm sağlayıcılar için ortak; bir sağlayıcının ihtiyacı
(n11'in `marketplaceOrderNumber`'ı) bu ortak gövdeye giriyor.

- **Etki yarıçapı:** 18/18 (kod yolu), 1/18 (çalışma zamanı)
- **Gerçekleşti mi:** Hayır.
- **İzolasyon maliyeti:** **M**
- **Kaybedilen:** Ortak gövdedeki tenant kapsaması, dry-run, simülasyon kapısı ve
  stok politikası. Sağlayıcı başına gövde bunları 18 kez tekrarlatır — CLAUDE.md
  kuralı 1 gereği **kötü** bir takas. İzolasyon hook düzeyinde olmalı.

### K10 — `messages/tr.json`: 3.634 satır, 14 sağlayıcı tek dosyada

- **Etki yarıçapı:** 14/14 (merge çakışması), 15 locale dosyası
- **Gerçekleşti mi:** Kısmen — çakışma yaşanmadı ama iki kez bilerek kaçınıldı.
- **İzolasyon maliyeti:** **M**
- **Kaybedilen:** Tek dosyada arama kolaylığı; next-intl tek dosya beklediği için
  birleştirme adımı gerekir.

### K11 — `AddIntegrationModal.tsx`: elle yazılmış 72 kart

`CATALOG_PROVIDERS` dizisinde **72 sağlayıcı kartı**; `capabilities` ve `status`
elle yazılı, backend manifest'inden türetilmiyor.

- **Etki yarıçapı:** 72 kart tek dosyada — aynı dosyada çalışan iki kişi çakışır
- **Gerçekleşti mi:** **Evet.** n11 kartı `status: 'active'` ve
  `['Siparişler','Stok','Fiyatlar']` diyordu; üçü de çalışmıyordu. Türetilse bu
  yalan mümkün olmazdı.
- **İzolasyon maliyeti:** **M**
- **Kaybedilen:** Pazarlama metni üzerindeki editoryal kontrol. Doğru yol: yetenek
  listesini türet, metni elde tut.

### K12 — `prisma/schema.prisma`: tek şema, ortak tablolar

Bir sağlayıcının ihtiyacı ortak tabloya kolon ekliyor (`Order.marketplaceOrderNumber`).

- **Etki yarıçapı:** Tüm sağlayıcılar aynı `Order`/`Product` tablolarını yazıyor
- **Gerçekleşti mi:** Evet, ama zararsız (nullable kolon).
- **İzolasyon maliyeti:** **L**, **önerilmez**
- **Kaybedilen:** Sağlayıcıdan bağımsız sipariş modeli — ürünün tamamı bunun
  üzerine kurulu. Doğru izolasyon şema değil, sağlayıcıya özel alanların ortak
  sorgulara sızmaması.

---

## 2. Özet tablo

| # | Nokta | Yarıçap | Gerçekleşti | Maliyet | Öncelik |
|---|---|---|---|---|---|
| K1 | i18n spec çarpımı | 14 | **evet** | S | **1** |
| K6 | ortak spec'ler | 14 | **evet** | S | **1** |
| K2 | base paylaşılan seçenekler | 14 | **evet** | M | **2** |
| K7 | capability -> tab | 1 (veri) | hayır (yakalandı) | S | 2 |
| K11 | elle yazılmış katalog | 72 | **evet** | M | 3 |
| K3 | registry tek Map | 14 | hayır (yakını) | S | 3 |
| K5 | factory statik import | 18 | **evet** | M | 4 |
| K8 | rate limiter kovası | tenant | ölçülmedi | S | 4 |
| K10 | tek tr.json | 14 | kısmen | M | 5 |
| K9 | worker ortak gövde | 18 | hayır | M | 6 |
| K4 | ortak base sınıf | 17 | evet | L | **yapma** |
| K12 | ortak şema | tümü | evet | L | **yapma** |

---

## 3. ORTAK KALMASI GEREKENLER

İzolasyon kopya kod demek değildir. Aşağıdakiler bilerek paylaşılmıştır; sağlayıcı
başına çoğaltılırsa bir sonraki hatayı 17-19 yerde düzeltiriz.

| Ortak | Neden ortak kalmalı | Çoğaltılırsa ne olur |
|---|---|---|
| `MarketplaceHttpClient` retry sınıflandırması | undici'nin `cause` davranışı, protokol/TLS/DNS ayrımı, süre bütçesi — hiçbiri sağlayıcıya özel değil | Bir sonraki undici sürüm farkı **19 dosyada** düzeltilir, biri unutulur |
| `MarketplaceTypes` sözleşmeleri (`MarketplaceOrder`, `StockUpdateResult`, `mode`/`pending` damgaları) | Worker tek tip okuyor; tip ayrışırsa worker'da 19 dallı `if` doğar | Sipariş içe aktarma mantığı sağlayıcı başına kopyalanır, tenant kapsaması dahil |
| `MarketplaceConnector` taşıma katmanı (`send`, `describeError`, `probe`, `requireCredentials`) | Kimlik bilgisi sızdırmama, HTML gövde tespiti, hata mesajı biçimi | Bir connector kimlik bilgisini hata mesajına koyar, kimse fark etmez |
| `mapOrderStatus` / `prefixOrderNumber` | Satıcının gördüğü ayar her sağlayıcıda çalışmalı; "tanımlı ama okunmuyor" hatası zaten yaşandı | Ayar bazı sağlayıcılarda sessizce ölür |
| Simülasyon kapısı (`connectionMode` + worker'ın yazmama kuralı) | Sahte verinin veritabanına sızmaması tek yerde garanti | 18 yerde kontrol; biri unutulur, sahte sipariş gerçek sanılır |
| Tenant kapsaması ve soft-delete filtreleri | CLAUDE.md kalıp kuralı 1 | Yatay yetki sızıntısı |
| `settings.validator` + `manifest.merge` | Ayar kaydetme/budama semantiği | Bir sağlayıcıda saklı ayarlar sessizce budanır |

**Ayrım kuralı:** *Mekanizma ortak, politika sağlayıcıya özel.*
HTTP nasıl yapılır -> ortak. Hangi URL, hangi statü sözlüğü, hangi para birimi ->
sağlayıcıya özel.

---

## 4. Faz planı

Her faz tek başına değerli ve tek başına geri alınabilir.

### Faz 0 — Kapı kuralını sağlayıcı bazlı hale getir *(K6, K1'in ön koşulu)*

Bugünkü kapı "tüm paket yeşil mi" diye soruyor; bu, bir sağlayıcının eksiğini proje
geneli arıza gibi gösteriyor. Önce **ölçüm** düzeltilecek ki sonraki fazların etkisi
görülebilsin.

- Jest raporundan sağlayıcı bazlı özet üreten script (`test:providers`).
- Yeni kapı: "**değişen sağlayıcının** testleri yeşil **ve** ortak testler yeşil".
- **Geri alınabilirlik:** Tam. Yalnızca ek script; mevcut komutlar durur.
- **Bitti testi:** eMAG kırmızısı dururken `n11` için kapı **yeşil** raporlar.

### Faz 1 — i18n testini ayır *(K1, K6)*

`manifest.i18n.spec.ts` ikiye bölünür:
- `base.i18n.spec.ts` — base manifest anahtarları, locale başına **bir** test.
- `provider.i18n.spec.ts` — sağlayıcı başına **yalnızca kendi** anahtarları
  (`manifestKeys(resolved)` eksi `manifestKeys(base)`).

- **Geri alınabilirlik:** Tam (test dosyası).
- **Bitti testi:** `base.settings.ts`'e çevirisiz bir seçenek eklendiğinde yalnızca
  `base.i18n.spec.ts` kırmızıya döner; 14 sağlayıcı testi yeşil kalır.
- **Not:** 210 kırmızı bu fazda ~15'e düşer (locale x base). eMAG işi hâlâ eksiktir
  ama artık **eMAG'ın** eksiği olarak görünür.

### Faz 2 — Sağlayıcıya özel seçenekleri base'den çıkar *(K2)*

`general.currency` ve `general.timezone` base'de çekirdek listeyle kalır;
sağlayıcılar `patchFields` ile kendi listelerini verir. Desen hazır: n11'de
`orders.importStatuses` bu oturumda böyle yapıldı.

- **Önce Faz 1 gelmeli**; aksi halde 210 test birden hareket eder ve regresyon
  okunamaz.
- **Geri alınabilirlik:** Orta. `pruneInvisible` bir sağlayıcının listesinden çıkan
  değeri **budar**. Yalnızca daraltma yapılmayan sağlayıcılarda uygulanır;
  daraltılacaksa önce veri taraması
  (`SELECT DISTINCT values->>'general.currency' FROM "IntegrationSetting"`).
- **Bitti testi:** Trendyol manifest'inde `HUF` yok, eMAG'da var; ve kayıtlı hiçbir
  ayar değeri budanmıyor (veri taraması yeşil).

### Faz 3 — Katalog kartlarını yetenekten türet *(K11)*

Metin (ad, açıklama, renk) elde kalır; `capabilities` ve `status` backend'in
`listProviders()` + `plannedCapabilities` çıktısından türetilir.

- **Geri alınabilirlik:** Tam (frontend).
- **Bitti testi:** Bir sağlayıcının `plannedCapabilities`'ine `stock.push` eklenince
  kartındaki "Stok" rozeti testte kaybolur; elle düzenleme gerekmez.

### Faz 4 — Registry ve factory'yi hataya dayanıklı yap *(K3, K5)*

- Registry: `resolveManifest` sağlayıcı başına try/catch; başarısız olan
  `unavailable` işaretlenir, diğerleri ayakta kalır; bir sağlık testi başarısızları
  **isimle** raporlar.
- Factory: `switch` yerine sağlayıcı modülü başına kayıt.
- **Geri alınabilirlik:** Orta — "boot'ta patla" güvencesi bilerek konmuştu
  (`manifest.registry.ts:47-50`); yerine sağlık testi gelir.
- **Bitti testi:** Bilerek bozulmuş bir override ile registry kurulur,
  `isSupported('trendyol')` **true** döner, sağlık testi bozuk sağlayıcıyı isimle
  raporlar.

### Faz 5 — Rate limiter kovasına tenant ekle *(K8)*

Anahtar `provider` -> `provider:agencyId[:grup]`. **Önce** her sağlayıcı için
kotanın hesap başına mı IP başına mı olduğu doğrulanmalı; hesap başına değilse o
sağlayıcı için bu faz atlanır.

- **Geri alınabilirlik:** Tam.
- **Bitti testi:** İki farklı `agencyId` ile aynı sağlayıcıya paralel çağrı; ikisi
  de kendi kotasını kullanıyor.

### Faz 6 — Worker dallarına sağlayıcı hook'u *(K9)*

Ortak gövde (tenant kapsaması, dry-run, simülasyon kapısı, stok politikası) korunur;
sağlayıcıya özel kısımlar için isteğe bağlı hook. Kopyalama yok.

- **Geri alınabilirlik:** Orta.
- **Bitti testi:** n11'in `marketplaceOrderNumber` yazımı hook'a taşınır ve worker'ın
  ortak gövdesinde n11'e özel tek satır kalmaz.

### Faz 7 — `tr.json`'ı parçala *(K10)*

En son: faydası en düşük, araç zinciri değişikliği gerektiriyor. Faz 1'den sonra
çakışma acısı zaten büyük ölçüde azalır.

---

## 5. Doğrulama testi — izolasyonun kabul kriteri

**İddia:** Bir sağlayıcı bilerek bozulduğunda diğerleri yeşil kalır.

### `provider-isolation.spec.ts`

Kalıcı bir test, elle yapılan tatbikat değil:

```
her sağlayıcı P için (14 sağlayıcı):
  1. P'nin manifest'ine çevirisi olmayan bir alan enjekte et
     (BELLEK İÇİ override; dosyaya dokunma)
  2. i18n doğrulamasını TÜM sağlayıcılar için çalıştır
  3. ASSERT: P kırmızı
  4. ASSERT: diğer 13'ün hepsi yeşil        <-- izolasyonun kanıtı
```

Aynı kalıp üç bozma tipiyle tekrarlanır:

| Bozma tipi | Beklenen | Bugün ne olurdu |
|---|---|---|
| Çevirisi olmayan alan (K1) | yalnız P kırmızı | **14'ü birden kırmızı** |
| `resolveManifest`'i throw ettiren override (K3) | yalnız P kullanılamaz | **registry hiç kurulmaz** |
| Connector'ı derlenmez yapan tip hatası (K5) | yalnız P'nin testi kırmızı | **tüm paket derlenmez** |

Üçüncüsü jest içinden yapılamaz (derleme zamanı); ayrı bir script olarak
`tsc --noEmit` sonucunu sağlayıcı bazlı proje referanslarıyla ölçmek gerekir. Bu
Faz 4'ün kapsamına girer ve o faza kadar **bilinen sınır** olarak kalır.

### Kabul kriteri

> İzolasyon işi, `provider-isolation.spec.ts`'in **üç bozma tipinde de** yeşil
> olduğu gün bitmiş sayılır. O güne kadar her faz, bu testin kaç bozma tipini
> geçtiğiyle ölçülür. **Bugün: 0/3.**

### Bu testin kendi riski

- Bozma **bellek içinde** yapılmalı. Dosyaya yazıp geri alan bir test, çöktüğünde
  depoyu bozuk bırakır.
- `describe.each` ile 14 x 3 = 42 senaryo üretir; süre kontrol edilmeli. Gerekirse
  örnekleme yapılır (tip başına 3 sağlayıcı) — ama **eMAG ve n11 her koşuda**
  dahil edilmeli: ikisi de gerçekleşmiş olayın tarafı.

---

## 6. Bu planın kapsamadıkları

- **Sağlayıcı başına ayrı npm paketi / repo.** Değerlendirilmedi. Ortak sözleşme
  (§3) paylaşıldığı sürece paket sınırı bağlaşımı azaltmaz, sürüm yönetimi ekler.
- **Şema izolasyonu (K12)** ve **base sınıf izolasyonu (K4).** Bilerek dışarıda;
  §3'ün ana maddeleri.
- **Kırmızının kendisi.** Bu plan eMAG'ın 20 eksik anahtarını **çözmez**, yalnızca
  o eksiğin diğer 13 sağlayıcıyı kırmasını engeller. Anahtarlar yine eklenmeli.

## 7. Ölçülmeyenler / bu analizin sınırları

- **K8 (rate limiter)** tenant çakışması **ölçülmedi** — tek satıcılı bir ortamda
  görünmez. Faz 5'ten önce çok kiracılı bir koşuda doğrulanmalı.
- **Frontend tarafı** yalnızca `AddIntegrationModal` ve `messages/` üzerinden
  tarandı; ayar çekmecesi ve sihirbazın sağlayıcı bazlı davranışı incelenmedi.
- **ERP / kargo / ödeme** entegrasyonları kapsam dışı. `ErpConnectorFactory` benzer
  bir statik `switch` kullanıyor (K5 ile aynı desen) ama sayılmadı.
- Satır numaraları `f4f29a7`'e ait; sonraki commit'lerde kayabilir.
