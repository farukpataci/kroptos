# Görev: "Siparişleri İçe Aktar" sayfasını uçtan uca hayata geçir

KroptOS'ta **Siparişler → Siparişleri İçe Aktar** sayfasının arkasına gerçek bir içe aktarma sistemi kur.
Kapsam şunları içeriyor: CSV/XLSX yükleme, kolon eşleştirme, satır bazlı doğrulama (ön kontrol),
arka planda işleme, hata raporu, eşleştirme şablonları ve içe aktarımı geri alma.

**Önce `kroptos-konvansiyonlari` skill'ini oku ve harfiyen uy.** Kanonik örnekler: backend
`src/modules/product/`, frontend `products` sayfası. Ekip sırası:
`proje-yoneticisi → db-prisma → backend-dev → entegrasyon-dev → frontend-dev → test-qa → code-reviewer`.

**Bağımlılık:** "Siparişleri Dışa Aktar" işindeki **kolon kataloğu** (`column-registry`) bu işte de
kullanılır. Dışa aktarılan bir dosya, kolon başlıkları değiştirilmeden geri yüklendiğinde eşleştirme
otomatik yapılmalı. Katalog o işte yoksa, iki modülün paylaşacağı şekilde ortak bir yere çıkar.

---

## 0. Keşif (kod yazmadan önce)

1. Sayfanın mevcut dosyasını, sidebar kaydını ve i18n anahtarlarını bul; boş durum placeholder'ı kaldırılacak.
2. **Sipariş oluşturma ve güncelleme** hangi servis metotlarında yapılıyor? Pazaryeri senkronu
   siparişleri nasıl oluşturuyor? İçe aktarma **bu metotları çağırmalı** (numara üretimi, toplam
   hesabı, stok rezervasyonu, audit, domain event). Ayrı bir `prisma.order.create` yolu yazma.
3. Ürün eşleştirme için SKU/barkod alanları, varyant modeli ve stok rezervasyon mantığını incele.
4. Müşteri/alıcı modeli ve tekilleştirme anahtarı (e-posta, telefon) nedir?
5. Sipariş durumları, kargo firmaları, ödeme yöntemleri ve satış kanalları nasıl tanımlı?
   Dosyadaki metin değerler ("Teslim Edildi", "Aras Kargo", "Kapıda Ödeme") bunlara eşlenecek.
6. Bildirim Şablonları ve Otomasyon işleri yapıldıysa, içe aktarılan siparişlerin event üretip
   üretmeyeceğini kontrol edilebilir yap (bkz. §1 Yan etkiler).
7. Dosya depolama, BullMQ ve xlsx/csv okuma kütüphaneleri projede ne kullanılıyor? Aynılarını kullan.

Keşif sonunda kısa plan yaz; belirsiz kararlarda varsayımını belirt ve devam et.

---

## 1. Kavramsal model

```
Yükle → Eşleştir → Ön kontrol (dry-run) → Onayla → İşle → Rapor (→ İsteğe bağlı geri al)
```

- **İçe aktarma modu:**
  - `CREATE_ONLY`: yalnız yeni siparişler; mevcut olan satırlar atlanır.
  - `UPDATE_ONLY`: yalnız mevcut siparişleri güncelle (ör. toplu durum, takip no, fatura no güncelleme).
  - `UPSERT`: varsa güncelle, yoksa oluştur.
- **Eşleşme anahtarı** (mevcut siparişi bulmak için): KroptOS sipariş no, dış/pazaryeri sipariş no
  (+ kanal), ya da harici referans. Kullanıcı seçer.
- **Satır → sipariş gruplama:** bir dosyada aynı sipariş birden fazla satırda olabilir
  (kalem başına satır, dışa aktarmadaki `LINE_ITEM` moduna uyumlu). Satırlar eşleşme anahtarına göre
  gruplanır. Sipariş seviyesi alanlar gruptaki satırlarda çelişirse bu bir hatadır.
- **Değer eşlemeleri:** dosyadaki metin → sistem kaydı. Kapsam: durum, kargo firması, ödeme yöntemi,
  satış kanalı, ürün (SKU/barkod/ad). Otomatik eşleşmeyen değerler için kullanıcıdan eşleme istenir
  (ör. "Teslim Edildi" → *Delivered*). Bu eşlemeler şablona kaydedilir.
