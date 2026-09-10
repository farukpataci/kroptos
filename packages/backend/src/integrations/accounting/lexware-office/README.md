# Lexware Office Muhasebe Entegrasyonu (KroptOS)

## 1. Genel Bakış ve Mimari Kararlar

Lexware Office (eski adıyla lexoffice), Almanya KOBİ ve mikro işletmelerine yönelik bulut tabanlı bir ön muhasebe ve faturalama servisidir.

### Sağlayıcı Bölme Kuralı (§1)
* **`lexware-office`**: REST/JSON API kullanan bulut servis. Bu modülün tek hedefidir.
* **`lexware-desktop`**: Klasik masaüstü Lexware (Buchhalter / Financial Office). Genel açık bulut API'si bulunmadığından registry'ye **eklenmez**. Masaüstü kullanıcıları için çözüm DATEV EXTF dışa aktarımıdır.

---

## 2. Doğrulanan Standartlar & Açık Kalan Maddeler (§3.8)

### Doğrulananlar
* **Taban URL**: `https://api.lexware.io/v1`
* **Kimlik Doğrulama**: `Authorization: Bearer <apiKey>` (Süresiz organizasyon anahtarı, OAuth/Refresh yok).
* **Rate Limit**: Token bucket, saniyede 2 istek / API anahtarı. HTTP 429 cevabında `Retry-After` **YOKTUR**. KroptOS tam jitter'lı üstel geri çekilme (`LexwareBackoff`) uygular.
* **İyimser Kilit (version)**: Güncellenebilir varlıklarda `version` tam sayısı bulunur. Çakışmada HTTP 409 döner. `LexwareVersionLock` ile mutasyon öncesi okunur ve 409'da en fazla 1 kez tekrarlanır.
* **Hata Modeli**: Doğrulama ve iş kuralı hataları **HTTP 406** ve `i18nKey` ile döner. `LexwareErrorMapper` kalıcı `LexwareValidationError` olarak sınıflandırır (asla retry edilmez).
* **Belge Yaşam Döngüsü**: Taslak (`draft`), kesinleşmiş (`open`), ödenmiş (`paid`), iptal (`voided`). Kesinleşmiş belgeler değiştirilemez ve silinemez.
* **Tahsilat (`/payments`)**: Yalnızca `GET` (okuma) destekler. `capabilities.payment = 'NOT_SUPPORTED'`.

### Açık Kalanlar / DOCUMENTATION_REQUIRED
* **Referansla Arama**: `voucherNumber` sistemin numara serisinden otomatik üretilir. KroptOS sipariş referansına göre doğrudan filtreleme API tarafından desteklenmediği için `capabilities.findInvoiceByReference = 'DOCUMENTATION_REQUIRED'` atanmıştır ve otomatik claim çözümleme kapalıdır.
* **Idempotency Header**: Dokümante edilmiş bir idempotency header (`Idempotency-Key` vb.) bulunmamaktadır. Çift kayıt riskine karşı tek koruma KroptOS claim mekanizması ve taslak-önce akışıdır.

---

## 3. Firma Ekseni Notu (§7)
Lexware Office API anahtarı **organizasyon düzeyinde** üretilir. Bu nedenle bir API anahtarı tek bir tüzel şirketi temsil eder. Çoklu şirket durumlarında her şirket için ayrı API anahtarı girilir. Modeldeki `externalCompanyId` Lexware organizasyon kimliğine karşılık gelir.

---

## 4. Ayrı Eksen: ZUGFeRD / XRechnung (§2)
Lexware Office arayüzü ve API'si e-Fatura formatlarını (ZUGFeRD / XRechnung) destekleyebilir; ancak bu entegrasyon turu **e-Fatura kapsamı dışındadır**. ZUGFeRD / XRechnung motoru DATEV turunda oluşturulan ayrı eksen üzerinden yönetilir. Arayüzde veya modül içerisinde "e-fatura" tabiri kullanılmaz.

---

## 5. Zorunlu Taslak-Önce Akışı (§5.2)
Kesinleşmiş faturalar silinemediği için `?finalize=true` parametresi **kesinlikle kullanılmaz**. Akış sırasıyla:
1. `POST /v1/invoices` ile taslak oluşturulur.
2. `GET /v1/invoices/{id}` ile sunucu hesaplamış toplamlar geri okunur.
3. KroptOS sipariş toplamı ile mutabakat yapılır:
   - Tutuyorsa: `POST /v1/invoices/{id}/finalize` çağrılır.
   - Tutmuyorsa: Kesinleştirme **yapılmaz**, taslak Lexware'de bekletilir ve uyuşmazlık hata olarak bildirilir.
