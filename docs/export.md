# Görev: "Siparişleri Dışa Aktar" sayfasını uçtan uca hayata geçir

KroptOS'ta **Siparişler → Siparişleri Dışa Aktar** sayfası şu an boş durum ekranı gösteriyor
("Bu sayfanın arkasında henüz bir servis ucu yok…"). Bu sayfanın arkasına gerçek bir dışa aktarma
sistemi kur. Kapsam şunları içeriyor: filtreleme, kolon seçimi, kayıtlı şablonlar, CSV/XLSX üretimi,
büyük veride arka plan işi, indirme geçmişi ve zamanlanmış (tekrarlayan) dışa aktarımlar.

**Önce `kroptos-konvansiyonlari` skill'ini oku ve harfiyen uy.** Kanonik örnekler: backend
`src/modules/product/`, frontend `products` sayfası. Ekip sırası:
`proje-yoneticisi → db-prisma → backend-dev → entegrasyon-dev → frontend-dev → test-qa → code-reviewer`.

---

## 0. Keşif (kod yazmadan önce)

1. Sayfanın mevcut dosyasını, sidebar kaydını ve i18n anahtarlarını bul. Sayfa başlığı ve açıklaması
   ("Seçilen tarih aralığındaki siparişleri CSV veya XLSX olarak indir") korunacak.
2. **Sipariş Listesi** sayfasının filtrelerini ve backend'deki sorgu/filtre DTO'sunu incele.
   Dışa aktarma **aynı filtre mantığını yeniden kullanmalı**; ayrı bir filtre motoru yazma.
   "Listede ne görüyorsam onu dışa aktar" davranışı hedefleniyor.
3. Sipariş, sipariş kalemi, müşteri/alıcı, adres, ödeme, kargo (shipment), fatura, iade ve pazaryeri
   modellerinde hangi alanların kolon olabileceğini listele.
4. Projede dosya depolama (S3/MinIO/yerel), imzalı URL, xlsx/csv kütüphanesi (exceljs, csv-stringify),
   BullMQ kuyruğu ve bildirim altyapısı var mı? Varsa onları kullan, ikincisini kurma.
   Bildirim Şablonları işi yapıldıysa "dışa aktarma hazır" e-postası o altyapıdan gitsin.
5. **Siparişleri İçe Aktar** sayfası planlanıyorsa kolon anahtarlarını ortak tut. Böylece dışa
   aktarılan dosya düzenlenip geri içe aktarılabilir. Plana not düş.
6. Üst bardaki Dağıtıcı Firma / Marka seçicisinin ("Tüm Markalar" dahil) diğer sayfalarda nasıl
   ele alındığını incele. Çoklu marka seçiliyken dışa aktarma birden fazla markayı kapsayabilir;
   kullanıcı yalnız yetkili olduğu kapsamı görebilmeli.

Keşif sonunda kısa plan yaz; belirsiz kararlarda varsayımını belirt ve devam et.

---

## 1. Kavramsal model

```
Dışa aktarma = Filtre + Kolon seti + Satır modu + Format ayarları
```

- **Filtre:** tarih aralığı (hangi tarih alanı: sipariş / ödeme / kargoya veriliş / teslim),
  durum(lar), satış kanalı/pazaryeri, marka, mağaza, ödeme yöntemi, kargo firması, etiket,
  fatura durumu, iade durumu, il, tutar aralığı, sipariş no listesi (yapıştırma ile).
- **Satır modu:**
  - `ORDER`: sipariş başına bir satır; ürünler özet kolonunda birleştirilir.
  - `LINE_ITEM`: kalem başına bir satır; sipariş kolonları her satırda tekrarlanır.
    Muhasebe ve depo için bu mod gerekir.
- **Kolon kataloğu:** backend'de gruplu tanımlanır (Sipariş, Müşteri, Teslimat adresi, Fatura adresi,
  Ödeme, Kargo, Kalem, Fatura, Pazaryeri, İade). Her kolonun şu özellikleri var: `key`, `labelKey`
  (i18n), `type` (string/number/money/date/boolean), `group`, `rowModes` (hangi modda geçerli),
  `pii` (kişisel veri mi), `permission?`.