- **Yan etkiler (kullanıcı seçer, güvenli varsayılanlarla):**
  - Stok düş/rezerve et: yeni siparişlerde varsayılan **kapalı** (geçmiş siparişler aktarılırken stok bozulmasın).
  - Müşteriye bildirim gönder: varsayılan **kapalı**.
  - Otomasyon kurallarını tetikle: varsayılan **kapalı**.
  - Pazaryerine geri senkronize et: varsayılan **kapalı**.
  Kapalı olan yan etkiler için domain event'leri `source: IMPORT, suppress: [...]` bilgisiyle yayınlanır
  ve dinleyiciler buna uyar.
- **Eşleştirme şablonu:** kolon eşleştirmesi + değer eşlemeleri + mod + varsayılan ayarlar.
  Tekrarlayan kaynaklar için (ör. "Eski sistem aylık dosyası") kullanılır.

---

## 2. Veritabanı (db-prisma)

Zorunlu alanlar her modelde (`id uuid`, `agencyId`, `clientId?`, `storeId`, `createdAt`, `updatedAt`,
`deletedAt?`, `@@index([agencyId])`, `@@index([storeId])`).

**OrderImportMapping** (şablon)
- `name`, `isShared`, `createdById`, `mode`, `matchKey`, `columnMap` (Json: dosya başlığı → katalog anahtarı),
  `valueMaps` (Json: alan → {dosya değeri → sistem id}), `defaults` (Json: kanal, durum, para birimi,
  saat dilimi, yan etki ayarları), `fileHints` (Json: ayırıcı, kodlama, başlık satırı, sayfa adı).
- `@@unique([storeId, name])`.

**OrderImportJob**
- `mappingId?`, `requestedById`, `fileKey`, `fileName`, `fileHash` (sha256), `fileSize`, `format`
- Ayarların işe ait kopyası: `mode`, `matchKey`, `columnMap`, `valueMaps`, `options`
- `status` (`UPLOADED | MAPPING | VALIDATING | VALIDATED | QUEUED | PROCESSING | COMPLETED |
  COMPLETED_WITH_ERRORS | FAILED | CANCELLED | ROLLING_BACK | ROLLED_BACK`)
- Sayaçlar: `totalRows`, `totalOrders`, `validOrders`, `invalidOrders`, `createdCount`, `updatedCount`,
  `skippedCount`, `failedCount`, `progress`
- `errorReportKey?`, `startedAt?`, `completedAt?`, `rollbackDeadline?`
- İndeksler: `[storeId, createdAt]`, `[storeId, fileHash]`.

