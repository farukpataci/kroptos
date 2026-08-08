# KroptOS — İyileştirme Prompt Paketi

Bu paket, tespit edilen 7 uyumsuzluğu 5 görevde (P0–P4) kapatmak için tasarlanmış
prompt yapısıdır. Her görev **ayrı bir sohbette**, **iki fazlı** çalıştırılır.

---

## 0. Kullanım Kuralları

| Kural | Neden |
|---|---|
| Her P için **yeni sohbet** aç | Bağlam penceresi dolunca model detayları uydurmaya başlar |
| Her prompt'un başına **Blok A**'yı yapıştır | Kuralları her seferinde tekrar anlatmamak için |
| **Faz A onaylanmadan Faz B'ye geçme** | Yanlış varsayım 400 satır koda dönüşmesin |
| Sırayı bozma: P0 → P2 → P3, P1 ve P4 bağımsız | P0 çıktısı P2'nin, P2 çıktısı P3'ün girdisi |
| Her P sonunda **Blok D**'yi (doğrulama) çalıştır | Değişikliğin gerçekten çalıştığını görmeden ilerleme |

**Bağımlılık grafiği:**

```
P0 (sözleşme envanteri) ──> P2 (shared tipler) ──> P3 (server-side pagination)
P1 (guard tutarlılığı)   ── bağımsız, istediğin an
P4 (i18n temizliği)      ── bağımsız, en son yapılması önerilir
```

---

## Blok A — Ortak Başlık (HER prompt'un başına yapıştır)

```
# BAĞLAM
KroptOS: çok kiracılı commerce OS. pnpm monorepo.
- packages/backend  — NestJS + Prisma + PostgreSQL + BullMQ (port 3001)
- packages/frontend — Next.js App Router + Tailwind kp-* token + next-intl (port 3000)
- packages/shared   — ortak TypeScript tipleri
Kiracı hiyerarşisi: Agency > Client > Store. Aktif bağlam {agencyId, clientId, storeId}
üçlüsü, x-agency-id / x-client-id / x-store-id header'larıyla taşınır.

# DEĞİŞMEZ KURALLAR
1. Frontend sayfalar 'use client' ile başlar. Veri erişimi SADECE @/lib/api içindeki
   apiFetch üzerinden. Ham fetch/axios kullanılmaz.
2. Sayfa mantığı hooks/useXxx.ts içine; page.tsx ince (kompozisyon) kalır.
3. Stil sadece kp-* token sınıfları. Ham hex/renk yok. İkonlar @heroicons/react/24/outline.
4. Backend controller: AuthGuard('jwt') + TenantGuard + PermissionGuard +
   @RequirePermission('kaynak.aksiyon'). Servis her sorguda tenant filtresi +
   soft delete (deletedAt) + audit uygular.
5. Metinler i18n anahtarıyla; yeni anahtar TÜM messages/*.json dosyalarına eklenir.
6. Bu depoda eticaret-system/ arşiv klasörü ARTIK YOKTUR (2026-08-08'de
   kaldırıldı, commit geçmişinde duruyor). Eski dokümanlarda veya sohbetlerde
   adı geçerse yok say; oradan örnek alma, geri getirme.

# YASAKLAR (ihlali görevi geçersiz kılar)
- Görmediğin bir alan adını, endpoint'i veya dönüş tipini UYDURMA.
  Emin değilsen dur ve "şu dosyayı görmem gerek: <yol>" diye iste.
- docs/ altındaki dokümanları GERÇEK KABUL ETME. Bu dokümanların koddan saptığı
  tespit edildi. Tek doğruluk kaynağı packages/ altındaki koddur.
- Yeni mimari kalıp icat etme. Komşu dosyaların düzenini taklit et.
- Kapsam dışına çıkma. Yol üstünde gördüğün başka bir sorunu DÜZELTME,
  sadece "Kapsam dışı gözlem" başlığı altında not düş.

# DB YAZMA KISITI
DB'ye kalıcı yazma. Kalıcı olmayan doğrulama yazması (transaction içinde
yaz-oku-rollback, veya fixture ekle-doğrula-sil) BENİM ONAYIMLA yapılabilir.
Onay almadan yazma. Yazdıysan öncesi/sonrası satır sayısını göster.
Seed değişikliği gerekiyorsa ÖNER, uygulama.

# KANIT ZORUNLULUĞU
Her iddian için kaynağını belirt: "X şöyle çalışıyor (kaynak: packages/.../y.ts)".
Kaynak gösteremiyorsan iddiayı yazma, dosyayı iste.
```

