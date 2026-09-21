# Görev: "E-posta / SMS Şablonları" sayfasını uçtan uca hayata geçir

KroptOS'ta **Siparişler → E-posta / SMS Şablonları** sayfası şu an boş durum ekranı gösteriyor
("Bu sayfanın arkasında henüz bir servis ucu yok…"). Bu sayfanın arkasına gerçek bir bildirim
şablonu sistemi kur: şablon yönetimi, değişken sistemi, önizleme, test gönderimi, sipariş
olaylarına bağlı otomatik gönderim, gönderim kuyruğu ve gönderim günlüğü.

**Önce `kroptos-konvansiyonlari` skill'ini oku ve harfiyen uy.** Yeni kalıp icat etme; backend'de
`src/modules/product/`, frontend'de `products` sayfası kanonik örnektir. Ekip sırası:
`proje-yoneticisi → db-prisma → backend-dev → entegrasyon-dev → frontend-dev → test-qa → code-reviewer`.

---

## 0. Keşif (kod yazmadan önce)

1. Mevcut sayfa dosyasını bul (`src/app/t/[tenantPublicId]/…` altında şablonlar sayfası) ve
   sidebar'daki menü kaydını, i18n anahtarlarını tespit et.
2. **Sipariş Durumları** sayfası/modülü nasıl çalışıyor incele: durum modeli, durum değişikliği
   nerede yapılıyor, bir event/hook yayınlanıyor mu? Şablon tetikleyicileri bu durumlara bağlanacak.
3. Kargo modülü (shipment) ve iade modülünde takip no, kargo firması, iade kodu gibi alanlara
   bak — bunlar şablon değişkeni olacak.
4. Projede zaten bir mail/SMS altyapısı var mı (nodemailer, SES, Netgsm, İleti Merkezi, Twilio,
   `MailService`, `NotificationService`, BullMQ queue adları)? Varsa onu genişlet, ikincisini yazma.
5. Üst bardaki **Dağıtıcı Firma (agency)** ve **Marka (client)** seçicilerinin, özellikle
   "Tüm Markalar" seçiliyken diğer sayfaların tenantContext'i nasıl ele aldığını incele.
   Kapsam kararını (bkz. §1) bu davranışa göre ver.

Keşif sonunda kısa bir plan yaz; belirsiz bir karar varsa (ör. SMS sağlayıcısı) varsayımını
açıkça belirt ve devam et.

---

## 1. Kapsam ve miras (fallback) modeli

Şablonlar üç seviyede tanımlanabilir, gönderimde **en özel olan kazanır**:

```
Mağaza (storeId)  →  Marka (clientId)  →  Dağıtıcı firma varsayılanı (agencyId)  →  Sistem varsayılanı (seed)
```

- Sistem varsayılanları seed ile gelir, silinemez, düzenlenemez; kullanıcı "Özelleştir" dediğinde
  o seviyeye kopyalanır.
- "Tüm Markalar" seçiliyken sayfa agency seviyesini düzenler; marka seçiliyse marka seviyesini.
  Mevcut projede bu davranış farklı çözülmüşse (ör. storeId zorunlu), mevcut kalıba uy ve
  seviye sayısını ona göre azalt — nedenini PR açıklamasına yaz.
- Listede her satır için hangi seviyeden geldiği rozetle gösterilir: `Sistem`, `Firma`, `Marka`, `Mağaza`.

---

## 2. Veritabanı (db-prisma)

Konvansiyondaki zorunlu alanlar (`id uuid`, `agencyId`, `clientId?`, `storeId`, `createdAt`,
`updatedAt`, `deletedAt?`, `@@index([agencyId])`, `@@index([storeId])`) her modelde olsun.
Kapsam modeli gereği `storeId` agency/marka seviyesi kayıtlarda null olabiliyorsa bunu mevcut
şemadaki benzer bir örnekle gerekçelendir.

**enum NotificationChannel**: `EMAIL`, `SMS`

**enum NotificationEvent** (başlangıç seti, Sipariş Durumları ile eşleştir):
`ORDER_CREATED`, `ORDER_CONFIRMED`, `ORDER_SHIPPED`, `ORDER_OUT_FOR_DELIVERY`, `ORDER_DELIVERED`,
`ORDER_CANCELLED`, `PAYMENT_RECEIVED`, `PAYMENT_FAILED`, `COD_REMINDER`, `RETURN_REQUESTED`,
`RETURN_APPROVED`, `RETURN_RECEIVED`, `REFUND_COMPLETED`, `INVOICE_CREATED`.
Özel sipariş durumları varsa `ORDER_STATUS_CHANGED` + `orderStatusId` ile bağlanabilsin.

