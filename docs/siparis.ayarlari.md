# Görev: "Sipariş Ayarları" sayfasını ve ayar altyapısını uçtan uca hayata geçir

KroptOS'ta **Siparişler → Sipariş Ayarları** sayfasının arkasına gerçek bir ayar sistemi kur. Bu sayfa
yalnız bir form değil; sipariş yaşam döngüsündeki tüm modüllerin (sipariş, ödeme, stok, kargo, fatura,
iade, bildirim, otomasyon, dışa/içe aktarma) **okuduğu tek doğruluk kaynağı** olacak. Kodda dağınık
duran sabitler (varsayılan kargo, iade süresi, saklama süreleri, sipariş no formatı vb.) buraya taşınacak.

**Önce `kroptos-konvansiyonlari` skill'ini oku ve harfiyen uy.** Kanonik örnekler: backend
`src/modules/product/`, frontend `products` sayfası. Ekip sırası:
`proje-yoneticisi → db-prisma → backend-dev → entegrasyon-dev → frontend-dev → test-qa → code-reviewer`.

**İlişkili işler:** Bildirim Şablonları, Otomasyon, Dışa Aktar ve İçe Aktar promptlarında
"mağaza ayarından gelir" denen tüm değerler (log saklama süreleri, dosya geçerlilik süreleri, geri alma
süresi, varsayılan saat dilimi vb.) bu sistemden okunacak. O modüller önceden yapıldıysa sabitlerini
bu servise bağla; yapılmadıysa anahtarları şimdiden tanımla.

---

## 0. Keşif (kod yazmadan önce)

1. Sayfanın mevcut dosyasını, sidebar kaydını ve i18n anahtarlarını bul; boş durum placeholder'ı kaldırılacak.
2. **Sistem → Sistem Ayarları** sayfası ve backend'de mevcut bir ayar modeli/servisi var mı
   (`Setting`, `StoreSettings`, `config` tablosu, Json kolonu)? Varsa onu genişlet; paralel ikinci
   bir ayar sistemi kurma. Yoksa bu işte kurulan altyapı genel amaçlı olsun, sipariş ayarları onun
   ilk ad alanı (`order.*`) olsun.