- **Format ayarları:** CSV veya XLSX, CSV ayırıcı (`;` varsayılan, TR Excel uyumu için; `,` seçilebilir),
  kodlama (UTF-8 + BOM varsayılan), tarih formatı ve **saat dilimi** (mağaza saat dilimi varsayılan),
  ondalık ayırıcı, para birimi kolonunun ayrı mı birleşik mi olacağı, başlık dili (TR/EN).
- **Şablon (preset):** kayıtlı filtre + kolon + mod + format kombinasyonu. Örnek: "Muhasebe aylık",
  "Depo çıkış listesi". Sistem hazır şablonları seed ile gelir.

---

## 2. Veritabanı (db-prisma)

Zorunlu alanlar her modelde (`id uuid`, `agencyId`, `clientId?`, `storeId`, `createdAt`, `updatedAt`,
`deletedAt?`, `@@index([agencyId])`, `@@index([storeId])`). Çoklu mağaza kapsamı gerekiyorsa
mevcut şemadaki benzer örnekle gerekçelendir.

**OrderExportPreset**
- `name`, `description?`, `isSystemDefault`, `isShared` (ekipte görünür mü), `createdById`
- `filters` (Json), `columns` (Json: sıralı `key` dizisi + opsiyonel özel başlık), `rowMode`,
  `format`, `formatOptions` (Json)
- Tekillik tenant ile birlikte: `@@unique([storeId, name])`.

**OrderExportJob**
- `presetId?`, `requestedById`, `filters`, `columns`, `rowMode`, `format`, `formatOptions`
  (preset değişse bile işin kendi kopyası)
- `status` (`QUEUED | PROCESSING | COMPLETED | FAILED | CANCELLED | EXPIRED`), `progress` (0–100),
  `totalRows?`, `processedRows`
- `fileKey?`, `fileName?`, `fileSize?`, `expiresAt?`, `errorMessage?`, `includesPii` (bool)
- `scheduleId?`, `startedAt?`, `completedAt?`, `downloadCount`
- İndeksler: `[storeId, createdAt]`, `[requestedById, createdAt]`, `[status]`.

**OrderExportSchedule** (tekrarlayan dışa aktarma)
- `presetId`, `cron` (günlük/haftalık/aylık seçeneklerinden üretilir), `timezone`,
  `relativeRange` (`YESTERDAY | LAST_7_DAYS | LAST_WEEK | LAST_MONTH | MONTH_TO_DATE`),
  `recipients` (e-posta dizisi), `isActive`, `lastRunAt?`, `nextRunAt?`, `createdById`.

Migration: `git pull` → `pnpm db:migrate`, elle düzenleme yok. Seed: hazır şablonlar (bkz. §5).

---

## 3. Backend (backend-dev)

Modül: `src/modules/order-export/`. İçerik: `order-export.controller.ts`, `order-export.service.ts`,
`columns/column-registry.ts` (katalog + değer çözücüler), `writers/csv.writer.ts`,
`writers/xlsx.writer.ts`, `order-export.processor.ts` (BullMQ), `order-export.scheduler.ts`, `dto/`.
Guard zinciri, `@RequirePermission`, Swagger, üç `@ApiHeader`, tenant filtresi, soft delete ve audit
log — istisnasız. Filtreleme için Sipariş Listesi'nin sorgu oluşturucusunu çağır.

**Yetkiler:** `order_export.create`, `order_export.read` (kendi işleri), `order_export.read_all`
(ekibin işleri), `order_export.pii` (kişisel veri kolonları), `order_export_preset.manage`,
`order_export_schedule.manage`. Rol seed'lerine ekle.