---

## Blok B — İki Fazlı Protokol (Blok A'dan hemen sonra yapıştır)

```
# ÇALIŞMA PROTOKOLÜ
Bu görevi İKİ FAZDA yapacaksın.

## FAZ A — Analiz (bu fazda TEK SATIR KOD YAZMA)
Çıktın tam olarak şu 5 başlıktan oluşacak:
1. OKUDUKLARIM — incelediğin dosyaların listesi
2. BULGULAR — mevcut durum, her madde kaynak dosya referanslı
3. EKSİK BİLGİ — göremediğin ve görmen gereken dosyalar (yoksa "yok" yaz)
4. DEĞİŞİKLİK PLANI — tablo: | Dosya | İşlem (yeni/değişecek/silinecek) | Ne yapılacak |
5. RİSKLER — bu değişikliğin kırabileceği yerler

Sonra DUR ve onay bekle. Onay gelmeden Faz B'ye geçme.

## FAZ B — Uygulama (sadece "FAZ B" dediğimde başla)
- Faz A'da onaylanan plandaki dosyaları, plandaki sırayla üret.
- Her dosyayı tam yol başlığıyla ver: packages/.../dosya.ts
- Kısmi/elips (…) kod verme; dosya kısaysa tamamını, uzunsa değişen bloğu
  önce/sonra olarak net göster.
- Sonunda "DOĞRULAMA" başlığı altında çalıştırılacak komutları listele.
```

---

## Blok C — Görev Promptları

> Kullanım: Blok A + Blok B + aşağıdaki ilgili P bloğu, aynı mesaja arka arkaya yapıştırılır.

### P-KEŞİF — Zemin tespiti (İLK BU, tek fazlı)

```
# GÖREV: KEŞİF
Aşağıdaki soruları kesin cevapla. Cevap veremediğin her soru için hangi dosyaya
ihtiyacın olduğunu yaz. Bu görevde kod yazma, plan da yapma — sadece tespit.

1. packages/backend/src/main.ts içinde app.setGlobalPrefix() çağrısı VAR MI?
   Varsa değeri ne? Controller'lar zaten @Controller('/api/...') yazdığına göre
   gerçek endpoint yolu tam olarak nedir? (/api/products mu, /api/api/products mu)
2. packages/shared/ altında şu an ne var? Hangi tipler tanımlı, bunları backend
   veya frontend gerçekten import ediyor mu? (import eden dosyaları göster)
3. Backend controller'ları iki gruba ayır:
   GRUP-1: TenantGuard KULLANAN ve req.activeAgency/activeClient/activeStore okuyanlar
   GRUP-2: TenantGuard KULLANMAYAN ve doğrudan req.user.agencyId okuyanlar
   Her controller'ı tam yoluyla listele.
4. Frontend'de apiFetch çağrılarının dönüş tipleri: kaç tanesi düz dizi (T[]),
   kaç tanesi zarf ({items:...} veya {data:...}) bekliyor? Endpoint bazında tablo yap.
5. Prisma Decimal alanları (price, totalAmount, unitPrice vb.) API'den JSON'a
   çevrilirken string mi number mı dönüyor? Serileştirme ayarı nerede yapılıyor?

ÇIKTI: Numaralı cevaplar + "EKSİK BİLGİ" listesi. Başka hiçbir şey yazma.
```

### P0 — Sözleşme envanteri ve doküman düzeltme