**OrderImportRowResult** (sipariş grubu başına)
- `jobId`, `groupKey`, `rowNumbers` (int[]), `action` (`CREATE | UPDATE | SKIP`),
  `status` (`VALID | INVALID | SUCCESS | FAILED | SKIPPED | ROLLED_BACK`),
  `errors` (Json: `{ row, column, code, message }[]`), `warnings` (Json), `orderId?`,
  `beforeSnapshot?` (Json; UPDATE'lerde geri alma için yalnız değişen alanlar)
- İndeks: `[jobId, status]`.

Sipariş modelinde yoksa `importJobId?` alanı ekle (içe aktarmayla oluşan siparişleri izlemek ve
geri almak için). Migration: `git pull` → `pnpm db:migrate`, elle düzenleme yok.

---

## 3. Backend (backend-dev)

Modül: `src/modules/order-import/`. İçerik: `order-import.controller.ts`, `order-import.service.ts`,
`parsing/file-reader.ts` (stream CSV/XLSX okuyucu), `parsing/value-parsers.ts` (tarih, sayı, para,
telefon, boolean), `mapping/auto-mapper.ts`, `validation/order-row.validator.ts`,
`order-import.processor.ts` (BullMQ), `dto/`. Guard zinciri, `@RequirePermission`, Swagger, üç
`@ApiHeader`, tenant filtresi, soft delete ve audit log — istisnasız.

**Yetkiler:** `order_import.create`, `order_import.read`, `order_import.read_all`,
`order_import.update_existing` (UPDATE/UPSERT modları), `order_import.rollback`,
`order_import_mapping.manage`. Rol seed'lerine ekle.

**Endpoint'ler:**

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/order-imports/template?format=&rowMode=` | Boş örnek dosya (başlıklar + 2 örnek satır + açıklama sayfası) |
| POST | `/order-imports/upload` | Multipart yükleme (201) → `jobId`, algılanan ayarlar, başlıklar, ilk 10 satır, otomatik eşleştirme önerisi |
| PATCH | `/order-imports/:id/mapping` | Kolon eşleştirme, mod, eşleşme anahtarı ve ayarları kaydet |
| GET | `/order-imports/:id/unmapped-values` | Eşleşmeyen durum/kargo/ödeme/kanal/ürün değerleri ve öneriler |
| PATCH | `/order-imports/:id/value-maps` | Değer eşlemelerini kaydet |
| POST | `/order-imports/:id/validate` | Ön kontrolü kuyruğa at (dry-run; hiçbir şey yazılmaz) |
| GET | `/order-imports/:id` | Durum, ilerleme ve sayaçlar (polling) |
| GET | `/order-imports/:id/rows?status=` | Satır sonuçları (sayfalı) |
| POST | `/order-imports/:id/start` | Onayla ve işle. Yalnız `VALIDATED` durumunda çalışır |
| POST | `/order-imports/:id/cancel` | İptal |
| GET | `/order-imports/:id/error-report` | Hatalı satırları + "Hata" kolonuyla dosya (imzalı URL) |
| POST | `/order-imports/:id/rollback` | Geri al (süre ve koşullara bağlı) |
| GET | `/order-imports` | Geçmiş (sayfalı) |
| DELETE | `/order-imports/:id` | Soft delete + dosyaları depodan sil (204) |
| GET/POST/PATCH/DELETE | `/order-import-mappings[/:id]` | Şablon CRUD |

**Dosya okuma**
- Limitler: en fazla 20 MB, 50.000 satır. XLSX'te sayfa seçilebilir (varsayılan ilk sayfa).
  Uzantı ve MIME birlikte kontrol edilir. Makrolu dosyalar (`.xlsm`) reddedilir.
- **Kodlama algılama:** UTF-8 (BOM'lu/BOM'suz) ve **Windows-1254** (Türkçe Excel'in eski CSV
  çıktısı). Türkçe karakterler bozuk görünüyorsa kullanıcı önizlemede kodlamayı değiştirebilir.
- **Ayırıcı algılama:** `;`, `,`, tab. Başlık satırı numarası seçilebilir. Boş satırlar atlanır.
- Okuma stream ile yapılır, tüm dosya belleğe alınmaz.
- **Aynı dosya uyarısı:** aynı `fileHash` son 30 günde bu mağazada işlendiyse yükleme yanıtında
  uyarı döner (engellemez).

**Otomatik eşleştirme**
- Önce dışa aktarma kataloğunun başlıklarıyla (TR ve EN) birebir eşleşme denenir. Sonra
  normalleştirilmiş eşleşme (küçük harf, Türkçe karakter sadeleştirme, boşluk/noktalama temizliği).
  En son eş anlamlılar sözlüğü kullanılır ("sipariş no", "order id", "siparis numarasi"…).
- Kayıtlı bir şablonun başlık seti dosyayla uyuşuyorsa o şablon otomatik önerilir.

**Değer ayrıştırma**
- Tarih: `dd.MM.yyyy`, `dd.MM.yyyy HH:mm`, `yyyy-MM-dd`, ISO 8601 ve Excel seri tarih sayısı.
  Belirsiz formatlarda (`03/04/2026`) kullanıcı gün/ay sırasını seçer. Saat dilimi ayardan alınır.
- Sayı/para: `1.234,56` ve `1,234.56`; kullanıcı ondalık ayırıcıyı seçer. Para birimi sembolleri
  ve boşluk temizlenir.
- Telefon: TR formatına normalleştirilir (`+90…`). Geçersizse uyarı verilir, hata değil.
- Boolean: evet/hayır, true/false, 1/0, var/yok.
- Metinler kırpılır; alan uzunluk limitleri uygulanır.

**Doğrulama (dry-run)** — sipariş grubu başına:
- Zorunlu alanlar: eşleşme anahtarı, sipariş tarihi, en az bir kalem, kalemde adet ve birim fiyat
  (CREATE için), teslimat adı ve adresi (CREATE için; durum gerektiriyorsa).
- Ürün eşleştirme: SKU → barkod → (opsiyonel) ad ile eşleşme. Bulunamazsa hata ya da
  "katalog dışı kalem olarak ekle" seçeneğine göre uyarı.
- Tutar tutarlılığı: kalem toplamı + kargo − indirim ≈ dosyadaki sipariş toplamı (tolerans 0,01).
  Fark varsa uyarı; ayara göre dosyadaki toplam ya da hesaplanan toplam kullanılır.
- Değer eşlemesi eksik olan durum/kargo/ödeme/kanal → hata.
- Mod kontrolü: `CREATE_ONLY`'de eşleşme bulunursa SKIP; `UPDATE_ONLY`'de bulunamazsa SKIP
  (ikisi de sayaca ve rapora yansır).
- Güncellemede **korunan alanlar**: faturası kesilmiş siparişin tutar ve kalemleri, iptal edilmiş
  siparişin durumu gibi kısıtlar domain servisinin kurallarından gelir. Bu kurallar dry-run'da da
  aynı şekilde kontrol edilir.
- Dosya içi çakışma: aynı eşleşme anahtarında çelişen sipariş seviyesi değerler → hata.
- Durum geçiş kuralları (Sipariş Durumları'nda tanımlı izinli geçişler) güncellemelerde uygulanır.
- Sonuçlar `OrderImportRowResult`'a yazılır; iş `VALIDATED` olur. Kullanıcı ayarları değiştirirse
  doğrulama yeniden çalışmak zorundadır.

**İşleme**
1. `start` yalnız `VALIDATED` durumda çalışır. İş BullMQ `order-import` kuyruğuna gider.
   Aynı mağazada aynı anda tek içe aktarma işlenir.
2. Yalnız `VALID` gruplar işlenir; `INVALID` olanlar atlanır ve raporda kalır.
   Kullanıcı isterse "tek hata varsa hiçbirini işleme" (all-or-nothing) seçeneğini açabilir.
3. Her sipariş grubu **kendi transaction'ında** mevcut domain servis metoduyla oluşturulur ya da
   güncellenir. Bir grubun hatası diğerlerini etkilemez. UPDATE'lerde değişen alanların önceki
   değerleri `beforeSnapshot`'a yazılır.
4. İşleme sırasında veri, doğrulamadan bu yana değişmiş olabilir. Bu yüzden grup işlenmeden hemen
   önce yeniden kontrol edilir; tutarsızsa `FAILED` + açıklama.
5. `progress` her 100 grupta güncellenir. Bitince `COMPLETED` ya da `COMPLETED_WITH_ERRORS` olur,
   uygulama içi bildirim gönderilir ve hata raporu dosyası üretilir.
6. İdempotency: iş iki kez başlatılamaz. İşleyici yeniden denerse `SUCCESS` olan grupları atlar.

**Geri alma (rollback)**
- `rollbackDeadline` = tamamlanmadan itibaren 24 saat. Yalnız `order_import.rollback` yetkisiyle yapılır.
- Oluşturulan siparişler: siparişe sonradan işlem yapılmadıysa (fatura, kargo, ödeme, manuel
  düzenleme yoksa) soft delete edilir. İşlem görmüş olanlar atlanır ve raporlanır.
- Güncellenen siparişler: alan, içe aktarmadan sonra başka biri tarafından değiştirilmediyse
  `beforeSnapshot`'a döndürülür. Değiştirildiyse atlanır ve raporlanır.
- Stok etkisi açıldıysa ters hareket yapılır. Geri alma da kuyrukta çalışır ve audit log'a yazılır.

**Güvenlik ve uyum**
- Yüklenen dosyalar özel depoda tutulur ve 30 gün sonra silinir. Hata raporu imzalı kısa ömürlü URL ile indirilir.
- Hata raporu dosyası da formül enjeksiyonuna karşı korunur (dışa aktarmadaki kural).
- Audit: yükleme, doğrulama, başlatma, geri alma, silme; ayrıca her oluşturulan/güncellenen sipariş
  için `source: IMPORT`, `importJobId` ile kayıt.
- Kişisel veri içeren dosya satırları loglara ham olarak yazılmaz.

---

## 4. Frontend (frontend-dev)

Klasör: mevcut sayfa yolu altında `page.tsx`, `hooks/useOrderImport.ts`, `hooks/useImportJobs.ts`,
`hooks/useImportMappings.ts`, `components/`. `'use client'`, yalnız `apiFetch`/`api.*`, yalnız `kp-*`
tokenlar, `@heroicons/react/24/outline`, tüm metinler `useTranslations` (TR + EN).
Mevcut başlık yapısını (ikon + başlık + açıklama) koru.

**Sekmeler:** **Yeni İçe Aktarma** · **Geçmiş** · **Eşleştirme Şablonları**

**Yeni İçe Aktarma — adım adım sihirbaz** (üstte adım göstergesi; geri dönülebilir):

1. **Dosya:** sürükle-bırak alanı (CSV, XLSX). Yanında "Örnek dosya indir" (sipariş başına /
   kalem başına) ve kısa kurallar gösterilir. Yüklemede ilerleme görünür. Aynı dosya uyarısı burada çıkar.
2. **Ayarlar:** algılanan kodlama, ayırıcı, başlık satırı, sayfa. Canlı önizleme tablosu (ilk 10 satır);
   Türkçe karakter bozuksa kodlama değiştirilir. İçe aktarma modu, eşleşme anahtarı, satış kanalı,
   tarih formatı/saat dilimi, ondalık ayırıcı. Şablon seçici ("Kayıtlı şablonu uygula").
3. **Kolon eşleştirme:** solda dosya başlıkları ve örnek değerler, sağda sistem alanı seçici
   (gruplu, aranabilir, "Yoksay" seçeneği). Otomatik eşleşenler işaretli gelir. Eksik zorunlu alanlar
   üstte `kp-danger` uyarısıyla listelenir. Aynı alana iki kolon eşlenemez.
4. **Değer eşleştirme:** yalnız eşleşmeyen değer varsa gösterilir. Her alan için tablo:
   dosya değeri, kaç satırda geçtiği, sistem karşılığı seçici (öneri ön seçili). Ürünlerde bulunamayan
   SKU'lar için "katalog dışı kalem olarak ekle" ya da "hata say" seçimi.
5. **Yan etkiler:** stok, müşteri bildirimi, otomasyon, pazaryeri senkronu anahtarları
   (varsayılan kapalı, her birinin altında ne olacağını anlatan kısa açıklama). All-or-nothing seçeneği.
6. **Ön kontrol:** "Kontrol et" → ilerleme. Sonuç özeti kartları: oluşturulacak, güncellenecek,
   atlanacak, hatalı. Hatalı/uyarılı satırlar tablosu: satır no, sipariş, kolon, hata mesajı
   (anlaşılır Türkçe; ör. "12. satır · Tarih: '31.02.2026' geçerli bir tarih değil").
   "Hata raporunu indir" (düzeltip yeniden yüklemek için). UPDATE satırlarında önce/sonra farkı görünür.
7. **Onay ve işleme:** "N siparişi içe aktar" butonu ve özet onay modalı. Ardından ilerleme kartı
   (polling, 2 sn; sekme görünmüyorsa durur). Bitince sonuç özeti, "Siparişleri görüntüle"
   (Sipariş Listesi'ne `importJobId` filtresiyle link), "Hata raporu", "Şablon olarak kaydet"
   ve süre dolana kadar "Geri al".

Kaydedilmemiş sihirbazdan çıkışta onay istenir. Kullanıcı sayfadan ayrılırsa iş Geçmiş'te devam eder
ve kaldığı adımdan açılabilir.

**Geçmiş sekmesi**
- Sayfalı tablo: tarih, yükleyen, dosya adı, mod, oluşturulan/güncellenen/atlanan/hatalı sayıları,
  durum rozeti (`kp-success|warning|danger|info`), geri alma süresi.
- Satır aksiyonları: detay (sihirbazın sonuç ekranı), hata raporu, geri al, sil.

**Eşleştirme Şablonları sekmesi**
- Liste + düzenleme: ad, mod, kolon eşleştirmesi, değer eşlemeleri, varsayılanlar, paylaşım.

Sipariş Listesi'ne `importJobId` filtresi ve sipariş detayına "Kaynak: İçe aktarma (#…)" bilgisi
eklenebiliyorsa ekle.

---

## 5. Örnek dosya ve kolon seti

- Örnek dosya dışa aktarma kataloğundan üretilir; iki varyantı var (sipariş başına / kalem başına).
- Minimum kolonlar: sipariş no (veya dış sipariş no), sipariş tarihi, müşteri adı, telefon, e-posta,
  teslimat adresi/il/ilçe/posta kodu, SKU veya barkod, ürün adı, adet, birim fiyat, KDV oranı,
  kargo ücreti, indirim, toplam, para birimi, ödeme yöntemi, durum, kargo firması, takip no, fatura no, not.
- Açıklama sayfası: her kolonun anlamı, zorunluluğu, kabul edilen formatları ve örnek değerleri.
- `UPDATE_ONLY` ile toplu güncelleme örneği: yalnız "sipariş no + durum + kargo firması + takip no"
  kolonlarından oluşan dosya da geçerli olmalı.

---

## 6. Test (test-qa)

- Birim: kodlama algılama (UTF-8, UTF-8 BOM, Windows-1254), ayırıcı algılama, tüm tarih/sayı/telefon
  ayrıştırıcıları (Excel seri tarih dahil), otomatik eşleştirme (TR/EN başlık, Türkçe karakter
  sadeleştirme), satır gruplama ve çelişki tespiti, tutar tutarlılığı, mod kuralları.
- **Gidiş-dönüş testi:** Dışa Aktar ile üretilen dosya (her iki satır modu, CSV ve XLSX) değiştirilmeden
  `UPDATE_ONLY` ile içe aktarıldığında sıfır hata ve sıfır değişiklik vermeli.
- Dry-run'ın **hiçbir şey yazmadığını** doğrula (DB diff).
- İşleme: grup başına transaction (bir grubun hatası diğerlerini bozmaz), all-or-nothing modu,
  doğrulama sonrası veri değiştiğinde yeniden kontrol, iş iki kez başlatılamaz, retry'da tekrar oluşturma yok.
- Yan etkiler: kapalıyken bildirim/otomasyon/stok/pazaryeri tetiklenmiyor; açıkken tetikleniyor.
- Geri alma: işlem görmemiş siparişler geri alınıyor, işlem görmüşler atlanıyor; güncellemeler snapshot'a
  dönüyor; sonradan başkasının değiştirdiği alan ezilmiyor; 24 saat sonra 403/409.
- 50.000 satırlık dosya: bellek sabit (stream), ilerleme artıyor, zaman aşımı yok.
- **Tenant izolasyonu:** B mağazasının siparişi A'nın içe aktarmasıyla eşleşip güncellenemez; işler,
  dosyalar ve şablonlar tenant dışından 404.
- Yetki: `update_existing` olmadan UPDATE/UPSERT 403; `rollback` olmadan geri alma 403.
- Frontend: sihirbaz adım geçişleri, eşleştirme doğrulaması, ön kontrol sonuç tablosu, ilerleme kartı.

---

## 7. Kabul kriterleri

- [ ] Sayfadaki "servis ucu yok" boş durumu gitti; üç sekme ve sihirbaz çalışıyor.
- [ ] Örnek dosya indirilip doldurulduğunda eşleştirme otomatik yapılıyor ve siparişler oluşuyor.
- [ ] Türkçe Excel'den kaydedilmiş (Windows-1254, `;` ayırıcılı, `1.234,56` tutarlı, `dd.MM.yyyy`
      tarihli) CSV hatasız içe aktarılıyor.
- [ ] "Sipariş no + takip no + kargo firması" dosyasıyla 1.000 siparişin takip bilgisi toplu güncelleniyor.
- [ ] Hatalı satırlar anlaşılır mesajlarla gösteriliyor; hata raporu indirilip düzeltilerek yeniden yüklenebiliyor.
- [ ] Varsayılan ayarlarla içe aktarma stok, müşteri bildirimi, otomasyon ve pazaryeri senkronunu tetiklemiyor.
- [ ] Tamamlanan içe aktarma 24 saat içinde geri alınabiliyor; kurallar raporlanıyor.
- [ ] Eşleştirme şablonu kaydedilip sonraki yüklemede otomatik öneriliyor.
- [ ] Tüm işlemler audit log'da; oluşan siparişler `importJobId` ile izlenebiliyor.
- [ ] Tüm metinler TR/EN, yalnız `kp-*` token, ham `fetch` yok, Swagger dokümante.
- [ ] `pnpm lint && pnpm format && pnpm test` yeşil.

## 8. Teslim

Branch: `feature/order-import`. Conventional Commits ile katman başına commit
(db → dosya okuma + ayrıştırıcılar → eşleştirme + doğrulama → processor + rollback → endpoint'ler →
frontend → test). PR açıklamasında şunlar yer alsın: keşif kararları (kullanılan domain servisleri,
ortaklaştırılan kolon kataloğu, event bastırma mekanizması), desteklenmeyen alanlar/formatlar,
kapsam dışı bırakılanlar ve sonraki adımlar (ör. Google Sheets / FTP'den zamanlanmış içe aktarma,
ürün ve müşteri içe aktarmayla ortak altyapı, pazaryeri dosya formatları için hazır şablonlar).