**NotificationTemplate**
- `channel`, `event`, `orderStatusId?`, `locale` (tr, en…)
- `name`, `subject?` (yalnız EMAIL), `bodyHtml?` (EMAIL), `bodyText` (SMS + e-postanın düz metin alternatifi)
- `isActive`, `isSystemDefault`, `scopeLevel` (`SYSTEM|AGENCY|CLIENT|STORE`)
- `senderName?`, `replyTo?`, `smsSenderId?` (SMS başlığı), `sendDelayMinutes` (default 0)
- `version` (int), `updatedById`
- Tekillik: aynı kapsamda `(channel, event, orderStatusId, locale)` tek aktif kayıt —
  tenant alanlarıyla birlikte `@@unique` (global unique kullanma).

**NotificationTemplateVersion** — her kaydetmede önceki içeriğin kopyası (geri alma için).

**NotificationLog**
- `templateId?`, `channel`, `event`, `orderId?`, `recipient` (maskeli saklanacak şekilde de gösterilebilir),
  `subject?`, `renderedBody` (veya hash + kısaltılmış), `status` (`QUEUED|SENT|DELIVERED|FAILED|SKIPPED`),
  `provider`, `providerMessageId?`, `errorMessage?`, `attempts`, `sentAt?`, `isTest`
- İndeksler: `[storeId, createdAt]`, `[orderId]`, `[status]`.

**NotificationProviderConfig** (kanal başına, kapsam seviyeli) — sağlayıcı tipi, gönderen bilgisi,
kimlik bilgileri **şifreli** (projede secret şifreleme yardımcısı varsa onu kullan; yoksa raporla).

Migration: `git pull` → `pnpm db:migrate`; migration elle düzenlenmez. Varsayılan şablonlar için
seed ekle (TR + EN, her event için EMAIL ve SMS).

---

## 3. Backend (backend-dev)

Modül: `src/modules/notification-template/` (dörtlü yapı) ve gönderim için
`src/modules/notification/` (servis + BullMQ processor). `app.module.ts`'e ekle.

Guard zinciri, `@RequirePermission`, Swagger dekoratörleri, üç `@ApiHeader`, class-validator DTO'lar,
her sorguda tenant filtresi, soft delete ve her mutasyonda audit log — istisnasız.

**Yetkiler**: `notification_template.read`, `.create`, `.update`, `.delete`, `.test_send`,
`notification_log.read`, `notification_provider.manage`. Rol seed'lerine ekle.