```
# GÖREV: P0 — API SÖZLEŞME ENVANTERİ
docs/API_ROUTES.md ve docs/AGENTS.md dosyalarının gerçek koddan saptığı tespit edildi.
Örnek sapmalar: doküman POST /stores/:storeId/products diyor, kod @Controller('/api/products');
doküman {data, pagination} zarfı diyor, kod düz dizi dönüyor; AGENTS.md axios interceptor
gösteriyor, kod fetch tabanlı apiFetch kullanıyor.

AMAÇ: Gerçek koddan türetilmiş, tek doğruluk kaynağı olacak bir sözleşme envanteri
üretmek ve yanlış dokümanları buna göre düzeltmek.

KAPSAM İÇİ:
- packages/backend/src/modules/**/*.controller.ts dosyalarının TAMAMINI tara
- Her endpoint için: HTTP metodu, tam yol, gerekli izin (@RequirePermission),
  guard seti, istek DTO'su, gerçek dönüş tipi, tenant bağlamını nereden aldığı
- Çıktıyı docs/API_CONTRACT.md olarak üret (YENİ dosya)
- docs/API_ROUTES.md ve docs/AGENTS.md içindeki YANLIŞ bölümleri düzelt

KAPSAM DIŞI:
- Endpoint davranışını değiştirme, yeni endpoint ekleme, controller'a dokunma
- Bu görev SADECE dokümantasyon üretir/düzeltir. Kaynak kodda değişiklik YOK.

KABUL KRİTERİ:
- API_CONTRACT.md'deki her satır bir controller dosyasına referans veriyor
- Doküman ile kod arasında kalan hiçbir çelişki yok; çelişki bulunamayan
  yer varsa "DOĞRULANAMADI" olarak işaretlenmiş
- Guard seti tutarsız olan endpoint'ler ayrı bir "TUTARSIZ" tablosunda toplanmış
  (bunlar P1'in girdisi olacak)
```

### P1 — Guard ve tenant bağlamı tutarlılığı

```
# GÖREV: P1 — TENANT BAĞLAMI TUTARLILIĞI
TESPİT: Backend'de iki farklı kalıp var.
- ProductController: AuthGuard + TenantGuard + PermissionGuard kullanıyor, veriyi
  req.activeAgency / req.activeClient / req.activeStore üzerinden okuyor.
- settings/users, settings/roles, settings/permissions, warehouse-settings/stock-allocation
  controller'ları: TenantGuard YOK, doğrudan req.user.agencyId (JWT'den) okuyor.

RİSK: Çoklu tenant erişimi olan kullanıcı tenant değiştirdiğinde ikinci grup hâlâ
JWT'deki eski agency'yi görür. Bu, "cross-tenant sızıntıya sıfır tolerans" kuralının ihlali.

AMAÇ: Tüm controller'ları GRUP-1 kalıbına (TenantGuard + aktif bağlam) taşımak.

KAPSAM İÇİ:
- TenantGuard'ı eksik olan her controller'a ekle
- req.user.agencyId okumalarını aktif tenant bağlamı okumasına çevir
- Her endpoint'in @RequirePermission izni gerçekten tanımlı mı kontrol et;
  tanımlı değilse seed'e eklenmesi gerekenleri listele
- Servis katmanında ilgili sorgulara tenant filtresi eksikse ekle

KAPSAM DIŞI:
- Yeni endpoint, yeni izin adı icat etme (eksikleri sadece RAPORLA)
- Frontend'e dokunma
- TenantGuard'ın kendi iç mantığını değiştirme

ÖNCE ŞUNU CEVAPLA (Faz A'da):
- TenantGuard tam olarak neyi doğruluyor ve req'e hangi alanları koyuyor?
  (kaynak: common/guards/tenant.guard.ts ve common/middleware/tenant.middleware.ts)
- Bazı endpoint'lerin storeId bağlamı OLMADAN çalışması gerekiyor mu?
  (ör. sistem ayarları agency seviyesinde) Gerekiyorsa bunlar için doğru kalıp ne?

KABUL KRİTERİ:
- Hiçbir controller req.user.agencyId'yi tenant filtresi olarak kullanmıyor
- Değişen her endpoint için "önce/sonra" guard seti tablosu var
- Agency seviyesinde çalışması gereken endpoint'ler ayrıca gerekçelendirilmiş
```

### P2 — Paylaşılan tipler ve tek response zarfı

