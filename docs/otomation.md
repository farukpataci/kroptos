# Görev: "Sipariş Otomasyonu" sayfasını ve kural motorunu uçtan uca hayata geçir

KroptOS'ta **Siparişler → Otomasyon** sayfasının arkasına gerçek bir kural motoru kur. Kullanıcı
"**Şu olduğunda** → **şu koşullar sağlanıyorsa** → **şunları yap**" mantığıyla kural tanımlayabilmeli.
Sipariş olayları ve zaman bazlı tetikleyiciler kuralları çalıştırmalı. Her çalışma izlenebilir,
test edilebilir ve güvenli (döngüsüz, idempotent, tenant izole) olmalı.

**Önce `kroptos-konvansiyonlari` skill'ini oku ve harfiyen uy.** Kanonik örnekler: backend
`src/modules/product/`, frontend `products` sayfası. Ekip sırası:
`proje-yoneticisi → db-prisma → backend-dev → entegrasyon-dev → frontend-dev → test-qa → code-reviewer`.

**Bağımlılık:** "E-posta / SMS Şablonları" işi (`notification-template` / `notification` modülleri ve
domain event altyapısı) bu işten önce ya da birlikte yapılır. Otomasyon aynı domain event'lerini dinler
ve "bildirim gönder" aksiyonunda o şablonları kullanır. Event altyapısını ikinci kez kurma.

---

## 0. Keşif (kod yazmadan önce)

1. Otomasyon sayfasının mevcut dosyasını, sidebar kaydını ve i18n anahtarlarını bul.
2. Sipariş, sipariş durumu, kargo (shipment), fatura, iade, depo/WMS ve pazaryeri modüllerinde:
   - hangi alanlar koşul olarak kullanılabilir (kanal, tutar, ödeme tipi, il, SKU, etiket, desi…),
   - hangi işlemler servis metodu olarak zaten var (durum değiştir, kargo ata, fatura kes, depo ata…).
   Aksiyonlar **mevcut servis metotlarını çağırır**; iş mantığı otomasyon modülünde kopyalanmaz.
3. Domain event'leri nerede yayınlanıyor (EventEmitter / outbox / BullMQ)? Bildirim şablonları işinde
   kurulan yapı varsa onu kullan; eksik event'leri listele ve ilgili servise ekle.
4. Sipariş modelinde etiket (tag), not, öncelik, "beklet" (hold) alanları var mı? Yoksa
   hangi aksiyonların yeni alan gerektirdiğini plana yaz.
5. Üst bardaki Dağıtıcı Firma / Marka seçicilerinin diğer sayfalarda nasıl ele alındığını incele.

Keşif sonunda kısa plan yaz; belirsiz kararlarda varsayımını belirt ve devam et.

---

## 1. Kavramsal model

```
Kural = Tetikleyici + Koşul ağacı + Sıralı aksiyon listesi + Ayarlar
```