**Endpoint'ler** (`/api` prefix otomatik):

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/notification-templates` | Liste; filtre: `channel`, `event`, `locale`, `isActive`, `search`. Her satırda efektif kaynak seviyesi (`resolvedFrom`) |
| GET | `/notification-templates/:id` | Detay |
| POST | `/notification-templates` | Oluştur (201) |
| POST | `/notification-templates/:id/customize` | Üst seviyedeki şablonu mevcut seviyeye kopyala |
| PATCH | `/notification-templates/:id` | Güncelle, versiyon kaydı oluştur |
| PATCH | `/notification-templates/:id/toggle` | Aktif/pasif |
| DELETE | `/notification-templates/:id` | Soft delete (204); sistem varsayılanı silinemez → 403 |
| GET | `/notification-templates/:id/versions` | Versiyon geçmişi |
| POST | `/notification-templates/:id/versions/:versionId/restore` | Geri yükle |
| GET | `/notification-templates/variables?event=` | O event için kullanılabilir değişken listesi + örnek değerler |
| POST | `/notification-templates/preview` | Gövde + `orderId?` → render sonucu (orderId yoksa örnek veri) |
| POST | `/notification-templates/:id/test-send` | Belirtilen e-posta/telefona test gönderimi (`isTest: true` log) |
| GET | `/notification-logs` | Sayfalı günlük; filtre: kanal, durum, event, tarih, orderId |
| POST | `/notification-logs/:id/retry` | Başarısız gönderimi tekrar kuyruğa al |
| GET/PATCH | `/notification-providers` | Kanal sağlayıcı ayarları (+ `POST /notification-providers/test`) |

**Şablon motoru**
- Handlebars (veya projede zaten ne varsa). HTML için otomatik escape; yalnız izinli helper'lar:
  `formatCurrency`, `formatDate`, `upper`, `if/each`. Kullanıcı kodu çalıştırma yok.
- Kaydetmeden önce doğrula: sözdizimi hatası ve **bilinmeyen değişken** → 422 ile satır/değişken adı döndür.
- Değişken kataloğu event'e göre: `customer.firstName`, `customer.fullName`, `order.number`,
  `order.date`, `order.total`, `order.currency`, `order.items[]` (ad, adet, fiyat, görsel),
  `order.paymentMethod`, `shipping.address`, `shipment.carrierName`, `shipment.trackingNumber`,
  `shipment.trackingUrl`, `return.code`, `refund.amount`, `invoice.url`, `store.name`,
  `store.logoUrl`, `store.supportEmail`, `store.supportPhone`, `brand.name`.
- E-posta: marka logosu ve renkleriyle ortak bir layout (header/footer) içine sarılsın; CSS inline edilsin
  (juice vb.), düz metin alternatifi otomatik üretilebilsin.
- SMS: render sonrası karakter sayısı ve segment hesabı. Türkçe karakter (ç, ğ, ı, ö, ş, ü) içeriyorsa
  kodlamaya göre segment sınırı değişir — sağlayıcının kuralına göre hesapla ve API yanıtında
  `charCount`, `segments`, `encoding` döndür.

**Gönderim akışı**
1. Sipariş/kargo/iade/fatura servislerinde durum değiştiğinde domain event yayınla
   (projede EventEmitter varsa onu kullan). Mevcut servislerin sorumluluğunu şişirme.
2. `NotificationDispatcher` event'i dinler → kapsam fallback'iyle kanal başına efektif şablonu çözer
   → müşterinin dili (yoksa mağaza varsayılanı) → aktif değilse `SKIPPED` log.
3. İş BullMQ kuyruğuna (`notifications`) `sendDelayMinutes` gecikmesiyle eklenir; asla request
   içinde senkron gönderim yapılmaz.
4. Processor: render → sağlayıcı adaptörü → log güncelle. Retry: 3 deneme, exponential backoff.
   Kalıcı hatada `FAILED` + hata mesajı.
5. **Idempotency**: aynı `(orderId, event, channel)` için ikinci gönderim yapılmasın
   (job id ile veya log kontrolüyle).
6. Sağlayıcılar adaptör arayüzüyle: `EmailProvider` (SMTP, Amazon SES) ve `SmsProvider`
   (Netgsm, İleti Merkezi; arayüz başka sağlayıcıya açık). Sağlayıcı ayarlı değilse `SKIPPED`
   + açıklayıcı neden.

**Uyum**
- Sipariş bildirimleri işlemsel (bilgilendirme) mesajdır; bu sayfada pazarlama içeriği yok.
  Şablon gövdesinde kampanya/indirim linki olmaması için kullanıcıyı uyaran bir not ekle
  (İYS kapsamındaki ticari ileti ayrı bir modülün işi).
- Loglarda telefon/e-posta maskeli gösterilsin; ham kişisel veri gereğinden fazla saklanmasın (KVKK).
  Log saklama süresi mağaza ayarından (varsayılan 180 gün) — temizlik için zamanlanmış job.

---

## 4. Frontend (frontend-dev)

Klasör: `src/app/t/[tenantPublicId]/<mevcut-sayfa-yolu>/` → `page.tsx`, `hooks/useNotificationTemplates.ts`,
`components/`. `'use client'`, yalnız `apiFetch`/`api.*`, yalnız `kp-*` token sınıfları,
`@heroicons/react/24/outline`, tüm metinler `useTranslations` (en az `tr.json` + `en.json`).
Mevcut sayfa başlığı ve açıklamasını koru; boş durum placeholder'ını kaldır.

**Sayfa düzeni**
- Üstte sekmeler: **Şablonlar** · **Gönderim Günlüğü** · **Sağlayıcı Ayarları** (son sekme yalnız
  `notification_provider.manage` yetkisiyle görünür).
- Şablonlar sekmesi: kanal filtresi (Tümü / E-posta / SMS), dil seçici, arama. Tablo event'e göre
  gruplanır; her event satırında E-posta ve SMS için ayrı hücre: durum toggle'ı, kaynak rozeti
  (Sistem/Firma/Marka/Mağaza), son güncelleme, "Düzenle" / "Özelleştir".
- Yetkisiz kullanıcılar salt-okunur görür; `storeId`/tenant bağlamı yoksa konvansiyondaki boş durum.

**Düzenleyici (sağdan açılan geniş drawer veya ayrı detay sayfası — komşu sayfalardaki kalıba uy)**
- Sol: form. E-posta için konu, gönderen adı, yanıt adresi, HTML gövde (kod görünümü + basit
  zengin metin), düz metin alternatifi. SMS için gövde + canlı karakter/segment sayacı ve
  Türkçe karakter uyarısı.
- Değişken paneli: event'e göre değişken listesi; tıklayınca imleç konumuna `{{order.number}}` ekler.
- Sağ: canlı önizleme (debounce'lu `/preview`); "Örnek veri" / "Gerçek sipariş seç" (sipariş arama).
  E-posta önizlemesi masaüstü/mobil genişlik anahtarıyla, SMS önizlemesi telefon balonu şeklinde.
- Doğrulama hataları (bilinmeyen değişken, sözdizimi) satır bazlı gösterilir; kaydet butonu pasif.
- "Test gönder" modalı: alıcı e-posta/telefon, sonuç toast'ı.
- "Versiyon geçmişi": liste + fark görünümü + geri yükle.
- Kaydedilmemiş değişiklikle kapatmaya çalışırken onay iste.

**Gönderim Günlüğü sekmesi**
- Sayfalı tablo: tarih, kanal, event, sipariş no (siparişe link), maskeli alıcı, durum rozeti
  (`kp-success|warning|danger|info`), sağlayıcı, deneme sayısı.
- Filtreler: kanal, durum, event, tarih aralığı, sipariş no. Satır detayında render edilmiş içerik ve hata.
  `FAILED` satırlarda "Tekrar dene".

**Sağlayıcı Ayarları sekmesi**
- Kanal başına sağlayıcı seçimi ve alanları; secret alanlar yazıldıktan sonra maskeli gösterilir.
  "Bağlantıyı test et" butonu.

Ayrıca sipariş detay sayfasına küçük bir "Bildirimler" bölümü eklenebiliyorsa (o siparişin
log'ları) ekle; değilse yapılabilirliğini raporla.

---

## 5. Test (test-qa)

- Birim: fallback çözümleme (mağaza > marka > firma > sistem), değişken doğrulama, SMS segment
  hesabı (Türkçe karakterli/karaktersiz), idempotency, sistem şablonunun silinememesi.
- Entegrasyon: sipariş durumu değişince kuyruğa doğru şablonla iş düşmesi; sağlayıcı hata verdiğinde
  retry ve `FAILED` log; pasif şablonda `SKIPPED`.
- **Tenant izolasyonu**: A mağazasının kullanıcısı B'nin şablonunu/logunu okuyamıyor,
  güncelleyemiyor, test gönderemiyor (404).
- Yetki: her endpoint yetkisiz rolde 403.
- Frontend: hook testi + düzenleyicide önizleme/doğrulama akışı.

---

## 6. Kabul kriterleri

- [ ] Sayfadaki "servis ucu yok" boş durumu gitti; seed'den gelen varsayılan şablonlar listeleniyor.
- [ ] Bir şablon özelleştirilip kaydedilebiliyor, versiyonu oluşuyor, geri yüklenebiliyor.
- [ ] Önizleme örnek veriyle ve gerçek siparişle çalışıyor; hatalı değişken kaydı engelliyor.
- [ ] Test gönderimi e-posta ve SMS için çalışıyor ve günlüğe `isTest` olarak düşüyor.
- [ ] Bir siparişin durumu "Kargoya verildi" olduğunda, takip numaralı e-posta ve SMS kuyruk üzerinden
      bir kez gönderiliyor; günlükte görünüyor.
- [ ] Marka/mağaza seçimi değişince doğru kapsamın şablonları görünüyor; kaynak rozetleri doğru.
- [ ] Tüm metinler TR/EN çevrili, yalnız `kp-*` token kullanılmış, ham `fetch` yok.
- [ ] `pnpm lint && pnpm format && pnpm test` yeşil; Swagger'da tüm endpoint'ler dokümante.

## 7. Teslim

Branch: `feature/notification-templates`. Conventional Commits, katman başına ayrı commit
(db → backend → provider adaptörleri → frontend → test). PR açıklamasında: keşifte verilen kararlar
(kapsam modeli, seçilen sağlayıcılar, mevcut event altyapısı), kapsam dışı bırakılanlar ve
sonraki adımlar (ör. WhatsApp kanalı, pazarlama/İYS modülü, teslim raporu webhook'ları).