```
# GÖREV: P2 — TEK DOĞRULUK KAYNAĞI TİPLER
GİRDİ: P0 çıktısı docs/API_CONTRACT.md (yoksa önce P0'ı çalıştır).

TESPİT:
- Product tipi iki yerde farklı tanımlı: orders/hooks/useOrders.ts içinde 4 alanlı,
  products/hooks/useProducts.ts içinde ~25 alanlı. Backend ProductResponseDto ile
  ikisi de senkron değil.
- Response şekli tutarsız: products/orders düz dizi dönüyor, integration-logs
  {items: [...]} zarfı dönüyor.
- unitPrice / totalPrice tipleri "string | number" — Prisma Decimal serileştirmesi
  tip düzeyinde çözülmemiş.
- packages/shared mevcut ama pratikte kullanılmıyor.

AMAÇ: Tipleri packages/shared'a taşımak ve tek bir response konvansiyonu oturtmak.

KAPSAM İÇİ:
- packages/shared altında sözleşme tipleri: Product, Order, OrderItem, Category,
  User, Paginated<T> (P0 envanterindeki GERÇEK alanlara göre)
- Decimal alanları için tek karar: string mi number mı? Kararı gerekçelendir,
  serileştirmeyi backend'de tek yerde uygula, tipleri buna göre yaz
- Backend DTO'larını ve frontend hook'larını bu tiplere bağla
- Zarf kararı: TÜM liste endpoint'leri aynı şekli dönsün

KAPSAM DIŞI:
- Sayfalama mantığını backend'e taşımak (bu P3'ün işi — burada sadece Paginated<T>
  TİPİNİ tanımla, kullanımı P3'te)
- Yeni alan ekleme/çıkarma; sadece var olanı tiple

ÖNEMLİ: Zarf konvansiyonunu değiştirmek KIRICI bir değişiklik. Faz A'da
"hangi frontend dosyaları kırılır" listesini mutlaka çıkar.

KABUL KRİTERİ:
- Frontend'de hiçbir hook kendi Product/Order interface'ini tanımlamıyor
- pnpm build tüm workspace'lerde geçiyor
- "string | number" gibi kaçamak tip kalmamış
```

### P3 — Sayfalama, filtreleme ve aramayı backend'e taşıma

```
# GÖREV: P3 — SERVER-SIDE PAGINATION
GİRDİ: P2 çıktısı (packages/shared içindeki Paginated<T> tipi).

TESPİT: useProducts ve useOrders tüm kaydı çekip client-side filter() + slice()
yapıyor. PAGE_SIZE=20 sadece görsel. Arama yalnızca yüklenmiş veri üzerinde çalışıyor.
Bu, "milyonlarca sipariş" hedefiyle bağdaşmıyor.

AMAÇ: Sayfalama + filtreleme + aramayı backend'e taşımak.

KAPSAM İÇİ:
- Backend liste endpoint'lerine query DTO'su: page, limit, search, status,
  categoryId, stockLevel, dateRange (mevcut frontend filtrelerinin BİREBİR karşılığı)
- Prisma sorgusunda skip/take + where + orderBy; toplam sayı için ayrı count
- Paginated<T> döndür
- Frontend hook'larını sunucu sayfalamasına çevir; arama girdisine debounce ekle
- Prisma şemasına gereken index'ler (Faz A'da hangi index gerektiğini gerekçelendir)

KAPSAM DIŞI:
- Yeni filtre türü icat etme. Frontend'de şu an olmayan bir filtreyi ekleme.
- UI tasarımını değiştirme. Sayfalama bileşeni görsel olarak aynı kalsın.
- Cache/Redis katmanı ekleme.

DİKKAT: statusCounts, lowStockCount, outOfStockCount şu an TÜM ürünler üzerinden
hesaplanıyor. Sunucu sayfalamasına geçince bunlar bozulur. Faz A'da bunun için
çözüm öner (ayrı bir /products/stats endpoint'i mi, response'a ek alan mı).

KABUL KRİTERİ:
- Hook'larda filter()/slice() ile client-side sayfalama kalmamış
- 2. sayfada arama yapınca sonuç TÜM veri üzerinden geliyor
- Sayaçlar (düşük stok, tükendi) hâlâ doğru
```

### P4 — i18n temizliği