- **Tetikleyici (trigger):** olay bazlı (`ORDER_CREATED`, `ORDER_STATUS_CHANGED`, `PAYMENT_RECEIVED`,
  `SHIPMENT_CREATED`, `SHIPMENT_DELIVERED`, `SHIPMENT_EXCEPTION`, `RETURN_REQUESTED`,
  `ORDER_CANCELLED`, `STOCK_INSUFFICIENT`) veya **zaman bazlı** (`ORDER_IDLE`: "X saat boyunca
  Y durumunda kaldıysa", `SCHEDULED`: cron ile toplu tarama).
- **Koşul ağacı:** AND/OR grupları (en fazla 2 seviye iç içe). Her koşul `alan + operatör + değer`.
  - Alanlar (kataloğu backend'den gelir): sipariş kanalı/pazaryeri, marka, mağaza, toplam tutar,
    para birimi, ödeme yöntemi (kapıda ödeme dahil), ürün adedi, SKU/kategori içerir, toplam desi,
    teslimat ili/ilçesi, ülke, müşteri etiketi, ilk sipariş mi, sipariş etiketi, mevcut durum,
    kargo firması, notta şu kelime geçiyor, sipariş saati/günü.
  - Operatörler tipe göre: `eq, neq, gt, gte, lt, lte, between, in, not_in, contains,
    not_contains, is_empty, is_not_empty`.
- **Aksiyonlar (sıralı):**
  `SET_ORDER_STATUS`, `ADD_TAG`, `REMOVE_TAG`, `SET_PRIORITY`, `HOLD_ORDER` / `RELEASE_HOLD`,
  `ASSIGN_CARRIER` (kargo modülünün taşıyıcı seçimini çağırır), `ASSIGN_WAREHOUSE`,
  `CREATE_INVOICE`, `SEND_NOTIFICATION` (şablon + kanal seçimi; müşteriye veya dahili e-postaya),
  `ADD_ORDER_NOTE`, `ASSIGN_USER`, `CALL_WEBHOOK` (imzalı), `WAIT` (gecikme; sonraki aksiyonlar
  gecikmeli kuyruğa).
  Her aksiyon tipi bir **handler** sınıfıdır: `validateConfig`, `dryRun`, `execute`.
- **Ayarlar:** öncelik (sıra), `stopProcessing` (bu kural eşleşirse sonraki kurallar çalışmasın),
  `runOncePerOrder`, aktif/pasif, kapsam, çalışma saatleri (opsiyonel).

Kapsam modeli Bildirim Şablonları işiyle aynı olsun (mağaza / marka / firma). Kurallar miras
**almaz**, kapsamı eşleşen tüm aktif kurallar öncelik sırasıyla değerlendirilir. Mevcut projedeki
tenant kalıbı farklıysa ona uy ve gerekçeyi PR'a yaz.

---

## 2. Veritabanı (db-prisma)

Zorunlu alanlar her modelde (`id uuid`, `agencyId`, `clientId?`, `storeId`, `createdAt`, `updatedAt`,
`deletedAt?`, `@@index([agencyId])`, `@@index([storeId])`).

**AutomationRule**
- `name`, `description?`, `isActive`, `priority` (int), `scopeLevel`
- `triggerType` (enum), `triggerConfig` (Json: ör. `{ fromStatusId, toStatusId }`,
  `{ statusId, idleHours }`, `{ cron }`)
- `conditions` (Json, şema versiyonlu), `actions` (Json dizi, sıralı)
- `stopProcessing`, `runOncePerOrder`, `version`, `createdById`, `updatedById`
- `lastRunAt?`, `runCount`, `errorCount` (liste ekranı için özet)

**AutomationRuleVersion** — her kaydetmede önceki tanımın kopyası.

**AutomationRun** (bir kuralın bir sipariş için bir kez değerlendirilmesi)
- `ruleId`, `ruleVersion`, `orderId`, `triggerEvent`, `eventId` (idempotency anahtarı),
  `matched` (bool), `conditionTrace` (Json: hangi koşul true/false), `status`
  (`MATCHED_SUCCESS | PARTIAL_FAILURE | FAILED | NOT_MATCHED | SKIPPED_LOOP | SKIPPED_ONCE | DRY_RUN`),
  `depth` (zincir derinliği), `durationMs`, `isDryRun`
- `@@unique([ruleId, eventId])`, indeksler `[storeId, createdAt]`, `[orderId]`, `[ruleId, createdAt]`.

**AutomationActionRun** — `runId`, `index`, `actionType`, `status`, `input`, `output?`,
`errorMessage?`, `attempts`, `scheduledFor?` (WAIT sonrası).

Json alanları için backend'de zod/class-validator ile şema doğrulaması yap; ham Json'a güvenme.
Migration: `git pull` → `pnpm db:migrate`, elle düzenleme yok. Seed: pasif durumda gelen
**hazır tarifler** (bkz. §5).

---

## 3. Backend (backend-dev)

Modül: `src/modules/automation/`. Alt yapı:
`automation.controller.ts`, `automation.service.ts` (CRUD), `engine/rule-evaluator.ts`,
`engine/condition-registry.ts` (alan kataloğu + değer çözücüler), `actions/*.handler.ts`,
`automation.processor.ts` (BullMQ), `automation.scheduler.ts` (zaman bazlı tetikleyiciler), `dto/`.
Guard zinciri, `@RequirePermission`, Swagger, üç `@ApiHeader`, tenant filtresi, soft delete ve audit
log — istisnasız.

**Yetkiler:** `automation.read`, `.create`, `.update`, `.delete`, `.test`, `automation_run.read`,
`automation_run.retry`. Rol seed'lerine ekle. `CALL_WEBHOOK` ve `CREATE_INVOICE` içeren kural
kaydetmek ek yetki (`automation.sensitive_actions`) istesin.

**Endpoint'ler:**

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/automation-rules` | Liste; filtre: tetikleyici, aktiflik, arama. Özet sayaçlar dahil |
| GET | `/automation-rules/:id` | Detay |
| POST | `/automation-rules` | Oluştur (201). Varsayılan **pasif** |
| PATCH | `/automation-rules/:id` | Güncelle + versiyon kaydı |
| PATCH | `/automation-rules/:id/toggle` | Aktif/pasif |
| PATCH | `/automation-rules/reorder` | Öncelik sıralaması (id dizisi) |
| POST | `/automation-rules/:id/duplicate` | Kopyala |
| DELETE | `/automation-rules/:id` | Soft delete (204) |
| GET | `/automation-rules/:id/versions` · POST `.../versions/:vid/restore` | Geçmiş / geri yükle |
| GET | `/automation-rules/catalog` | Tetikleyiciler, alanlar (tip + olası değerler), operatörler, aksiyonlar ve config şemaları |
| POST | `/automation-rules/test` | Kural tanımı + `orderId` → **dry-run**: koşul izi + her aksiyonun yapacağı değişiklik. Hiçbir şey yazılmaz |
| POST | `/automation-rules/:id/backtest` | Son N gün / son N siparişte kaç siparişin eşleşeceği (salt okuma, sayfalı örnek) |
| POST | `/automation-rules/:id/run` | Seçili siparişlere elle çalıştır (kuyruk üzerinden, onaylı) |
| GET | `/automation-runs` | Çalışma günlüğü; filtre: kural, sipariş, durum, tarih |
| GET | `/automation-runs/:id` | Koşul izi + aksiyon adımları |
| POST | `/automation-runs/:id/retry` | Başarısız aksiyonları kaldığı yerden tekrar dene |

**Motor akışı**
1. Domain event gelir (`eventId`, `orderId`, `type`, `payload`, `causedByRunId?`, `depth`).
2. Dispatcher event'i **BullMQ** `automation` kuyruğuna atar; request içinde kural çalışmaz.
3. Processor: siparişin kapsamındaki aktif kuralları öncelik sırasıyla çeker. Sipariş verisi +
   ilişkiler **tek seferde** yüklenir (koşul başına sorgu yok).
4. Her kural için: tetikleyici config eşleşmesi → koşul değerlendirmesi → `conditionTrace` kaydı →
   eşleştiyse aksiyonlar sırayla çalışır. Bir aksiyon hata verirse o kuralın kalan aksiyonları
   durur, `PARTIAL_FAILURE`; diğer kurallar etkilenmez. `stopProcessing` eşleşmede sonraki kuralları keser.
5. Aksiyonlar **mevcut domain servislerini** çağırır ve bu servislerin tenant/izin/audit kurallarından
   geçer. Audit kaydında `userId` yerine sistem aktörü + `automationRuleId` bulunur.

**Güvenlik ve doğruluk**
- **Döngü koruması:** aksiyonun tetiklediği event `causedByRunId` ve `depth+1` taşır.
  `depth > 3` ise `SKIPPED_LOOP`. Bir kural, kendi aksiyonunun ürettiği event'le aynı sipariş için
  tekrar tetiklenmez.
- **Idempotency:** `@@unique([ruleId, eventId])`; tekrarlanan event ikinci kez çalışmaz.
  `runOncePerOrder` kuralları siparişte bir kez çalışır.
- **Eşzamanlılık:** aynı sipariş için işler sıralı işlensin (sipariş başına kilit veya job grubu).
- Aksiyon bazlı retry: 3 deneme, exponential backoff; yalnız geçici hatalarda.
- `CALL_WEBHOOK`: yalnız HTTPS, özel/iç ağ IP'leri engelli (SSRF), HMAC imza başlığı, 10 sn zaman
  aşımı, yanıt gövdesi kısaltılarak loglanır.
- `WAIT`: sonraki aksiyonlar `delay` ile kuyruğa; bekleme bitince koşullar isteğe bağlı olarak
  yeniden kontrol edilir (`recheckConditions`).
- Rate limit: mağaza başına dakikalık aksiyon sınırı; aşılırsa işler ertelenir, düşürülmez.
- Kaydetme doğrulaması: bilinmeyen alan/operatör, tip uyuşmazlığı, silinmiş durum/şablon/taşıyıcı
  referansı → 422 ve alan bazlı hata. Referans verilen şablon/durum sonradan silinirse kural
  "hatalı" işaretlenir ve pasife alınır, kullanıcıya bildirilir.

**Zaman bazlı tetikleyiciler**
`automation.scheduler.ts` repeatable job ile (ör. 15 dakikada bir) `ORDER_IDLE` kurallarını tarar:
"`statusId` durumunda `idleHours` saatten uzun kalmış, bu kural için daha önce çalışmamış siparişler".
Sorgu indeksli ve sayfalı olsun, büyük mağazalarda tek seferde binlerce sipariş yüklenmesin.

**Temizlik:** `AutomationRun` saklama süresi mağaza ayarından (varsayılan 90 gün), zamanlanmış job.

---

## 4. Frontend (frontend-dev)

Klasör: mevcut Otomasyon sayfa yolu altında `page.tsx`, `hooks/useAutomationRules.ts`,
`hooks/useAutomationRuns.ts`, `components/`. `'use client'`, yalnız `apiFetch`/`api.*`,
yalnız `kp-*` tokenlar, `@heroicons/react/24/outline`, tüm metinler `useTranslations` (TR + EN).
Mevcut başlık yapısını koru (ikon + başlık + açıklama); varsa boş durum placeholder'ını kaldır.

**Sekmeler:** **Kurallar** · **Çalışma Günlüğü** · **Hazır Tarifler**

**Kurallar sekmesi**
- Kart veya tablo listesi (komşu sayfalardaki kalıba uy): sürükle-bırak öncelik sırası, ad, tetikleyici
  özeti ("Durum *Onaylandı* olduğunda"), koşul/aksiyon sayısı, aktif toggle, son çalışma, 24 saatlik
  eşleşme/hata sayısı. Hatalı kurallar `kp-danger` rozetiyle.
- Satır menüsü: düzenle, kopyala, test et, geçmiş, sil.

**Kural düzenleyici (tam sayfa veya geniş drawer)** — yukarıdan aşağı okunan cümle gibi:
1. **Ne zaman?** Tetikleyici seçimi + config (durum geçişi için "şundan → şuna", idle için durum + saat).
2. **Eğer…** Koşul oluşturucu: AND/OR grupları, alan seçince operatör ve değer girişi tipe göre değişir
   (durum/pazaryeri/kargo için katalogdan select, tutar için sayı + para birimi, il için çoklu seçim,
   SKU için arama).
3. **O zaman…** Sıralı aksiyon listesi: ekle, sürükle-sırala, sil. Her aksiyon kendi config formu
   (ör. `SEND_NOTIFICATION` için şablon seçici + şablona gitme linki).
4. **Ayarlar:** öncelik, `stopProcessing`, siparişte bir kez, aktif.
- Üstte düz Türkçe özet cümlesi canlı güncellenir: "Trendyol siparişi *Onaylandı* olduğunda ve
  toplam desi 30'dan büyükse → kargo firmasını Aras yap, *büyük-paket* etiketi ekle."
- **Test paneli:** sipariş ara/seç → dry-run → her koşulun ✓/✗ sonucu ve aksiyonların yapacağı
  değişiklikler (önce/sonra). **Geriye dönük test:** "Son 30 günde bu kural 214 siparişte eşleşirdi" +
  örnek siparişler.
- Yeni kural kaydedilince pasif gelir; aktifleştirirken onay modalı ("Bundan sonraki siparişlere
  uygulanır; mevcut siparişlere uygulamak için Elle çalıştır'ı kullan").
- Doğrulama hataları alan bazlı; kaydedilmemiş değişiklikte çıkış onayı; versiyon geçmişi + fark + geri yükle.

**Çalışma Günlüğü sekmesi**
- Sayfalı tablo: zaman, kural, sipariş no (link), tetikleyici, sonuç rozeti, süre.
  Varsayılan filtre "eşleşenler"; "eşleşmeyenleri de göster" anahtarı.
- Satır detayı: koşul izi ağacı, aksiyon adımları (girdi/çıktı/hata), "Tekrar dene".

**Hazır Tarifler sekmesi**
- Kart ızgarası; "Kullan" → düzenleyici tarifle ön doldurulmuş ve pasif açılır.

Sipariş detay sayfasına "Otomasyon geçmişi" bölümü (o siparişte çalışan kurallar) eklenebiliyorsa ekle.

---

## 5. Hazır tarifler (seed, pasif)

- Kapıda ödemeli ve tutarı X TL üzeri → siparişi beklet + *teyit-gerekli* etiketi + dahili bildirim.
- Toplam desi > 30 → belirli kargo firmasına ata.
- Ödeme alındı → durumu *Onaylandı* yap + fatura kes.
- *Kargoya verildi* durumunda 72 saattir teslim edilmemiş → *gecikme* etiketi + müşteriye bilgi SMS'i.
- *Onaylandı* durumunda 24 saattir kargoya verilmemiş → sorumlu kullanıcıya dahili e-posta.
- Müşterinin ilk siparişi → *yeni-müşteri* etiketi + teşekkür e-postası.
- Belirli illere teslimat → belirli depoya ata.
- Kargo istisnası (adres bulunamadı vb.) → siparişi beklet + müşteriye adres teyit SMS'i.

---

## 6. Test (test-qa)

- Birim: her operatör × her alan tipi; AND/OR iç içe gruplar; tetikleyici config eşleşmesi;
  `stopProcessing`; öncelik sırası; her aksiyon handler'ının `validateConfig`/`dryRun`/`execute`'u.
- Motor: döngü koruması (A kuralı durumu değiştirir → B tetiklenir → A'yı tetikler → `SKIPPED_LOOP`),
  idempotency (aynı event iki kez), `runOncePerOrder`, aksiyon hatasında kısmi başarısızlık,
  `WAIT` sonrası gecikmeli çalışma, sipariş başına sıralı işleme.
- Dry-run ve backtest'in **hiçbir şey yazmadığını** doğrula (DB diff).
- Zaman bazlı tarama: doğru siparişler, tekrar çalışmama, sayfalama.
- Webhook: SSRF engeli, imza, zaman aşımı.
- **Tenant izolasyonu:** A mağazasının kuralı B'nin siparişine asla uygulanmaz; kural/log erişimi 404.
- Yetki: her endpoint yetkisiz rolde 403; hassas aksiyonlu kural ek yetkisiz kaydedilemez.
- Frontend: koşul oluşturucu tip değişimleri, özet cümlesi, test paneli akışı.

---

## 7. Kabul kriterleri

- [ ] Otomasyon sayfası gerçek veriyle çalışıyor; hazır tarifler listeleniyor ve kurala dönüştürülebiliyor.
- [ ] "Trendyol + desi > 30 → Aras'a ata + etiket ekle" kuralı kurulup gerçek bir siparişte dry-run'la
      doğrulanabiliyor, aktifleştirilince yeni siparişlerde kuyruk üzerinden bir kez uygulanıyor.
- [ ] `SEND_NOTIFICATION` aksiyonu Bildirim Şablonları sisteminden gönderiyor ve iki günlükte de görünüyor.
- [ ] Zaman bazlı "24 saattir kargoya verilmedi" kuralı doğru siparişleri yakalıyor, tekrar etmiyor.
- [ ] Birbirini tetikleyen iki kural sonsuz döngüye girmiyor.
- [ ] Çalışma günlüğünde koşul izi ve aksiyon adımları görülüyor; başarısız aksiyon tekrar denenebiliyor.
- [ ] Tüm metinler TR/EN, yalnız `kp-*` token, ham `fetch` yok, Swagger dokümante.
- [ ] `pnpm lint && pnpm format && pnpm test` yeşil.

## 8. Teslim

Branch: `feature/order-automation`. Conventional Commits, katman başına commit
(db → motor + aksiyon handler'ları → endpoint'ler → scheduler → frontend → test). PR açıklamasında:
keşif kararları, eklenen domain event'leri, yeni sipariş alanları (tag/hold vb.), kapsam dışı
bırakılanlar ve sonraki adımlar (ör. ürün/stok otomasyonları, onay adımlı aksiyonlar, görsel akış
editörü).