3. Kod tabanında sipariş davranışını belirleyen **sabitleri** tara: `const DEFAULT_…`, `.env`
   değerleri, servis içinde hard-coded gün/saat/tutar/limitler, sipariş numarası üretimi, stok
   rezervasyon zamanı, iade süresi, kapıda ödeme limitleri. Liste çıkar; her biri için ayara taşınıp
   taşınmayacağını plana yaz (altyapı gereği `.env`'de kalması gerekenler kalır).
4. Sipariş Durumları, kargo (taşıyıcılar, desi), fatura (e-Arşiv/e-Fatura entegrasyonu varsa), iade,
   ödeme yöntemleri ve depo modüllerinde ayarların bağlanacağı noktaları belirle.
5. Üst bardaki Dağıtıcı Firma / Marka seçicisinin diğer sayfalarda nasıl ele alındığını incele
   (bkz. §1 miras modeli).

Keşif sonunda kısa plan yaz; belirsiz kararlarda varsayımını belirt ve devam et.

---

## 1. Mimari: tipli ayar kaydı + miras

```
Sistem varsayılanı (kodda)  →  Dağıtıcı firma  →  Marka  →  Mağaza      (en özel olan kazanır)
```

- **Ayar kaydı (registry), kodda tanımlanır:** her ayar için `key` (ör. `order.returns.windowDays`),
  `type` (boolean, int, decimal, money, enum, string, duration, time, json), `default`, doğrulama
  kuralları (min/max, enum değerleri, regex, ilişkili kayıt referansı), `section`, `labelKey`,
  `descriptionKey`, `scopes` (hangi seviyelerde değiştirilebilir), `permission`, `sensitive`,
  `dependsOn` (başka bir ayar açıkken anlamlı), `sinceVersion`.
  Veritabanında yalnız **override değerler** tutulur; tanım her zaman koddan gelir.
- **Çözümleme:** `OrderSettingsService.get(storeId)` tüm ayarların efektif değerlerini ve her birinin
  kaynağını (`SYSTEM | AGENCY | CLIENT | STORE`) döndürür. Tipli bir obje döner
  (`settings.returns.windowDays: number`); modüller string key ile değil bu tiple çalışır.
- **Kilitleme:** üst seviye bir ayarı `locked` işaretleyebilir. Alt seviyeler kilitli ayarı
  değiştiremez (ör. dağıtıcı firma tüm markalarda KDV davranışını sabitler).
- **Önbellek:** efektif ayarlar mağaza başına Redis'te önbelleğe alınır. Herhangi bir seviyede
  değişiklik olduğunda etkilenen tüm mağazaların önbelleği temizlenir. Önbellek yoksa DB'den
  okunur; ayar okuma asla isteği düşürmez.
- **Zamanlı etki:** ayar değişikliği geriye dönük değil, değişiklik anından sonraki işlemlere uygulanır.
  Sipariş oluşturulurken kritik ayarların (iade süresi, KDV dahil fiyat, kapıda ödeme ücreti)
  **anlık kopyası** siparişe yazılır; sonradan ayar değişse de o siparişin davranışı değişmez.

---

## 2. Ayar bölümleri ve anahtarlar (başlangıç seti)

Keşifte bulunan sabitlerle bu listeyi birleştir; mevcut sistemde karşılığı olmayan ayarı ekleme,
yalnız plana "sonraki adım" olarak yaz.

**2.1 Genel**
- `order.general.timezone` (varsayılan mağaza/firma saat dilimi), `order.general.currency`,
  `order.general.pricesIncludeTax` (fiyatlar KDV dahil mi), `order.general.defaultLocale`.
- `order.general.minOrderAmount`, `order.general.maxItemsPerOrder`.

**2.2 Sipariş numaralandırma**
- `order.numbering.prefix`, `order.numbering.suffix`, `order.numbering.padding`,
  `order.numbering.pattern` (ör. `{PREFIX}-{YYYY}{MM}-{SEQ}`), `order.numbering.resetPeriod`
  (`NEVER | YEARLY | MONTHLY`), `order.numbering.nextSequence` (yalnız artırılabilir, azaltılamaz).
- Pazaryeri siparişleri için ayrı seri kullanılsın mı (`order.numbering.separateMarketplaceSeries`).
- Numara üretimi eşzamanlılığa dayanıklı olmalı (DB sequence veya satır kilidi), çakışma yok.
  Önizleme: "Sıradaki sipariş numarası: `KP-202609-00125`".

**2.3 Sipariş akışı ve durumlar**
- `order.flow.initialStatusId` (yeni siparişin durumu), kanal bazlı override (web / pazaryeri / manuel / içe aktarma).
- `order.flow.autoConfirm` (ödeme alınınca otomatik onay), `order.flow.autoConfirmDelayMinutes`.
- `order.flow.autoCompleteAfterDeliveredDays` (teslimden X gün sonra *Tamamlandı*).
- `order.flow.unpaidCancelAfterHours` (ödenmemiş siparişi otomatik iptal; havale/EFT için ayrı süre).
- `order.flow.editableUntilStatusId` (hangi duruma kadar sipariş düzenlenebilir).
- `order.flow.cancellableUntilStatusId`, `order.flow.requireCancelReason`,
  `order.flow.cancelReasons` (liste).
- Durum referansları Sipariş Durumları kayıtlarına bağlıdır; referans verilen durum silinmek
  istenirse engellenir ya da ayar varsayılana döner ve uyarı verilir.

**2.4 Stok**
- `order.stock.reserveOn` (`ORDER_CREATED | PAYMENT_RECEIVED | CONFIRMED`),
  `order.stock.deductOn` (`CONFIRMED | SHIPPED`), `order.stock.releaseOnCancel`,
  `order.stock.allowBackorder`, `order.stock.reservationTimeoutMinutes` (ödenmemiş rezervasyonun bırakılması),
  `order.stock.defaultWarehouseId`, `order.stock.warehouseSelection` (`DEFAULT | NEAREST | PRIORITY_LIST`).

**2.5 Ödeme**
- `order.payment.enabledMethods` (mevcut ödeme yöntemlerinden seçim).
- Kapıda ödeme: `order.cod.enabled`, `order.cod.fee`, `order.cod.feeType` (`FIXED | PERCENT`),
  `order.cod.minAmount`, `order.cod.maxAmount`, `order.cod.cashOnly | cardAllowed`,
  `order.cod.excludedCities`, `order.cod.requireConfirmationAbove` (tutar üstünde teyit).
- Havale/EFT: `order.transfer.discountPercent`, `order.transfer.paymentWindowHours`.

**2.6 Kargo ve teslimat**
- `order.shipping.defaultCarrierId`, `order.shipping.freeShippingThreshold`,
  `order.shipping.defaultDesi` (ürün desisi yoksa), `order.shipping.desiCalculation`
  (`MAX_OF_WEIGHT_VOLUME | WEIGHT | VOLUME`), `order.shipping.volumetricDivisor` (ör. 3000),
  `order.shipping.handlingTimeDays` (hazırlık süresi), `order.shipping.cutoffTime` (aynı gün kargo
  için son saat), `order.shipping.workingDays`, `order.shipping.holidayCalendar`,
  `order.shipping.autoCreateShipmentOn` (durum), `order.shipping.labelFormat` (A4 / 10x10 termal).
- Kargo modülünün (kargo entegrasyon skill'i) taşıyıcı seçim kurallarıyla çakışmamalı: bu ayarlar
  varsayılandır; taşıyıcı kuralları ve otomasyon onları geçersiz kılabilir. Öncelik sırası dokümante edilsin.

**2.7 Fatura**
- `order.invoice.autoCreateOn` (`NEVER | PAYMENT_RECEIVED | CONFIRMED | SHIPPED`),
  `order.invoice.provider` (projede tanımlı e-Arşiv/e-Fatura entegratörlerinden),
  `order.invoice.series`, `order.invoice.defaultTaxRate`, `order.invoice.includeShippingAsLine`,
  `order.invoice.sendToCustomer`, `order.invoice.individualTaxIdPlaceholder`
  (bireysel müşteride TCKN yoksa kullanılacak değer — mevzuata uygun varsayılan, doğrulamayla).

**2.8 İade ve değişim**
- `order.returns.enabled`, `order.returns.windowDays` (varsayılan 14; mesafeli satış mevzuatına
  göre alt sınır doğrulaması), `order.returns.windowStartsFrom` (`DELIVERED | SHIPPED`),
  `order.returns.reasons` (liste), `order.returns.requireApproval`,
  `order.returns.shippingPaidBy` (`CUSTOMER | STORE | BY_REASON`), `order.returns.defaultReturnCarrierId`,
  `order.returns.refundMethod` (`ORIGINAL | STORE_CREDIT | CHOICE`),
  `order.returns.autoRefundOnReceived`, `order.returns.nonReturnableCategoryIds`,
  `order.exchange.enabled`.

**2.9 Risk ve doğrulama**
- `order.risk.requirePhoneVerificationAbove`, `order.risk.maxOrdersPerCustomerPerDay`,
  `order.risk.blockedPhones`, `order.risk.blockedEmails`, `order.risk.holdIfBillingShippingDiffer`,
  `order.risk.holdNewCustomerCodAbove`. (Karmaşık kurallar Otomasyon'un işi; burada yalnız basit eşikler.)

**2.10 Müşteri ve alanlar**
- `order.checkout.requiredFields` (vergi no, TCKN, posta kodu, şirket adı…),
  `order.checkout.allowGuest`, `order.checkout.orderNoteEnabled`, `order.checkout.giftNoteEnabled`,
  `order.checkout.phoneFormat`.

**2.11 Veri saklama ve modül varsayılanları**
- `order.retention.notificationLogDays` (180), `order.retention.automationRunDays` (90),
  `order.retention.exportFileDays` (7), `order.retention.importFileDays` (30),
  `order.import.rollbackHours` (24), `order.export.maxRangeMonths` (12),
  `order.export.defaultDelimiter` (`;`), `order.notifications.defaultSenderName`,
  `order.notifications.quietHours` (SMS gönderilmeyecek saatler).

Her ayar için hassas olanlar (`sensitive`) ayrı yetki ister (ör. numaralandırma, fatura, veri saklama).

---

## 3. Veritabanı (db-prisma)

Mevcut ayar modeli varsa genişlet. Yoksa:

**SettingValue**
- `namespace` (`order`), `key`, `scopeLevel` (`AGENCY | CLIENT | STORE`), `agencyId`, `clientId?`,
  `storeId?`, `value` (Json), `locked` (bool), `updatedById`, zorunlu zaman alanları, `deletedAt?`.
- `@@unique([agencyId, clientId, storeId, namespace, key])` (null davranışını Postgres'te doğru
  ele al: gerekirse kısmi unique index veya `scopeKey` hesaplanmış kolon).
- İndeksler: `[agencyId]`, `[storeId]`, `[namespace, key]`.

**SettingChangeLog**
- `settingValueId?`, `namespace`, `key`, `scopeLevel`, tenant alanları, `oldValue`, `newValue`,
  `changedById`, `reason?`, `changeSetId` (tek kaydetmede değişen ayarları gruplar).
  (Genel audit log'a ek olarak, ayar geçmişi ekranı için.)

**OrderNumberSequence** — `storeId` (veya seri kapsamı), `series`, `period` (ör. `2026-09`),
`current` (int). Numara üretimi bu tablo üzerinden satır kilidiyle.

Siparişe ayar anlık kopyası için `settingsSnapshot` (Json) alanı: yalnız §1'de belirtilen kritik
anahtarlar (iade süresi ve başlangıcı, KDV dahil fiyat, kapıda ödeme ücreti, para birimi, saat dilimi).

Migration: `git pull` → `pnpm db:migrate`, elle düzenleme yok. Mevcut sabitlerin değerleri
sistem varsayılanı olarak registry'ye yazılır; davranış değişikliği olmamalı.

---

## 4. Backend (backend-dev)

Modül: `src/modules/settings/` (genel altyapı: registry, resolver, cache, repository) ve
`src/modules/order-settings/` (sipariş ayar tanımları, tipli servis, controller).
Guard zinciri, `@RequirePermission`, Swagger, üç `@ApiHeader`, tenant filtresi, soft delete ve audit
log — istisnasız.

**Yetkiler:** `order_settings.read`, `order_settings.update`, `order_settings.update_sensitive`,
`order_settings.lock` (yalnız firma/marka seviyesi rolleri). Rol seed'lerine ekle.

**Endpoint'ler:**

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/order-settings/schema` | Registry: bölümler, alanlar, tipler, doğrulama kuralları, bağımlılıklar, kullanıcının yetkisine göre düzenlenebilirlik |
| GET | `/order-settings?scope=` | Seçili kapsamdaki efektif değerler + kaynak seviyesi + kilit durumu + üst seviyenin değeri |
| PATCH | `/order-settings` | Toplu güncelleme `{ changes: [{ key, value }], reason? }`. Tek transaction, tek `changeSetId`. Tümü doğrulanmadan hiçbiri yazılmaz |
| POST | `/order-settings/reset` | Seçili anahtarların override'ını kaldır (üst seviyeden miras al) |
| PATCH | `/order-settings/locks` | Anahtarları alt seviyeler için kilitle/aç |
| GET | `/order-settings/history` | Değişiklik geçmişi (sayfalı; filtre: anahtar, kullanıcı, tarih) |
| POST | `/order-settings/history/:changeSetId/revert` | Bir değişiklik setini geri al |
| POST | `/order-settings/impact` | Önerilen değişikliklerin etki analizi (bkz. aşağı) |
| GET | `/order-settings/preview/order-number` | Mevcut numaralandırma ayarlarıyla sıradaki numara |
| GET | `/order-settings/export` · POST `/order-settings/import` | Ayarları JSON olarak dışa/içe aktar (mağazalar arası kopyalama; hassas anahtarlar hariç) |
| POST | `/order-settings/copy` | Bir mağazanın ayarlarını aynı firma/markadaki başka mağazalara kopyala |

**Doğrulama**
- Tip, aralık, enum ve regex kontrolleri registry'den; ilişkili kayıt referansları (durum, taşıyıcı,
  depo, ödeme yöntemi, kategori) tenant içinde var ve aktif mi kontrol edilir.
- Çapraz kurallar: `cod.minAmount ≤ cod.maxAmount`; `stock.deductOn` akışta `reserveOn`'dan önce
  olamaz; `editableUntil` durumu `cancellableUntil`'den sonra olamaz; `autoCreateShipmentOn`
  durumu akışta mevcut olmalı; iade süresi mevzuat alt sınırının altında olamaz (uyarı değil hata).
- Kilitli ayara alt seviyeden yazma → 403 ve hangi seviyenin kilitlediği bilgisi.
- Hata yanıtı alan bazlı: `{ key, code, message }[]` (422).

**Etki analizi (`/impact`)**
Riskli değişiklikler kaydedilmeden önce kullanıcıya ne olacağını söyler:
- Numaralandırma: yeni format örneği ve çakışma riski olmadığı.
- Stok zamanlaması: şu an açık X siparişin rezervasyon durumu ve geçişin nasıl yapılacağı
  (mevcut siparişler eski kuralla tamamlanır).
- Otomatik iptal süresi kısaltılırsa: bir sonraki taramada iptal edilecek sipariş sayısı.
- Kapıda ödeme devre dışı bırakılırsa: bekleyen kapıda ödemeli sipariş sayısı (etkilenmez, bilgi).
- Veri saklama kısaltılırsa: silinecek log/dosya sayısı.

**Tüketim (entegrasyon-dev ile)**
- Keşifte bulunan sabitleri kullanan her yeri `OrderSettingsService`'e bağla. Sipariş oluşturma,
  ödeme, stok, kargo, fatura, iade ve zamanlanmış işler (otomatik iptal, otomatik tamamlama,
  rezervasyon zaman aşımı, saklama temizliği) ayarları buradan okur.
- Zaman bazlı işler (otomatik iptal/tamamlama/rezervasyon bırakma) BullMQ repeatable job olarak
  çalışır; yoksa bu işte eklenir. Her iş mağaza bazında ayarı okur, indeksli ve sayfalı tarar,
  idempotenttir ve audit'e sistem aktörüyle yazar.
- Ayar değişikliği domain event'i yayınlar (`order_settings.changed`, değişen anahtarlarla);
  önbellek ve ilgili modüller buna tepki verir.

---

## 5. Frontend (frontend-dev)

Klasör: mevcut sayfa yolu altında `page.tsx`, `hooks/useOrderSettings.ts`,
`hooks/useOrderSettingsHistory.ts`, `components/` (alan tipine göre yeniden kullanılabilir
`SettingField` bileşenleri). `'use client'`, yalnız `apiFetch`/`api.*`, yalnız `kp-*` tokenlar,
`@heroicons/react/24/outline`, tüm metinler `useTranslations` (TR + EN).
Mevcut başlık yapısını (ikon + başlık + açıklama) koru.

**Düzen**
- Solda bölüm navigasyonu (Genel, Numaralandırma, Akış ve Durumlar, Stok, Ödeme, Kargo, Fatura,
  İade, Risk, Müşteri Alanları, Veri Saklama) + üstte ayar arama ("iade" yazınca ilgili alanlar).
  Sağda bölümün formu. Mobilde bölüm seçici üstte açılır menü.
- Form **şemadan üretilir** (`/schema`); her alan tipine uygun bileşen: toggle, sayı, para (para birimli),
  süre (gün/saat seçimli), saat, enum select, ilişkili kayıt seçici (durum/taşıyıcı/depo/kategori),
  etiket listesi (nedenler, engelli telefonlar), il çoklu seçimi.
- `dependsOn` olan alanlar bağlı ayar kapalıyken gizlenir veya pasiflenir.

**Miras göstergeleri**
- Her alanın yanında kaynak rozeti: *Sistem varsayılanı*, *Firmadan*, *Markadan*, *Bu mağazada özel*.
- Miras alınan değer soluk gösterilir; "Özelleştir" ile düzenlenebilir hale gelir. Özel değerlerde
  "Varsayılana dön" (üst seviyenin değerini tooltip'te göster).
- Kilitli alanlar kilit ikonu ve "X seviyesinde kilitlendi" açıklamasıyla salt-okunur.
- Firma/marka seviyesinde düzenleyen kullanıcı için alan menüsünde "Alt seviyeler için kilitle".
- Üst bardaki seçim hangi seviyenin düzenlendiğini belirler; sayfanın üstünde bu açıkça yazılır
  ("KroptOS Agency firma varsayılanlarını düzenliyorsunuz — 12 marka etkilenir").

**Kaydetme**
- Değişiklikler yerel tutulur; üstte/altta yapışkan çubuk: "N değişiklik · Vazgeç · Kaydet".
  Değişen alanlar vurgulanır. Bölüm değiştirmek değişiklikleri kaybettirmez; sayfadan çıkışta onay.
- Kaydet → riskli anahtar varsa önce `/impact` → etki özeti modalı (+ opsiyonel "değişiklik nedeni"
  alanı) → onay → `PATCH`. Hatalar ilgili alanların altında gösterilir ve ilgili bölüme atlanır.
- Numaralandırma bölümünde canlı önizleme ("Sıradaki: KP-202609-00125").

**Ek görünümler**
- **Geçmiş** (sağ üstte buton → drawer): değişiklik setleri; kim, ne zaman, neden, eski → yeni;
  set bazında "Geri al".
- **Ayarları kopyala / JSON dışa-içe aktar** (yetkiye bağlı): hedef mağaza seçimi ve fark önizlemesi.
- Yükleniyor, hata ve yetkisiz (salt-okunur mod) durumları tasarlanır.

---

## 6. Test (test-qa)

- Birim: registry doğrulamaları (her tip), çapraz kurallar, miras çözümleme (4 seviye, kilit dahil),
  önbellek invalidation (firma değişince tüm alt mağazalar), numara üretimi (pattern, padding,
  dönem sıfırlama, pazaryeri serisi).
- **Eşzamanlılık:** 100 paralel sipariş oluşturmada numara çakışması yok, boşluk yok (veya boşluk
  politikası dokümante).
- **Davranış korunumu:** migration sonrası, hiçbir override yokken sistemin davranışı eskisiyle aynı
  (mevcut sipariş akışı testleri değişmeden geçer).
- Tüketim: stok rezervasyon/düşme zamanları, kapıda ödeme limit ve ücreti, ücretsiz kargo eşiği,
  otomatik fatura, iade süresi (sipariş anlık kopyasına göre; ayar sonradan değişse de eski sipariş
  eski süreyle), otomatik iptal/tamamlama job'ları.
- Etki analizi sayılarının doğruluğu; toplu kaydetmede bir hata varsa hiçbir değişikliğin yazılmaması;
  değişiklik setinin geri alınması.
- **Tenant izolasyonu:** A mağazasının ayarı B'yi etkilemez; kopyalama yalnız aynı firma içinde,
  başka tenant hedefi 404.
- Yetki: hassas ayar yetkisiz 403; kilitli ayar alt seviyeden 403; salt-okunur kullanıcıya form pasif.
- Frontend: şemadan form üretimi, miras rozetleri, özelleştir/varsayılana dön, kirli durum çubuğu,
  etki modalı, alan bazlı hata gösterimi.

---

## 7. Kabul kriterleri

- [ ] Sipariş Ayarları sayfası tüm bölümlerle çalışıyor; boş durum placeholder'ı yok.
- [ ] Kod tabanındaki sipariş sabitleri ayar servisine taşındı; override yokken davranış değişmedi.
- [ ] Firma seviyesinde iade süresi 30 gün yapılınca tüm markalarda miras rozetiyle görünüyor;
      bir markada 14'e çekilince yalnız o marka etkileniyor; firma kilitlerse marka değiştiremiyor.
- [ ] Numaralandırma formatı değişince önizleme doğru, yeni siparişler yeni formatla ve çakışmasız numaralanıyor.
- [ ] Kapıda ödeme üst limiti ve ücreti sipariş oluşturmada uygulanıyor; siparişin anlık kopyasına yazılıyor.
- [ ] "Ödenmemiş siparişi 48 saatte iptal et" ayarı zamanlanmış işle uygulanıyor ve audit'te sistem aktörüyle görünüyor.
- [ ] Riskli değişiklikte etki analizi gösteriliyor; değişiklik geçmişi ve set bazında geri alma çalışıyor.
- [ ] Bildirim, Otomasyon, Dışa/İçe Aktar modüllerinin saklama ve varsayılan değerleri buradan okunuyor.
- [ ] Tüm metinler TR/EN, yalnız `kp-*` token, ham `fetch` yok, Swagger dokümante.
- [ ] `pnpm lint && pnpm format && pnpm test` yeşil.

## 8. Teslim

Branch: `feature/order-settings`. Conventional Commits ile katman başına commit
(db → settings altyapısı (registry/resolver/cache) → sipariş ayar tanımları → numara üretimi →
sabitlerin taşınması (modül başına ayrı commit) → zamanlanmış işler → endpoint'ler → frontend → test).
PR açıklamasında şunlar yer alsın: keşifte bulunan sabitlerin listesi ve her birinin nereye taşındığı,
`.env`'de bırakılanlar ve nedeni, öncelik sırası (ayar < taşıyıcı kuralı < otomasyon), kapsam dışı
bırakılanlar ve sonraki adımlar (ör. aynı altyapıyla Ürün/Stok/Sistem ayarları, ayar değişikliği
için onay akışı, ülke bazlı mevzuat ön ayarları).