**Endpoint'ler:**

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/order-exports/columns` | Kolon kataloğu (kullanıcının yetkisine göre filtrelenmiş) |
| POST | `/order-exports/count` | Filtre → eşleşen sipariş/kalem sayısı (ön bilgi) |
| POST | `/order-exports/preview` | Filtre + kolonlar → ilk 20 satır (JSON, dosya üretmez) |
| POST | `/order-exports` | İş oluştur (201). Yanıtta `jobId` |
| GET | `/order-exports` | İş geçmişi (sayfalı; filtre: durum, tarih, kullanıcı) |
| GET | `/order-exports/:id` | Durum + ilerleme (polling için) |
| GET | `/order-exports/:id/download` | Kısa ömürlü imzalı URL üretir; `downloadCount++`, audit |
| POST | `/order-exports/:id/cancel` | Sıradaki/çalışan işi iptal |
| POST | `/order-exports/:id/rerun` | Aynı ayarlarla yeniden çalıştır |
| DELETE | `/order-exports/:id` | Soft delete + dosyayı depodan sil (204) |
| GET/POST/PATCH/DELETE | `/order-export-presets[/:id]` | Şablon CRUD (güncelleme PATCH) |
| GET/POST/PATCH/DELETE | `/order-export-schedules[/:id]` | Zamanlama CRUD |
| POST | `/order-export-schedules/:id/run-now` | Zamanlamayı hemen çalıştır |

**Üretim akışı**
1. `POST /order-exports` doğrulama yapar: kolonlar katalogda mı, kullanıcının yetkisi var mı
   (PII kolonları `order_export.pii` ister, yoksa 403), tarih aralığı en fazla 12 ay, satır tahmini
   üst sınırı aşmıyor mu (ör. 1M; XLSX için sayfa limiti 1.048.576). Aynı kullanıcının aynı anda en
   fazla 3 aktif işi olabilir.
2. İş her zaman **BullMQ** `order-export` kuyruğuna gider, request içinde dosya üretilmez.
   Arayüz yine de küçük dışa aktarımları (ör. < 5.000 satır) birkaç saniyede bitmiş gibi gösterir.
3. Processor siparişleri **cursor tabanlı sayfalama** ile 1.000'lik parçalar halinde okur
   (offset kullanılmaz; `id`/tarih cursor). İlişkiler parça başına toplu yüklenir (N+1 yok).
   Veri **stream** ile yazıcıya akar ve bellekte tüm dosya tutulmaz (exceljs streaming writer,
   csv-stringify stream). `progress` her parçada güncellenir.
4. Dosya depoya `exports/{agencyId}/{storeId}/{jobId}.{ext}` yoluyla yüklenir. `expiresAt` = 7 gün.
   İş tamamlanınca uygulama içi bildirim gönderilir. Kullanıcı sayfadan ayrıldıysa isteğe bağlı
   e-posta da gider (link sayfaya yönlendirir, dosya eki yok).
5. Hata olursa `FAILED` + anlaşılır mesaj. Retry: 2 deneme. İptal edilen iş parça arasında durur
   ve yarım dosyayı siler.
6. Temizlik: süresi dolan dosyalar zamanlanmış job ile silinir, iş `EXPIRED` olur.

**Dosya içeriği kuralları**
- **CSV/Formül enjeksiyonu koruması:** `=`, `+`, `-`, `@`, tab veya CR ile başlayan metin hücrelerinin
  başına `'` eklenir. Müşteri adı ve adres gibi dış kaynaklı alanlar bu kurala tabidir.