```
# GÖREV: P4 — HARDCODED METİN TEMİZLİĞİ
TESPİT: 12 dil sözlüğü (messages/*.json) var ama koda gömülü metinler bunlara bağlı değil.
Örnekler:
- Hook'larda: 'Ürünler yüklenemedi', 'Siparişler yüklenemedi'
- OrderDetailDrawer'da sabit sekme başlıkları: 'Genel Bakış', 'Geçmiş', 'Entegrasyonlar'
- integrations/errors sayfasında: 'Suggested Action', 'Show Technical Stack Trace'
- Landing sayfalarında isTr ? 'tr metin' : 'en metin' deseni (12 dil varken sadece 2)

AMAÇ: Gömülü metinleri i18n anahtarlarına çıkarmak.

KAPSAM İÇİ (bu görevde SADECE dashboard tarafı — /t/[tenantPublicId]/** ve hooks):
- Gömülü kullanıcıya görünen metinleri tespit et
- Anlamlı anahtar hiyerarşisi öner (mevcut messages/tr.json yapısına UYARAK)
- Anahtarları tr.json ve en.json'a ekle; diğer 10 dile İngilizce fallback ile ekle
  ve eklenenleri "çeviri bekliyor" olarak listele
- Bileşenleri useTranslations ile bağla

KAPSAM DIŞI:
- Landing / [locale] sayfalarındaki isTr deseni (ayrı ve çok daha büyük iş — DOKUNMA)
- WMS uygulaması (/app/wms/**) — ayrı görevde
- Yeni dil ekleme, çeviri kalitesini iyileştirme
- Metinlerin kendisini değiştirme/güzelleştirme — birebir taşı

ÖNCE ŞUNU CEVAPLA (Faz A'da):
- Hook'lardaki hata mesajları için doğru kalıp ne? Hook içinde çevrilmiş metin mi
  tutulmalı, yoksa hook anahtar dönüp bileşen mi çevirmeli? Gerekçelendir.

KABUL KRİTERİ:
- Kapsam içindeki dosyalarda kullanıcıya görünen sabit string kalmamış
- Eklenen her anahtar 12 dilin HEPSİNDE mevcut (fallback olsa bile)
- Eksik anahtar uyarısı vermeden uygulama açılıyor
```

---

## Blok D — Doğrulama (her P'nin Faz B'sinden sonra)

```
# GÖREV: DOĞRULAMA
Az önce yaptığın değişiklikler için:
1. Çalıştırılacak komutları sırayla ver (build, lint, migrate, test)
2. MANUEL TEST SENARYOSU: adım adım, beklenen sonucuyla birlikte.
   Özellikle çok kiracılı senaryoyu ekle: iki farklı tenant'a erişimi olan
   kullanıcıyla giriş yap, tenant değiştir, verinin gerçekten değiştiğini doğrula.
3. GERİ ALMA: bir şey ters giderse hangi dosyalar geri alınmalı?
4. Bu değişiklik knowledge dosyalarından hangilerini eskitti?
   (00_PROJECT_CONTEXT.md / 01_FRONTEND_PAGE_ANATOMY.md /
    02_BACKEND_MODULE_ANATOMY.md / 03_ROUTE_AND_MODULE_MAP.md)
   Güncellenmesi gereken bölümleri tam olarak göster.
```

---

## Blok E — Yeni Görev İçin Boş Kalıp

Listede olmayan bir iş çıktığında bu iskeleti doldur:

```
# GÖREV: <kısa ad>
GİRDİ: <bu görev hangi önceki görevin çıktısına dayanıyor, yoksa "yok">

TESPİT: <mevcut durum, kaynak dosya referanslı — varsayım değil gözlem yaz>

AMAÇ: <tek cümle>

KAPSAM İÇİ:
- <madde>

KAPSAM DIŞI:
- <yoldan çıkma ihtimali olan her şeyi buraya yaz — bu bölüm boş kalmasın>

ÖNCE ŞUNU CEVAPLA (Faz A'da):
- <senin de emin olmadığın karar noktaları>

KABUL KRİTERİ:
- <gözlemlenebilir, "çalışıyor" gibi muğlak değil>
```

---

## Ek — Neden Bu Yapı?

- **Ayrı sohbet**: bağlam dolduğunda model hatırlamak yerine uydurur. Her P'yi
  temiz pencerede çalıştırmak bunu engeller.
- **Faz A / Faz B ayrımı**: en pahalı hata, yanlış varsayımın koda dönüşmesi.
  Plan aşamasında yakalanan hata bedava, kod aşamasında değil.
- **KAPSAM DIŞI bölümü**: modelin en yaygın davranışlarından biri "yol üstünde
  gördüğü başka şeyi de düzeltmek". Bu, review edilemez büyüklükte diff üretir.
- **Kanıt zorunluluğu**: bu projedeki sorunların çoğu zaten dokümanın koddan
  sapmasıydı. Kaynak göstermeyi zorunlu kılmak aynı hatayı tekrarlamayı zorlaştırır.
- **"DOĞRULANAMADI" işareti**: modelin bilmediğini itiraf etmesine meşru bir yer
  açmak, boşluğu doldurma dürtüsünü azaltır.