- CSV: UTF-8 BOM (Türkçe karakterler Excel'de düzgün görünür), RFC 4180 tırnaklama, satır sonu `\r\n`.
- XLSX: başlık satırı kalın ve dondurulmuş, otomatik filtre açık, kolon genişlikleri içeriğe göre
  ayarlı. Para ve tarih hücreleri **gerçek sayı/tarih tipiyle** yazılır (metin değil) ve uygun
  sayı formatı uygulanır. Dosyaya ayrıca bir "Bilgi" sayfası eklenir: filtre özeti, oluşturan kişi,
  oluşturulma zamanı, saat dilimi.
- Tarihler seçilen saat diliminde yazılır; başlıkta saat dilimi belirtilir.
- Tutarlarda para birimi karışıksa (çok para birimli mağaza) ayrı `Para Birimi` kolonu zorunludur.
- Dosya adı: `siparisler_{marka}_{baslangic}_{bitis}_{jobId kısa}.xlsx` (ASCII'ye dönüştürülmüş).

**Güvenlik ve uyum (KVKK)**
- PII kolonları (ad, telefon, e-posta, adres, TCKN/VKN) ayrı yetki ister. İşte `includesPii` işaretlenir
  ve geçmişte rozetle gösterilir.
- İndirme yalnız kısa ömürlü (ör. 5 dk) imzalı URL ile yapılır. Dosyalar kamuya açık değildir.
  Başka tenant'ın işine erişim 404 verir.
- Her iş oluşturma, indirme ve silme audit log'a yazılır (`action`, `jobId`, kolon listesi, filtre
  özeti, `includesPii`).
- Zamanlanmış e-posta alıcıları yalnız mağaza ekibindeki kullanıcılardan veya doğrulanmış alan
  adlarından seçilebilir. PII içeren zamanlamalar dış alıcıya gönderilemez.

**Zamanlanmış dışa aktarımlar**
`order-export.scheduler.ts` repeatable job ile `nextRunAt` gelen zamanlamaları çalıştırır.
`relativeRange` mağaza saat dilimine göre somut tarihe çevrilir ("dün" = mağaza saatine göre dün).
İş normal akıştan geçer, ardından alıcılara indirme linkli e-posta gider. Art arda 3 hata alan
zamanlama pasife alınır ve oluşturana bildirim gönderilir.

---

## 4. Frontend (frontend-dev)

Klasör: mevcut sayfa yolu altında `page.tsx`, `hooks/useOrderExport.ts`, `hooks/useExportJobs.ts`,
`hooks/useExportSchedules.ts`, `components/`. `'use client'`, yalnız `apiFetch`/`api.*`, yalnız
`kp-*` tokenlar, `@heroicons/react/24/outline`, tüm metinler `useTranslations` (TR + EN).
Mevcut başlık yapısını koru; boş durum placeholder'ını kaldır.

**Sekmeler:** **Yeni Dışa Aktarma** · **Geçmiş** · **Zamanlanmış**

**Yeni Dışa Aktarma sekmesi** (tek ekranda, yukarıdan aşağı adımlar)
1. **Şablon:** üstte şablon seçici ("Boş başla" + hazır ve kayıtlı şablonlar). Seçince tüm alanlar
   dolar. "Şablon olarak kaydet" / "Şablonu güncelle" butonları.
2. **Filtreler:** tarih aralığı seçici (hızlı seçenekler: Bugün, Dün, Son 7 gün, Bu ay, Geçen ay,
   Özel) ve tarih alanı seçimi. Diğer filtreler Sipariş Listesi'ndeki bileşenlerle aynıdır
   (mümkünse aynı bileşenler yeniden kullanılır). Altta canlı sayaç (debounce'lu `/count`):
   "1.284 sipariş · 3.902 kalem".
3. **Satır modu:** "Sipariş başına bir satır" / "Ürün kalemi başına bir satır", kısa açıklamayla.
4. **Kolonlar:** sol tarafta gruplu katalog (arama + grup bazında "tümünü seç"), sağ tarafta seçili
   kolonlar (sürükle-bırak sıralama, başlığı yeniden adlandırma, kaldırma). PII kolonları kilit
   ikonuyla işaretlenir; yetki yoksa pasif görünür ve tooltip ile açıklanır. Seçili moda uymayan
   kolonlar gizlenir.
5. **Format:** CSV / XLSX seçimi. "Gelişmiş" katlanır alanında ayırıcı, kodlama, saat dilimi,
   tarih formatı ve başlık dili bulunur.
6. **Önizleme:** ilk 20 satır tablo halinde (`/preview`), yatay kaydırmalı.
7. **"Dışa Aktar" butonu:** iş oluşturulur. Sayfada ilerleme kartı çıkar (polling, 2 sn; sekme
   görünmüyorsa durur). Tamamlanınca "İndir" butonu gösterilir. Kullanıcı sayfadan ayrılabilir,
   iş Geçmiş sekmesinde görünür.
- Sipariş Listesi sayfasındaki mevcut filtrelerle buraya gelinebilmeli
  (ör. listede "Dışa aktar" butonu → filtreler query param ile taşınır). Mümkünse ekle.

**Geçmiş sekmesi**
- Sayfalı tablo: tarih, oluşturan, şablon adı, filtre özeti, satır sayısı, format, boyut, durum
  rozeti (`kp-success|warning|danger|info`), PII rozeti, son geçerlilik tarihi.
- Satır aksiyonları: İndir, Yeniden çalıştır, İptal (çalışıyorsa), Sil. Süresi dolmuş dosyalarda
  "Yeniden oluştur" gösterilir.

**Zamanlanmış sekmesi**
- Liste: ad, şablon, sıklık özeti ("Her Pazartesi 08:00 · geçen hafta"), alıcılar, son/sonraki
  çalışma, aktif toggle.
- Oluştur/düzenle modalı: şablon seçimi, sıklık (günlük/haftalık/aylık + saat), göreli aralık,
  alıcılar, "Şimdi çalıştır".

Boş, yükleniyor ve hata durumları her sekme için tasarlanır. Tenant bağlamı yoksa konvansiyondaki
boş durum gösterilir.

---

## 5. Hazır şablonlar (seed)

- **Muhasebe:** kalem başına; sipariş no, tarih, fatura no, ürün, KDV oranı, KDV hariç/dahil tutar,
  indirim, kargo ücreti, ödeme yöntemi, pazaryeri komisyonu (varsa).
- **Kargo / depo çıkış listesi:** sipariş başına; sipariş no, alıcı, telefon, adres, il/ilçe, desi,
  kargo firması, takip no, kapıda ödeme tutarı.
- **Pazaryeri mutabakatı:** sipariş başına; pazaryeri, pazaryeri sipariş no, brüt tutar, komisyon,
  kargo kesintisi, net hakediş, durum.
- **İade raporu:** kalem başına; iade kodu, neden, tutar, durum, iade tarihi.
- **Basit liste:** sipariş no, tarih, müşteri, tutar, durum.

Alanı olmayan kolonlar (ör. komisyon modülde yoksa) seed'den çıkarılır ve raporlanır.

---

## 6. Test (test-qa)

- Birim: her kolon çözücüsü (boş/eksik ilişki dahil), satır modları, CSV kaçış ve formül enjeksiyonu
  koruması, BOM, ayırıcı, saat dilimi dönüşümü (gün sınırındaki siparişler), para/tarih hücre
  tipleri, göreli aralığın somut tarihe çevrilmesi.
- Entegrasyon: 50.000 siparişlik seed ile dışa aktarma; bellek sabit kalmalı (stream), ilerleme
  artmalı, satır sayısı count ile eşleşmeli. İptal edilen işin yarım dosyası silinmeli.
- **Filtre tutarlılığı:** aynı filtreyle Sipariş Listesi'nin döndürdüğü sipariş kümesi ile dışa
  aktarılan küme birebir aynı olmalı.
- **Tenant izolasyonu:** A mağazasının işi, dosyası, şablonu ve zamanlaması B'den erişilemez (404);
  imzalı URL başka tenant ile üretilemez.
- Yetki: PII kolonu yetkisiz 403; `read` yetkisi yalnız kendi işlerini gösterir, `read_all` hepsini.
- Zamanlama: doğru tarihte doğru aralık, art arda hatada pasife alma, PII + dış alıcı engeli.
- Frontend: kolon seçici, sayaç, ilerleme kartı, geçmiş aksiyonları için hook ve bileşen testleri.

---

## 7. Kabul kriterleri

- [ ] Sayfadaki "servis ucu yok" boş durumu gitti; üç sekme çalışıyor.
- [ ] "Geçen ay, Trendyol, Teslim edildi" filtresiyle kalem bazlı XLSX üretiliyor. Türkçe karakterler,
      tarihler ve tutarlar Excel'de doğru tipte ve formatta açılıyor.
- [ ] Aynı dışa aktarma CSV olarak Excel'de (TR bölge ayarı) tek tıkla doğru kolonlara ayrılıyor.
- [ ] 50.000+ siparişlik dışa aktarma zaman aşımına uğramadan arka planda tamamlanıyor ve ilerleme görünüyor.
- [ ] PII yetkisi olmayan kullanıcı telefon/adres kolonlarını seçemiyor.
- [ ] Şablon kaydedilip tekrar kullanılabiliyor; hazır şablonlar listede.
- [ ] Haftalık zamanlama doğru aralıkla çalışıyor ve alıcılara link gidiyor.
- [ ] İndirme, oluşturma ve silme işlemleri audit log'da.
- [ ] Tüm metinler TR/EN, yalnız `kp-*` token, ham `fetch` yok, Swagger dokümante.
- [ ] `pnpm lint && pnpm format && pnpm test` yeşil.

## 8. Teslim

Branch: `feature/order-export`. Conventional Commits ile katman başına commit
(db → kolon kataloğu + yazıcılar → processor + endpoint'ler → scheduler → frontend → test).
PR açıklamasında şunlar yer alsın: keşif kararları (yeniden kullanılan filtre katmanı, depolama,
kütüphaneler), kolon kataloğunda olmayan alanlar, kapsam dışı bırakılanlar ve sonraki adımlar
(ör. İçe Aktar ile ortak kolon anahtarları, PDF/yazdırma listesi, diğer modüller için genel dışa
aktarma altyapısına dönüştürme).